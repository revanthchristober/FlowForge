"""Code Review Agent — static analysis + LLM review + second HITL gate."""

from __future__ import annotations

import asyncio
import logging
import subprocess
import sys
import tempfile
from pathlib import Path

from langgraph.types import interrupt

from forgeflow.agents._llm import BudgetExceededError, chat_json
from forgeflow.state import AuditEntry, Finding, ForgeState
from forgeflow.tracing import observe

log = logging.getLogger(__name__)

MODEL = "forge/judge"   # mid-tier — quality matters but not top-tier cost
MAX_REVISIONS = 2

REVIEW_SYSTEM_PROMPT = """\
You are a senior security-focused code reviewer.

Review the provided Python code for:
1. Security vulnerabilities (SQL injection, eval() on user input, hardcoded secrets, path traversal)
2. Code patterns (error handling, logging, input validation)
3. Test coverage gaps
4. Logic bugs

For each issue found, classify it:
- blocker: must fix before shipping (security vulns, data loss risks)
- major: should fix (significant bugs, missing validation)
- minor: worth noting (style, minor inefficiency)
- info: suggestion only

Output ONLY a JSON object:
{
  "findings": [
    {
      "severity": "blocker|major|minor|info",
      "category": "security|pattern|test_coverage|style|logic",
      "description": "Clear description of the issue",
      "file_path": "path/to/file.py",
      "line_number": null,
      "suggested_fix": "Brief fix suggestion"
    }
  ],
  "summary": "One paragraph review summary"
}

If no issues found, return {"findings": [], "summary": "Code looks good."}.
"""


# ── Static analysis helpers ────────────────────────────────────────────────────

def _run_ruff(code: str, file_path: str) -> list[Finding]:
    """Run ruff check on code string. Returns Finding list."""
    findings: list[Finding] = []
    with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
        f.write(code)
        tmp_path = f.name

    try:
        result = subprocess.run(
            [sys.executable, "-m", "ruff", "check", tmp_path, "--output-format=json", "--quiet"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.stdout.strip():
            import json
            items = json.loads(result.stdout)
            for item in items[:10]:  # cap at 10 ruff findings
                code_str = item.get("code", "")
                findings.append(Finding(
                    severity="info",
                    category="style",
                    description=f"ruff {code_str}: {item.get('message', '')}",
                    file_path=file_path,
                    line_number=item.get("location", {}).get("row"),
                    suggested_fix=item.get("fix", {}).get("message") if item.get("fix") else None,
                ))
    except (subprocess.TimeoutExpired, Exception) as e:
        log.debug("[code_review] ruff error: %s", e)
    finally:
        import os
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return findings


def _run_bandit(code: str, file_path: str) -> list[Finding]:
    """Run bandit security check on code string. Returns Finding list."""
    findings: list[Finding] = []
    with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
        f.write(code)
        tmp_path = f.name

    try:
        result = subprocess.run(
            [sys.executable, "-m", "bandit", "-f", "json", "-q", tmp_path],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.stdout.strip():
            import json
            data = json.loads(result.stdout)
            for issue in data.get("results", [])[:10]:
                severity_map = {"HIGH": "blocker", "MEDIUM": "major", "LOW": "minor"}
                severity = severity_map.get(issue.get("issue_severity", "LOW"), "minor")
                findings.append(Finding(
                    severity=severity,
                    category="security",
                    description=f"bandit {issue.get('test_id', '')}: {issue.get('issue_text', '')}",
                    file_path=file_path,
                    line_number=issue.get("line_number"),
                    suggested_fix=issue.get("more_info"),
                ))
    except (subprocess.TimeoutExpired, Exception) as e:
        log.debug("[code_review] bandit error: %s", e)
    finally:
        import os
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return findings


async def _run_static_analysis(state: ForgeState) -> list[Finding]:
    """Run ruff + bandit on all code artifacts in parallel threads."""
    if not state.code_artifacts:
        return []

    loop = asyncio.get_event_loop()
    all_findings: list[Finding] = []

    for artifact in state.code_artifacts:
        ruff_findings = await loop.run_in_executor(
            None, _run_ruff, artifact.content, artifact.file_path
        )
        bandit_findings = await loop.run_in_executor(
            None, _run_bandit, artifact.content, artifact.file_path
        )
        all_findings.extend(ruff_findings)
        all_findings.extend(bandit_findings)

    log.info("[code_review] Static analysis: %d findings", len(all_findings))
    return all_findings


# ── LLM review layer ───────────────────────────────────────────────────────────

def _build_review_context(state: ForgeState, static_findings: list[Finding]) -> str:
    code_sections = []
    for art in state.code_artifacts[:5]:  # review up to 5 files
        code_sections.append(f"## {art.file_path}\n```python\n{art.content[:3000]}\n```")

    static_summary = ""
    if static_findings:
        static_summary = "\n\nStatic analysis already found:\n" + "\n".join(
            f"- [{f.severity}] {f.description}" for f in static_findings[:10]
        )

    sandbox_summary = ""
    if state.sandbox_results:
        overall = state.sandbox_results.get("overall", {})
        sandbox_summary = (
            f"\n\nSandbox test results: "
            f"{overall.get('passed', 0)} passed, "
            f"{overall.get('failed', 0)} failed "
            f"(mode: {overall.get('mode', 'unknown')})"
        )

    return "\n\n".join(code_sections) + static_summary + sandbox_summary


@observe(name="code_review")
async def run(state: ForgeState) -> dict:
    """LangGraph node: static analysis + LLM review + HITL gate."""
    log.info("[code_review] Starting review for run %s (revision %d)",
             state.run_id, state.review_revision_count)

    if not state.code_artifacts:
        log.warning("[code_review] No code artifacts — skipping to documentation")
        return {
            "next_agent": "documentation",
            "audit_log": state.audit_log + [AuditEntry(
                agent="code_review",
                event="skipped_no_artifacts",
                decision_actor="system",
            )],
        }

    if not state.within_budget():
        return {
            "next_agent": "budget_exceeded",
            "audit_log": state.audit_log + [AuditEntry(
                agent="code_review",
                event="budget_exceeded",
                payload={"budget_used": state.budget_used_usd},
                decision_actor="system",
            )],
        }

    # ── 1. Static analysis (ruff + bandit) ────────────────────────────────────
    static_findings = await _run_static_analysis(state)

    # ── 2. LLM review ─────────────────────────────────────────────────────────
    messages = [
        {"role": "system", "content": REVIEW_SYSTEM_PROMPT},
        {"role": "user", "content": f"Review this code:\n\n{_build_review_context(state, static_findings)}"},
    ]

    llm_findings: list[Finding] = []
    review_summary = ""
    tokens = 0
    cost = 0.0

    try:
        data, tokens, cost = await chat_json(
            state, MODEL, messages, "code-review-llm"
        )
        for raw in data.get("findings", []):
            try:
                llm_findings.append(Finding(
                    severity=raw.get("severity", "info"),
                    category=raw.get("category", "logic"),
                    description=raw.get("description", ""),
                    file_path=raw.get("file_path"),
                    line_number=raw.get("line_number"),
                    suggested_fix=raw.get("suggested_fix"),
                ))
            except Exception as e:
                log.debug("[code_review] Skipping malformed finding: %s", e)
        review_summary = data.get("summary", "")
    except BudgetExceededError:
        return {
            "next_agent": "budget_exceeded",
            "audit_log": state.audit_log + [AuditEntry(
                agent="code_review", event="budget_exceeded",
                decision_actor="system",
            )],
        }
    except Exception as e:
        log.error("[code_review] LLM review error: %s", e)
        # Don't fail — static findings are enough to continue

    all_findings = static_findings + llm_findings
    blocker_count = sum(1 for f in all_findings if f.severity == "blocker")
    major_count = sum(1 for f in all_findings if f.severity == "major")

    pre_hitl_entry = AuditEntry(
        agent="code_review",
        event="review_complete",
        payload={
            "total_findings": len(all_findings),
            "blockers": blocker_count,
            "majors": major_count,
            "static_count": len(static_findings),
            "llm_count": len(llm_findings),
            "summary": review_summary[:300],
        },
        tokens_used=tokens,
        cost_usd=cost,
        decision_actor="system",
    )
    updated_log = state.audit_log + [pre_hitl_entry]
    updated_budget = round(state.budget_used_usd + cost, 6)

    # ── 3. HITL gate ──────────────────────────────────────────────────────────
    # Graph pauses here. Human sees findings, approves or requests revision.
    decision: dict = interrupt({
        "type": "code_review",
        "run_id": state.run_id,
        "findings": [f.model_dump() for f in all_findings],
        "blocker_count": blocker_count,
        "major_count": major_count,
        "summary": review_summary,
        "sandbox": state.sandbox_results.get("overall", {}),
        "revision_count": state.review_revision_count,
    })

    approved: bool = decision.get("approve", False)
    notes: str = decision.get("notes", "")

    human_entry = AuditEntry(
        agent="code_review",
        event="hitl_decision",
        payload={"approved": approved, "notes": notes, "blocker_count": blocker_count},
        decision_actor="human",
    )
    updated_log = updated_log + [human_entry]

    if approved:
        log.info("[code_review] Approved by human (%d findings accepted)", len(all_findings))
        return {
            "review_findings": all_findings,
            "review_approved": True,
            "budget_used_usd": updated_budget,
            "next_agent": "documentation",
            "audit_log": updated_log,
        }
    else:
        log.info("[code_review] Revision requested: %s", notes)
        return {
            "review_findings": all_findings,
            "review_approved": False,
            "review_revision_count": state.review_revision_count + 1,
            "review_revision_notes": notes,
            "budget_used_usd": updated_budget,
            "next_agent": "code_generation",  # regenerate based on review notes
            "audit_log": updated_log,
        }
