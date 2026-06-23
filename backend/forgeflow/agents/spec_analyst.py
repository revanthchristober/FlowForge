"""Spec Analyst Agent — PRD → epics + tasks."""

from __future__ import annotations

import logging

from forgeflow.agents._llm import BudgetExceededError, chat_json
from forgeflow.state import AuditEntry, Epic, ForgeState, Task
from forgeflow.tracing import observe

log = logging.getLogger(__name__)

MODEL = "forge/planner"

SYSTEM_PROMPT = """\
You are a senior software architect acting as a Spec Analyst.

Given a Product Requirements Document (PRD), decompose it into:
1. Epics — high-level functional areas (2–6 epics per PRD)
2. Tasks — concrete implementation items, each mapped to a single file path
3. Acceptance criteria — 2–4 testable criteria per epic

Rules:
- Each task must map to exactly one source file
- Task descriptions must be actionable (start with a verb: "Implement", "Create", "Add")
- Keep epics at the feature level, tasks at the function/class level
- Total tasks: 5–15 depending on PRD complexity

Output ONLY a JSON object matching this exact schema:
{
  "epics": [
    {
      "title": "string",
      "description": "string",
      "acceptance_criteria": ["string"]
    }
  ],
  "tasks": [
    {
      "epic_title": "string",
      "title": "string",
      "description": "string",
      "file_path": "string",
      "dependencies": []
    }
  ]
}
"""


@observe(name="spec_analyst")
async def run(state: ForgeState) -> dict:
    """LangGraph node: analyse PRD and return structured epics + tasks."""
    log.info("[spec_analyst] Starting analysis for run %s", state.run_id)

    if not state.within_budget():
        return {
            "next_agent": "budget_exceeded",
            "audit_log": state.audit_log + [AuditEntry(
                agent="spec_analyst", event="budget_exceeded",
                payload={"budget_used": state.budget_used_usd, "cap": state.budget_cap_usd},
                decision_actor="system",
            )],
        }

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Analyse this PRD:\n\n{state.prd}"},
    ]

    try:
        data, tokens, cost = await chat_json(
            state, MODEL, messages, "spec-analyst-analysis"
        )
    except BudgetExceededError as e:
        log.warning("[spec_analyst] Budget exceeded: %s", e)
        return {
            "next_agent": "budget_exceeded",
            "error": str(e),
            "audit_log": state.audit_log + [AuditEntry(
                agent="spec_analyst", event="budget_exceeded",
                payload={"error": str(e)}, decision_actor="system",
            )],
        }
    except Exception as e:
        log.error("[spec_analyst] LLM error: %s", e)
        return {
            "next_agent": "error",
            "error": f"spec_analyst failed: {e}",
            "audit_log": state.audit_log + [AuditEntry(
                agent="spec_analyst", event="error",
                payload={"error": str(e)}, decision_actor="system",
            )],
        }

    # Build epic index by title for task→epic linkage
    raw_epics = data.get("epics", [])
    epic_title_map: dict[str, str] = {}
    epics: list[Epic] = []
    for raw in raw_epics:
        epic = Epic(
            title=raw["title"],
            description=raw["description"],
            acceptance_criteria=raw.get("acceptance_criteria", []),
        )
        epics.append(epic)
        epic_title_map[epic.title] = epic.id

    tasks: list[Task] = []
    for raw in data.get("tasks", []):
        epic_id = epic_title_map.get(raw.get("epic_title", ""), "")
        if not epic_id and epics:
            epic_id = epics[0].id  # fallback to first epic
        tasks.append(Task(
            epic_id=epic_id,
            title=raw["title"],
            description=raw["description"],
            file_path=raw.get("file_path", f"src/{raw['title'].lower().replace(' ', '_')}.py"),
            dependencies=raw.get("dependencies", []),
        ))

    audit_entry = AuditEntry(
        agent="spec_analyst",
        event="analysis_complete",
        payload={"epic_count": len(epics), "task_count": len(tasks)},
        tokens_used=tokens,
        cost_usd=cost,
        decision_actor="system",
    )

    log.info("[spec_analyst] Produced %d epics, %d tasks (%.4f USD)", len(epics), len(tasks), cost)

    return {
        "epics": epics,
        "tasks": tasks,
        "budget_used_usd": round(state.budget_used_usd + cost, 6),
        "next_agent": "architecture",
        "audit_log": state.audit_log + [audit_entry],
    }
