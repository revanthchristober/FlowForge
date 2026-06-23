"""
Phase 1 integration tests — real Postgres checkpointer, mocked LLM.

These tests prove the checklist items:
  ✓ PRD → spec_analyst → tasks produced
  ✓ architecture generates proposal, graph pauses at interrupt
  ✓ checkpoint is persisted to Postgres
  ✓ Simulate kill: create NEW graph instance with same thread_id → resume
  ✓ Approve → state advances past HITL gate to code_generation stub
  ✓ Revise → graph loops back to architecture
  ✓ Budget cap halts graph before LLM call
"""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio

from forgeflow.state import ForgeState

# pg_graph fixture is defined in conftest.py and shared across all test files

# ── Mock data ─────────────────────────────────────────────────────────────────

MOCK_SPEC = {
    "epics": [
        {
            "title": "CRUD Operations",
            "description": "Todo lifecycle management",
            "acceptance_criteria": ["Can create a todo", "Can delete a todo"],
        }
    ],
    "tasks": [
        {
            "epic_title": "CRUD Operations",
            "title": "Implement create endpoint",
            "description": "POST /todos",
            "file_path": "src/routes/todos.py",
            "dependencies": [],
        },
        {
            "epic_title": "CRUD Operations",
            "title": "Implement list endpoint",
            "description": "GET /todos",
            "file_path": "src/routes/todos.py",
            "dependencies": [],
        },
    ],
}

MOCK_ARCH = {
    "stack": {
        "language": "Python 3.12",
        "framework": "FastAPI",
        "orm": "SQLAlchemy",
        "database": "PostgreSQL",
        "testing": "pytest",
    },
    "modules": [
        {"name": "routes", "path": "src/routes/", "responsibility": "HTTP handlers"},
    ],
    "adr": "FastAPI chosen for async support and automatic OpenAPI docs.",
    "rationale": "Standard Python REST API stack.",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _stream_to_completion(graph, input_, config):
    """Run graph until it pauses (interrupt) or ends. Return final state dict."""
    final = {}
    async for chunk in graph.astream(input_, config=config, stream_mode="values"):
        final = chunk
    return final


def _get_interrupts(snapshot):
    """Extract interrupt values from a graph state snapshot."""
    interrupts = []
    if snapshot and snapshot.tasks:
        for task in snapshot.tasks:
            if hasattr(task, "interrupts"):
                for intr in task.interrupts:
                    interrupts.append(intr.value)
    return interrupts


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_full_spine_approve(pg_graph):
    """
    Full Phase 1 happy path:
    PRD → spec_analyst → architecture → [HITL pause] → approve → code_generation stub → end
    """
    run_id = f"test-approve-{uuid.uuid4().hex[:8]}"
    config = {"configurable": {"thread_id": run_id}}
    initial = ForgeState(run_id=run_id, prd="Build a simple todo API", budget_cap_usd=10.0)

    with patch("forgeflow.agents.spec_analyst.chat_json", new_callable=AsyncMock) as mock_spec, \
         patch("forgeflow.agents.architecture.chat_json", new_callable=AsyncMock) as mock_arch:

        mock_spec.return_value = (MOCK_SPEC, 500, 0.0015)
        mock_arch.return_value = (MOCK_ARCH, 800, 0.0024)

        # ── Run 1: should pause at architecture HITL ──────────────────────────
        state = await _stream_to_completion(pg_graph, initial, config)

        assert len(state["epics"]) == 1, "Spec analyst should have produced epics"
        assert len(state["tasks"]) == 2, "Spec analyst should have produced tasks"
        # Note: architecture is NOT in state at pause — LangGraph only commits state
        # when a node returns. interrupt() suspends BEFORE the node returns.

        # Verify graph is paused
        snapshot = await pg_graph.aget_state(config)
        interrupts = _get_interrupts(snapshot)
        assert len(interrupts) == 1, f"Expected 1 interrupt, got {interrupts}"
        assert interrupts[0]["type"] == "architecture_review"
        assert interrupts[0]["proposal"]["stack"]["framework"] == "FastAPI"

        # Verify audit log has spec_analyst entry (architecture entry comes after resume)
        audit = state["audit_log"]
        # audit items are AuditEntry objects when state uses Pydantic BaseModel
        agents_logged = {(e.agent if hasattr(e, "agent") else e["agent"]) for e in audit}
        assert "spec_analyst" in agents_logged

        # ── Resume: approve the architecture ─────────────────────────────────
        from langgraph.types import Command
        state2 = await _stream_to_completion(
            pg_graph, Command(resume={"approve": True}), config
        )

        assert state2["architecture_approved"] is True
        assert state2["next_agent"] == "__end__"

        # Human decision recorded in audit log
        def _get(entry, key):
            return getattr(entry, key) if hasattr(entry, key) else entry[key]

        human_entries = [e for e in state2["audit_log"] if _get(e, "decision_actor") == "human"]
        assert len(human_entries) >= 1
        assert any(_get(e, "event") == "hitl_decision" for e in human_entries)


@pytest.mark.asyncio
async def test_checkpoint_survives_kill_restart(pg_graph):
    """
    Kill-and-resume test:
    1. Start a run, pause at architecture HITL
    2. Create a BRAND NEW graph instance (same DB, same thread_id) — simulates process kill+restart
    3. Resume on the new instance → state continues correctly
    """
    run_id = f"test-kill-{uuid.uuid4().hex[:8]}"
    config = {"configurable": {"thread_id": run_id}}
    initial = ForgeState(run_id=run_id, prd="Build a webhook dispatcher", budget_cap_usd=10.0)

    with patch("forgeflow.agents.spec_analyst.chat_json", new_callable=AsyncMock) as mock_spec, \
         patch("forgeflow.agents.architecture.chat_json", new_callable=AsyncMock) as mock_arch:

        mock_spec.return_value = (MOCK_SPEC, 500, 0.0015)
        mock_arch.return_value = (MOCK_ARCH, 800, 0.0024)

        # Run until paused
        await _stream_to_completion(pg_graph, initial, config)

        snapshot = await pg_graph.aget_state(config)
        interrupts = _get_interrupts(snapshot)
        assert len(interrupts) == 1, "Should be paused at HITL"

    # ── Simulate process kill: create a COMPLETELY NEW graph instance ─────────
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from langgraph.types import Command
    from forgeflow.config import settings
    from forgeflow.graph import build_graph

    async with AsyncPostgresSaver.from_conn_string(settings.DATABASE_URL) as new_checkpointer:
        await new_checkpointer.setup()
        new_graph = build_graph(new_checkpointer)

        # Verify new instance can read the checkpoint
        snapshot2 = await new_graph.aget_state(config)
        assert snapshot2 is not None, "New graph instance must find checkpoint in Postgres"
        interrupts2 = _get_interrupts(snapshot2)
        assert len(interrupts2) == 1, "Checkpoint should still show interrupt after kill"

        with patch("forgeflow.agents.architecture.chat_json", new_callable=AsyncMock) as mock_arch2:
            mock_arch2.return_value = (MOCK_ARCH, 800, 0.0024)
            state = await _stream_to_completion(
                new_graph, Command(resume={"approve": True}), config
            )

        assert state["architecture_approved"] is True, "Should approve after resume"
        assert state["next_agent"] == "__end__"


@pytest.mark.asyncio
async def test_architecture_revise_then_approve(pg_graph):
    """
    HITL revision loop:
    1. Run → architecture HITL pause
    2. Resume with revise + notes
    3. Architecture regenerates → second HITL pause
    4. Approve on second attempt
    """
    run_id = f"test-revise-{uuid.uuid4().hex[:8]}"
    config = {"configurable": {"thread_id": run_id}}
    initial = ForgeState(run_id=run_id, prd="Build an invoice parser", budget_cap_usd=10.0)

    with patch("forgeflow.agents.spec_analyst.chat_json", new_callable=AsyncMock) as mock_spec, \
         patch("forgeflow.agents.architecture.chat_json", new_callable=AsyncMock) as mock_arch:

        mock_spec.return_value = (MOCK_SPEC, 500, 0.0015)
        mock_arch.return_value = (MOCK_ARCH, 800, 0.0024)

        await _stream_to_completion(pg_graph, initial, config)

        # First HITL: revise
        from langgraph.types import Command
        await _stream_to_completion(
            pg_graph,
            Command(resume={"approve": False, "notes": "Please use SQLite instead of PostgreSQL"}),
            config,
        )

        # Graph should re-run architecture and pause again
        snapshot = await pg_graph.aget_state(config)
        interrupts = _get_interrupts(snapshot)
        assert len(interrupts) == 1, f"Should pause at 2nd HITL, got: {interrupts}"

        # Check revision count incremented
        state_vals = snapshot.values
        assert state_vals["architecture_revision_count"] == 1
        assert "SQLite" in state_vals.get("architecture_revision_notes", "")

        # Approve on second attempt
        state_final = await _stream_to_completion(
            pg_graph, Command(resume={"approve": True}), config
        )
        assert state_final["architecture_approved"] is True


@pytest.mark.asyncio
async def test_budget_cap_halts_before_spec_analyst(pg_graph):
    """Budget cap set to 0 should halt before any LLM call."""
    run_id = f"test-budget-{uuid.uuid4().hex[:8]}"
    config = {"configurable": {"thread_id": run_id}}
    initial = ForgeState(run_id=run_id, prd="Build something", budget_cap_usd=0.0)

    with patch("forgeflow.agents.spec_analyst.chat_json", new_callable=AsyncMock) as mock_spec:
        mock_spec.return_value = (MOCK_SPEC, 500, 0.0015)
        state = await _stream_to_completion(pg_graph, initial, config)

    assert state["next_agent"] == "__end__"

    def _get(entry, key):
        return getattr(entry, key) if hasattr(entry, key) else entry[key]

    assert any(_get(e, "event") == "budget_exceeded" for e in state["audit_log"])
    # LLM should never have been called
    mock_spec.assert_not_called()


@pytest.mark.asyncio
async def test_audit_log_completeness(pg_graph):
    """Every agent transition must write at least one audit entry."""
    run_id = f"test-audit-{uuid.uuid4().hex[:8]}"
    config = {"configurable": {"thread_id": run_id}}
    initial = ForgeState(run_id=run_id, prd="Build a CRM", budget_cap_usd=10.0)

    with patch("forgeflow.agents.spec_analyst.chat_json", new_callable=AsyncMock) as mock_spec, \
         patch("forgeflow.agents.architecture.chat_json", new_callable=AsyncMock) as mock_arch:

        mock_spec.return_value = (MOCK_SPEC, 500, 0.0015)
        mock_arch.return_value = (MOCK_ARCH, 800, 0.0024)

        await _stream_to_completion(pg_graph, initial, config)

        from langgraph.types import Command
        final = await _stream_to_completion(
            pg_graph, Command(resume={"approve": True}), config
        )

    audit = final["audit_log"]
    assert len(audit) >= 3, f"Expected ≥3 audit entries, got {len(audit)}"

    def _get(entry, key):
        return getattr(entry, key) if hasattr(entry, key) else entry[key]

    agents_seen = {_get(e, "agent") for e in audit}
    assert "spec_analyst" in agents_seen
    assert "architecture" in agents_seen

    # Every entry must have a timestamp
    for entry in audit:
        assert _get(entry, "ts"), f"Missing timestamp in audit entry: {entry}"
