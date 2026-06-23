"""Architecture Agent — epics/tasks → proposed stack + HITL approval gate."""

from __future__ import annotations

import logging

from langgraph.types import interrupt

from forgeflow.agents._llm import BudgetExceededError, chat_json
from forgeflow.state import ArchModule, Architecture, AuditEntry, ForgeState
from forgeflow.tracing import observe

log = logging.getLogger(__name__)

MODEL = "forge/planner"
MAX_REVISIONS = 3

SYSTEM_PROMPT = """\
You are a principal software architect.

Given a set of epics and implementation tasks, propose:
1. A tech stack (map of layer → technology choice with rationale)
2. A module layout (list of modules with name, file path, and responsibility)
3. An ADR (Architecture Decision Record) — 2–4 paragraphs explaining key choices
4. A rationale summary (1 paragraph)

Output ONLY a JSON object matching this exact schema:
{
  "stack": {
    "language": "Python 3.12",
    "framework": "FastAPI",
    "orm": "...",
    "database": "...",
    "testing": "pytest"
  },
  "modules": [
    {
      "name": "string",
      "path": "string",
      "responsibility": "string"
    }
  ],
  "adr": "string",
  "rationale": "string"
}
"""


def _build_context(state: ForgeState) -> str:
    epics_text = "\n".join(
        f"- {e.title}: {e.description}" for e in state.epics
    )
    tasks_text = "\n".join(
        f"  [{t.file_path}] {t.title}: {t.description}" for t in state.tasks
    )
    notes = ""
    if state.architecture_revision_notes:
        notes = f"\n\nRevision notes from human reviewer:\n{state.architecture_revision_notes}"
    return f"Epics:\n{epics_text}\n\nTasks:\n{tasks_text}{notes}"


@observe(name="architecture")
async def run(state: ForgeState) -> dict:
    """LangGraph node: generate architecture, then pause for HITL approval."""
    log.info(
        "[architecture] Generating proposal (revision %d) for run %s",
        state.architecture_revision_count,
        state.run_id,
    )

    if not state.within_budget():
        return {
            "next_agent": "budget_exceeded",
            "audit_log": state.audit_log + [AuditEntry(
                agent="architecture", event="budget_exceeded",
                payload={"budget_used": state.budget_used_usd},
                decision_actor="system",
            )],
        }

    if state.architecture_revision_count >= MAX_REVISIONS:
        log.warning("[architecture] Max revisions (%d) reached, auto-approving", MAX_REVISIONS)
        return {
            "architecture_approved": True,
            "next_agent": "code_generation",
            "audit_log": state.audit_log + [AuditEntry(
                agent="architecture", event="auto_approved_max_revisions",
                payload={"revision_count": state.architecture_revision_count},
                decision_actor="system",
            )],
        }

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Design the architecture for this project:\n\n{_build_context(state)}"},
    ]

    try:
        data, tokens, cost = await chat_json(
            state, MODEL, messages, "architecture-proposal"
        )
    except BudgetExceededError as e:
        return {
            "next_agent": "budget_exceeded",
            "error": str(e),
            "audit_log": state.audit_log + [AuditEntry(
                agent="architecture", event="budget_exceeded",
                payload={"error": str(e)}, decision_actor="system",
            )],
        }
    except Exception as e:
        log.error("[architecture] LLM error: %s", e)
        return {
            "next_agent": "error",
            "error": f"architecture failed: {e}",
            "audit_log": state.audit_log + [AuditEntry(
                agent="architecture", event="error",
                payload={"error": str(e)}, decision_actor="system",
            )],
        }

    modules = [
        ArchModule(
            name=m["name"],
            path=m.get("path", ""),
            responsibility=m.get("responsibility", ""),
        )
        for m in data.get("modules", [])
    ]

    proposal = Architecture(
        stack=data.get("stack", {}),
        modules=modules,
        adr=data.get("adr", ""),
        rationale=data.get("rationale", ""),
    )

    pre_hitl_entry = AuditEntry(
        agent="architecture",
        event="proposal_generated",
        payload={"stack": proposal.stack, "module_count": len(proposal.modules)},
        tokens_used=tokens,
        cost_usd=cost,
        decision_actor="system",
    )
    updated_log = state.audit_log + [pre_hitl_entry]
    updated_budget = round(state.budget_used_usd + cost, 6)

    # ── HITL GATE ─────────────────────────────────────────────────────────────
    # Graph pauses here. Postgres checkpoint is written.
    # Resume via: Command(resume={"approve": True}) or Command(resume={"approve": False, "notes": "..."})
    decision: dict = interrupt({
        "type": "architecture_review",
        "run_id": state.run_id,
        "proposal": {
            "stack": proposal.stack,
            "modules": [m.model_dump() for m in proposal.modules],
            "adr": proposal.adr,
            "rationale": proposal.rationale,
        },
        "revision_count": state.architecture_revision_count,
    })

    approved: bool = decision.get("approve", False)
    notes: str = decision.get("notes", "")

    human_entry = AuditEntry(
        agent="architecture",
        event="hitl_decision",
        payload={"approved": approved, "notes": notes},
        decision_actor="human",
    )
    updated_log = updated_log + [human_entry]

    if approved:
        log.info("[architecture] Approved by human")
        return {
            "architecture": proposal,
            "architecture_approved": True,
            "budget_used_usd": updated_budget,
            "next_agent": "code_generation",
            "audit_log": updated_log,
        }
    else:
        log.info("[architecture] Revision requested: %s", notes)
        return {
            "architecture": proposal,
            "architecture_approved": False,
            "architecture_revision_count": state.architecture_revision_count + 1,
            "architecture_revision_notes": notes,
            "budget_used_usd": updated_budget,
            "next_agent": "architecture",  # loop back
            "audit_log": updated_log,
        }
