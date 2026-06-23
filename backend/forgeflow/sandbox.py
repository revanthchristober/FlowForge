"""
Sandbox runner — executes generated code safely.

Primary mode: Docker exec in an ephemeral container (no host network, read-only rootfs).
Fallback mode: local subprocess with timeout (used when Docker is unavailable, e.g. dev machines).

Returns a SandboxResult with pass/fail counts, stderr tail, and exit code.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
import tempfile
import uuid
from dataclasses import dataclass, field
from pathlib import Path

log = logging.getLogger(__name__)

TIMEOUT_SECONDS = 60
DOCKER_IMAGE = "forgeflow-sandbox:latest"  # built via: docker build -t forgeflow-sandbox:latest -f infra/Dockerfile.sandbox infra/


@dataclass
class SandboxResult:
    passed: int = 0
    failed: int = 0
    errors: int = 0
    exit_code: int = -1
    stdout: str = ""
    stderr: str = ""
    mode: str = "unknown"  # "docker" | "subprocess" | "syntax_only"

    @property
    def success(self) -> bool:
        # pytest exit codes: 0=all passed, 5=no tests collected (both are "success")
        # 1=test failures, 2=collection/syntax error, 3=interrupted, 4=usage error
        return self.exit_code in (0, 5) and self.failed == 0 and self.errors == 0

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "failed": self.failed,
            "errors": self.errors,
            "exit_code": self.exit_code,
            "success": self.success,
            "mode": self.mode,
            "stderr_tail": self.stderr[-500:] if self.stderr else "",
        }


async def run_sandbox(artifacts: list[dict]) -> SandboxResult:
    """
    Write artifacts to a temp dir and execute tests.
    artifacts: list of {"file_path": str, "content": str, "test_content": str|None}
    """
    with tempfile.TemporaryDirectory(prefix="forge_sandbox_") as tmpdir:
        tmp = Path(tmpdir)

        # Write all source files
        for art in artifacts:
            dest = tmp / art["file_path"].lstrip("/")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(art["content"], encoding="utf-8")

            # Write test file alongside source
            if art.get("test_content"):
                src_stem = Path(art["file_path"]).stem
                test_path = dest.parent / f"test_{src_stem}.py"
                test_path.write_text(art["test_content"], encoding="utf-8")

        # Try Docker first, fall back to subprocess
        if _docker_available():
            return await _run_docker(tmp)
        else:
            log.info("[sandbox] Docker unavailable — using subprocess fallback")
            return await _run_subprocess(tmp)


def _docker_available() -> bool:
    try:
        result = subprocess.run(
            ["docker", "info"], capture_output=True, timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


async def _run_docker(workdir: Path) -> SandboxResult:
    """Run pytest inside a disposable Docker container."""
    container_name = f"forge-sandbox-{uuid.uuid4().hex[:8]}"
    cmd = [
        "docker", "run",
        "--rm",
        "--name", container_name,
        "--network", "none",           # no network access
        "--read-only",                 # read-only rootfs
        "--tmpfs", "/tmp:size=50m",    # writable /tmp only
        "--memory", "256m",
        "--cpus", "0.5",
        "-v", f"{workdir}:/app:ro",   # mount code read-only
        "-w", "/app",
        DOCKER_IMAGE,
        "sh", "-c",
        # 1) ast.parse checks ALL .py files for syntax errors (no bytecode written)
        # 2) only run pytest if syntax is clean
        "python -c 'import ast,os,sys;"
        "[ast.parse(open(os.path.join(r,f)).read()) "
        "for r,_,fs in os.walk(\".\") for f in fs if f.endswith(\".py\")]' "
        "&& python -B -m pytest . --tb=short -q -p no:cacheprovider 2>&1",
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=TIMEOUT_SECONDS)
        output = stdout.decode(errors="replace")
        return _parse_pytest_output(output, proc.returncode or 0, mode="docker")
    except asyncio.TimeoutError:
        subprocess.run(["docker", "stop", container_name], capture_output=True)
        return SandboxResult(exit_code=124, stderr="Timeout", mode="docker")
    except Exception as e:
        log.error("[sandbox] Docker error: %s", e)
        return SandboxResult(exit_code=-1, stderr=str(e), mode="docker")


async def _run_subprocess(workdir: Path) -> SandboxResult:
    """Fallback: run pytest in a local subprocess with strict timeout."""
    # First do a syntax check on all .py files
    py_files = list(workdir.rglob("*.py"))
    syntax_errors = []
    for f in py_files:
        try:
            compile(f.read_text(), str(f), "exec")
        except SyntaxError as e:
            syntax_errors.append(f"{f.name}:{e.lineno}: {e.msg}")

    if syntax_errors:
        return SandboxResult(
            exit_code=1,
            stderr="\n".join(syntax_errors),
            mode="syntax_only",
            failed=len(syntax_errors),
        )

    # Check if there are any test files
    test_files = list(workdir.rglob("test_*.py")) + list(workdir.rglob("*_test.py"))
    if not test_files:
        log.info("[sandbox] No test files found — syntax check only")
        return SandboxResult(exit_code=0, passed=0, mode="syntax_only", stdout="No tests found")

    # Run pytest in subprocess
    import sys
    python_exe = sys.executable
    cmd = [python_exe, "-m", "pytest", str(workdir), "--tb=short", "-q", "--no-header"]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(workdir),
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=TIMEOUT_SECONDS)
        output = stdout.decode(errors="replace")
        err = stderr.decode(errors="replace")
        return _parse_pytest_output(output, proc.returncode or 0, mode="subprocess", stderr=err)
    except asyncio.TimeoutError:
        return SandboxResult(exit_code=124, stderr="Timeout exceeded", mode="subprocess")
    except Exception as e:
        log.error("[sandbox] Subprocess error: %s", e)
        return SandboxResult(exit_code=-1, stderr=str(e), mode="subprocess")


def _parse_pytest_output(output: str, returncode: int, mode: str, stderr: str = "") -> SandboxResult:
    """Parse pytest -q output to extract pass/fail counts.

    Handles all summary formats:
      "3 passed, 1 failed in 0.12s"
      "1 failed in 0.02s"
      "2 passed in 0.05s"
      "1 error in 0.01s"
    """
    passed = failed = errors = 0
    for line in output.splitlines():
        stripped = line.strip()
        # pytest summary lines always end with " in X.XXs" and contain pass/fail/error keywords
        if not (" passed" in stripped or " failed" in stripped or " error" in stripped):
            continue
        # Split on commas to handle combined counts ("3 passed, 1 failed in 0.12s")
        # Strip the trailing "in X.XXs" from the last segment
        segments = stripped.split(",")
        for seg in segments:
            seg = seg.strip()
            # Remove trailing "in X.XXs" portion
            if " in " in seg:
                seg = seg[:seg.rfind(" in ")].strip()
            parts = seg.split()
            if len(parts) >= 2:
                try:
                    count = int(parts[0])
                    label = parts[1]
                    if "passed" in label:
                        passed = count
                    elif "failed" in label:
                        failed = count
                    elif "error" in label:
                        errors = count
                except (ValueError, IndexError):
                    pass

    return SandboxResult(
        passed=passed,
        failed=failed,
        errors=errors,
        exit_code=returncode,
        stdout=output[-1000:],
        stderr=stderr[-500:],
        mode=mode,
    )
