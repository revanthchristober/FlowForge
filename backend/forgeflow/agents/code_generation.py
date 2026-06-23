"""Code Generation Agent — tasks + architecture → code artifacts + sandbox results."""

from __future__ import annotations

import logging

from forgeflow.agents._llm import BudgetExceededError, chat_json
from forgeflow.sandbox import run_sandbox
from forgeflow.state import AuditEntry, CodeArtifact, ForgeState
from forgeflow.tracing import observe

log = logging.getLogger(__name__)

MODEL = "forge/worker"   # cheap model — this is the tiering story
MAX_RETRIES = 2          # regenerate once on parse failure, then bail

SYSTEM_PROMPT = """\
You are a senior Python developer implementing a specific task.

Given:
- Task title and description
- Architecture context (tech stack and module layout)
- File path for this module

Generate production-quality Python code for the task, plus a matching pytest test file.

Rules:
- Use the architecture's tech stack (framework, ORM, etc.) faithfully
- Write clean code with type hints and docstrings on public functions
- The code MUST be syntactically valid Python 3.11+
- Tests must use pytest and be independently runnable
- Do NOT include import of local modules that don't exist yet — use minimal deps
- Keep the implementation focused on the single task described

Output ONLY a JSON object:
{
  "code": "... complete Python source ...",
  "test_code": "... pytest tests for this module ..."
}
"""


def _build_task_prompt(task, state: ForgeState) -> str:
    stack_summary = ""
    if state.architecture:
        stack_lines = [f"  {k}: {v}" for k, v in state.architecture.stack.items()]
        stack_summary = "Tech stack:\n" + "\n".join(stack_lines)

    revision_hint = ""
    if state.review_revision_notes:
        revision_hint = f"\n\nNote from code review: {state.review_revision_notes}"

    return (
        f"Task: {task.title}\n"
        f"Description: {task.description}\n"
        f"Target file: {task.file_path}\n\n"
        f"{stack_summary}"
        f"{revision_hint}"
    )


@observe(name="code_generation")
async def run(state: ForgeState) -> dict:
    """LangGraph node: generate code for each task sequentially."""
    log.info(
        "[code_generation] Generating code for %d tasks in run %s",
        len(state.tasks),
        state.run_id,
    )

    if not state.tasks:
        log.warning("[code_generation] No tasks to generate — skipping")
        return {
            "next_agent": "code_review",
            "audit_log": state.audit_log + [AuditEntry(
                agent="code_generation",
                event="skipped_no_tasks",
                decision_actor="system",
            )],
        }

    if not state.within_budget():
        return {
            "next_agent": "budget_exceeded",
            "audit_log": state.audit_log + [AuditEntry(
                agent="code_generation",
                event="budget_exceeded",
                payload={"budget_used": state.budget_used_usd},
                decision_actor="system",
            )],
        }

    artifacts: list[CodeArtifact] = []
    total_tokens = 0
    total_cost = 0.0
    generation_errors: list[str] = []

    for task in state.tasks:
        if not state.within_budget():
            log.warning("[code_generation] Budget exhausted mid-loop, stopping at task %s", task.id)
            break

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_task_prompt(task, state)},
        ]

        last_error: str | None = None
        for attempt in range(MAX_RETRIES):
            try:
                data, tokens, cost = await chat_json(
                    state, MODEL, messages, f"code-gen-{task.id[:8]}"
                )
                code = data.get("code", "").strip()
                test_code = data.get("test_code", "").strip() or None

                if not code:
                    raise ValueError("LLM returned empty code")

                artifacts.append(CodeArtifact(
                    task_id=task.id,
                    file_path=task.file_path,
                    content=code,
                    language="python",
                    test_content=test_code,
                ))
                total_tokens += tokens
                total_cost += cost
                log.info("[code_generation] Task %s done (attempt %d)", task.title[:40], attempt + 1)
                break

            except BudgetExceededError:
                log.warning("[code_generation] Budget exceeded during task %s", task.id)
                break
            except Exception as e:
                last_error = str(e)
                log.warning("[code_generation] Attempt %d failed for task %s: %s", attempt + 1, task.id, e)
                if attempt == MAX_RETRIES - 1:
                    generation_errors.append(f"{task.title}: {last_error}")

    # ── Run sandbox ────────────────────────────────────────────────────────────
    sandbox_results: dict = {}
    if artifacts:
        log.info("[code_generation] Running sandbox tests on %d artifacts", len(artifacts))
        try:
            result = await run_sandbox([
                {
                    "file_path": a.file_path,
                    "content": a.content,
                    "test_content": a.test_content,
                }
                for a in artifacts
            ])
            sandbox_results["overall"] = result.to_dict()
            log.info(
                "[code_generation] Sandbox: %d passed, %d failed, mode=%s",
                result.passed, result.failed, result.mode,
            )
        except Exception as e:
            log.error("[code_generation] Sandbox error: %s", e)
            sandbox_results["overall"] = {"error": str(e), "exit_code": -1, "success": False}

    audit_entry = AuditEntry(
        agent="code_generation",
        event="generation_complete",
        payload={
            "artifact_count": len(artifacts),
            "task_count": len(state.tasks),
            "errors": generation_errors,
            "sandbox": sandbox_results.get("overall", {}),
        },
        tokens_used=total_tokens,
        cost_usd=total_cost,
        decision_actor="system",
    )

    return {
        "code_artifacts": artifacts,
        "sandbox_results": sandbox_results,
        "budget_used_usd": round(state.budget_used_usd + total_cost, 6),
        "next_agent": "code_review",
        "audit_log": state.audit_log + [audit_entry],
        "error": "; ".join(generation_errors) if generation_errors else None,
    }
