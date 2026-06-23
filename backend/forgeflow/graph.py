"""ForgeFlow LangGraph — StateGraph wiring with Postgres checkpointer."""

from __future__ import annotations

import logging
from typing import Any

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command

from forgeflow.agents import (
    architecture,
    code_generation,
    code_review,
    documentation,
    evaluation,
    spec_analyst,
)
from forgeflow.config import settings
from forgeflow.state import AuditEntry, ForgeState

log = logging.getLogger(__name__)


# ── Routing ────────────────────────────────────────────────────────────────────

def route_from_state(state: ForgeState) -> str:
    """Conditional edge: read next_agent from state to determine next node."""
    return state.next_agent


# ── Terminal / error nodes ─────────────────────────────────────────────────────

async def budget_exceeded_node(state: ForgeState) -> dict:
    log.warning("[budget_exceeded] Run %s halted — budget cap reached", state.run_id)
    return {
        "next_agent": "__end__",
        "audit_log": state.audit_log + [AuditEntry(
            agent="system",
            event="run_halted_budget_exceeded",
            payload={"budget_used": state.budget_used_usd, "cap": state.budget_cap_usd},
            decision_actor="system",
        )],
    }


async def error_node(state: ForgeState) -> dict:
    log.error("[error] Run %s errored: %s", state.run_id, state.error)
    return {
        "next_agent": "__end__",
        "audit_log": state.audit_log + [AuditEntry(
            agent="system",
            event="run_errored",
            payload={"error": state.error or "unknown"},
            decision_actor="system",
        )],
    }



# ── Graph builder ──────────────────────────────────────────────────────────────

ALL_NEXT_AGENTS = [
    "spec_analyst",
    "architecture",
    "code_generation",
    "code_review",
    "documentation",
    "evaluation",
    "__end__",
    "budget_exceeded",
    "error",
]


def build_graph(checkpointer: AsyncPostgresSaver) -> Any:
    """Build and compile the ForgeFlow StateGraph."""
    builder = StateGraph(ForgeState)

    # ── Nodes ──────────────────────────────────────────────────────────────────
    builder.add_node("spec_analyst", spec_analyst.run)
    builder.add_node("architecture", architecture.run)
    builder.add_node("code_generation", code_generation.run)
    builder.add_node("code_review", code_review.run)
    builder.add_node("documentation", documentation.run)
    builder.add_node("evaluation", evaluation.run)
    builder.add_node("budget_exceeded", budget_exceeded_node)
    builder.add_node("error", error_node)

    # ── Edges ──────────────────────────────────────────────────────────────────
    builder.add_edge(START, "spec_analyst")

    # All routing goes through the Literal-typed next_agent field
    for node_name in [
        "spec_analyst",
        "architecture",
        "code_generation",
        "code_review",
        "documentation",
        "evaluation",
        "budget_exceeded",
        "error",
    ]:
        builder.add_conditional_edges(
            node_name,
            route_from_state,
            {agent: agent if agent != "__end__" else END for agent in ALL_NEXT_AGENTS},
        )

    return builder.compile(checkpointer=checkpointer)


# ── Checkpointer context manager ───────────────────────────────────────────────

def get_checkpointer_cm():
    """Return the AsyncPostgresSaver context manager. Use with `async with`."""
    return AsyncPostgresSaver.from_conn_string(settings.DATABASE_URL)


# ── Run helpers ────────────────────────────────────────────────────────────────

async def start_run(graph: Any, run_id: str, prd: str, budget_cap: float = 5.0) -> dict:
    """Start a new ForgeFlow run. Returns the state after first checkpoint."""
    config = {"configurable": {"thread_id": run_id}}
    initial = ForgeState(run_id=run_id, prd=prd, budget_cap_usd=budget_cap)

    final_state: dict = {}
    async for chunk in graph.astream(initial, config=config, stream_mode="values"):
        final_state = chunk

    return final_state


async def resume_run(graph: Any, run_id: str, decision: dict) -> dict:
    """Resume a paused run (HITL gate) with a human decision."""
    config = {"configurable": {"thread_id": run_id}}

    final_state: dict = {}
    async for chunk in graph.astream(
        Command(resume=decision),
        config=config,
        stream_mode="values",
    ):
        final_state = chunk

    return final_state


async def get_run_state(graph: Any, run_id: str) -> dict | None:
    """Return current state snapshot for a run."""
    import asyncio
    config = {"configurable": {"thread_id": run_id}}
    try:
        snapshot = await asyncio.wait_for(graph.aget_state(config), timeout=15.0)
    except asyncio.TimeoutError:
        log.warning("[graph] aget_state timed out for run %s", run_id)
        return None
    if snapshot is None:
        return None
    return snapshot.values
