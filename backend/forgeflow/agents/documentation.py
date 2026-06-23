"""Documentation Agent — generate README, API, and SETUP docs from completed run."""

from __future__ import annotations

import logging

from forgeflow.agents._llm import BudgetExceededError, chat_text
from forgeflow.state import AuditEntry, ForgeState
from forgeflow.tracing import observe

log = logging.getLogger(__name__)

MODEL = "forge/judge"   # mid-tier — quality matters but not top-tier cost

SYSTEM_PROMPT = """\
You are a technical writer. Generate documentation for a software project.

Use this EXACT format with XML tags (do not use JSON):

<readme>
## Overview
Brief project description.
## Install
Installation steps.
## Run
How to run the project.
## Environment
Required environment variables.
</readme>

<api>
## Overview
API description.
## API
Base URL and authentication.
## Endpoints
List of endpoints.
</api>

<setup>
## Overview
Setup summary.
## Install
Install steps.
## Environment
Required env vars.
## Run
Run commands.
</setup>

Keep each section concise (under 200 words). Write real content based on the project context.

README.md must include:
- ## Overview
- ## Install
- ## Run
- ## Environment

API.md must include:
- ## Overview
- ## API
- ## Endpoints (or ## Routes)

SETUP.md must include:
- ## Overview
- ## Install
- ## Environment
- ## Run

Use clear, concise technical writing. Include concrete examples where useful.
Do not include placeholder text — write real content based on the architecture.
"""


def _build_doc_context(state: ForgeState) -> str:
    """Build context string for the documentation LLM call."""
    parts = []

    # Epics summary
    if state.epics:
        epic_lines = [f"- {e.title}: {e.description}" for e in state.epics]
        parts.append("## Project Epics\n" + "\n".join(epic_lines))

    # Architecture
    if state.architecture:
        stack_lines = [f"- {k}: {v}" for k, v in state.architecture.stack.items()]
        parts.append("## Tech Stack\n" + "\n".join(stack_lines))
        if state.architecture.adr:
            parts.append(f"## Architecture Decision\n{state.architecture.adr[:800]}")

    # Implemented files
    if state.code_artifacts:
        file_list = [f"- `{a.file_path}` (task: {a.task_id[:8]})" for a in state.code_artifacts]
        parts.append("## Implemented Files\n" + "\n".join(file_list))
    else:
        # If no code yet, use task file paths
        if state.tasks:
            file_list = [f"- `{t.file_path}`: {t.title}" for t in state.tasks]
            parts.append("## Planned Files\n" + "\n".join(file_list))

    return "\n\n".join(parts)


@observe(name="documentation")
async def run(state: ForgeState) -> dict:
    """LangGraph node: generate project documentation from completed run state."""
    log.info("[documentation] Generating docs for run %s", state.run_id)

    # Budget check — if over, skip docs gracefully (don't halt whole pipeline)
    if not state.within_budget():
        log.warning("[documentation] Budget exceeded — skipping docs generation")
        return {
            "next_agent": "evaluation",
            "docs": {},
            "audit_log": state.audit_log + [AuditEntry(
                agent="documentation",
                event="skipped_budget_exceeded",
                payload={"budget_used": state.budget_used_usd, "cap": state.budget_cap_usd},
                decision_actor="system",
            )],
        }

    context = _build_doc_context(state)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Generate documentation for this project:\n\n{context}"},
    ]

    try:
        text, tokens, cost = await chat_text(
            state, MODEL, messages, "documentation-generation"
        )
    except BudgetExceededError as e:
        log.warning("[documentation] Budget exceeded during LLM call: %s", e)
        return {
            "next_agent": "evaluation",
            "docs": {},
            "audit_log": state.audit_log + [AuditEntry(
                agent="documentation",
                event="skipped_budget_exceeded",
                payload={"error": str(e)},
                decision_actor="system",
            )],
        }
    except Exception as e:
        log.error("[documentation] LLM error: %s", e)
        return {
            "next_agent": "evaluation",
            "docs": {},
            "error": f"documentation failed: {e}",
            "audit_log": state.audit_log + [AuditEntry(
                agent="documentation",
                event="error",
                payload={"error": str(e)},
                decision_actor="system",
            )],
        }

    docs: dict[str, str] = {}
    import re
    for tag, filename in [("readme", "README.md"), ("api", "API.md"), ("setup", "SETUP.md")]:
        match = re.search(rf"<{tag}>(.*?)</{tag}>", text, re.DOTALL)
        if match:
            docs[filename] = match.group(1).strip()

    log.info("[documentation] Generated %d docs (%.4f USD)", len(docs), cost)

    audit_entry = AuditEntry(
        agent="documentation",
        event="docs_generated",
        payload={
            "doc_count": len(docs),
            "doc_files": list(docs.keys()),
            "model": MODEL,
        },
        tokens_used=tokens,
        cost_usd=cost,
        decision_actor="system",
    )

    return {
        "docs": docs,
        "budget_used_usd": round(state.budget_used_usd + cost, 6),
        "next_agent": "evaluation",
        "audit_log": state.audit_log + [audit_entry],
    }
