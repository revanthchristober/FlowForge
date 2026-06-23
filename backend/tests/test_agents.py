"""Unit tests for agents — mock the LLM client, no network required."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from forgeflow.agents._llm import BudgetExceededError, _estimate_cost
from forgeflow.state import ForgeState


class TestEstimateCost:
    def test_planner_rate(self):
        cost = _estimate_cost("forge/planner", 1_000_000)
        assert abs(cost - 3.0) < 0.01  # ~$3/M tokens

    def test_worker_rate(self):
        cost = _estimate_cost("forge/worker", 1_000_000)
        assert abs(cost - 0.59) < 0.01

    def test_judge_rate(self):
        cost = _estimate_cost("forge/judge", 1_000_000)
        assert abs(cost - 0.25) < 0.01

    def test_unknown_model_falls_back_to_planner_rate(self):
        cost = _estimate_cost("unknown/model", 1_000_000)
        assert abs(cost - 3.0) < 0.01


class TestBudgetCheck:
    @pytest.mark.asyncio
    async def test_chat_json_raises_when_over_budget(self):
        from forgeflow.agents._llm import chat_json

        state = ForgeState(prd="x", budget_cap_usd=0.0, budget_used_usd=0.0)
        with pytest.raises(BudgetExceededError):
            await chat_json(state, "forge/planner", [], "test")


# ── Spec Analyst mock tests ────────────────────────────────────────────────────

MOCK_SPEC_RESPONSE = {
    "epics": [
        {
            "title": "CRUD Operations",
            "description": "Basic todo management",
            "acceptance_criteria": ["Can create a todo", "Can delete a todo"],
        }
    ],
    "tasks": [
        {
            "epic_title": "CRUD Operations",
            "title": "Implement create endpoint",
            "description": "POST /todos endpoint",
            "file_path": "src/routes/todos.py",
            "dependencies": [],
        },
        {
            "epic_title": "CRUD Operations",
            "title": "Implement list endpoint",
            "description": "GET /todos endpoint",
            "file_path": "src/routes/todos.py",
            "dependencies": [],
        },
    ],
}


@pytest.mark.asyncio
async def test_spec_analyst_happy_path(base_state):
    with patch("forgeflow.agents.spec_analyst.chat_json", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = (MOCK_SPEC_RESPONSE, 500, 0.0015)

        from forgeflow.agents.spec_analyst import run
        result = await run(base_state)

    assert result["next_agent"] == "architecture"
    assert len(result["epics"]) == 1
    assert result["epics"][0].title == "CRUD Operations"
    assert len(result["tasks"]) == 2
    assert result["tasks"][0].title == "Implement create endpoint"
    assert len(result["audit_log"]) == 1
    assert result["audit_log"][0].agent == "spec_analyst"
    assert result["audit_log"][0].event == "analysis_complete"
    assert abs(result["budget_used_usd"] - 0.0015) < 1e-9


@pytest.mark.asyncio
async def test_spec_analyst_budget_exceeded(base_state):
    broke_state = base_state.model_copy(update={"budget_used_usd": 5.0})
    from forgeflow.agents.spec_analyst import run
    result = await run(broke_state)
    assert result["next_agent"] == "budget_exceeded"


@pytest.mark.asyncio
async def test_spec_analyst_llm_error(base_state):
    with patch("forgeflow.agents.spec_analyst.chat_json", new_callable=AsyncMock) as mock_chat:
        mock_chat.side_effect = RuntimeError("connection refused")

        from forgeflow.agents.spec_analyst import run
        result = await run(base_state)

    assert result["next_agent"] == "error"
    assert "spec_analyst failed" in result["error"]


# ── Architecture mock tests ───────────────────────────────────────────────────

MOCK_ARCH_RESPONSE = {
    "stack": {
        "language": "Python 3.12",
        "framework": "FastAPI",
        "orm": "SQLAlchemy",
        "database": "PostgreSQL",
        "testing": "pytest",
    },
    "modules": [
        {"name": "routes", "path": "src/routes/", "responsibility": "HTTP handlers"},
        {"name": "models", "path": "src/models.py", "responsibility": "Data models"},
    ],
    "adr": "We chose FastAPI for its async support and automatic OpenAPI generation.",
    "rationale": "Standard Python REST API stack optimised for developer productivity.",
}


@pytest.mark.asyncio
async def test_architecture_generates_proposal_and_interrupts(state_with_epics):
    """Architecture node should generate a proposal then call interrupt().
    LangGraph 1.x: interrupt() raises GraphInterrupt (BaseException subclass).
    """
    from langgraph.errors import GraphInterrupt

    interrupt_value = None

    def capture_interrupt(val):
        nonlocal interrupt_value
        interrupt_value = val
        raise GraphInterrupt((val,))  # GraphInterrupt wraps values in a tuple

    with patch("forgeflow.agents.architecture.chat_json", new_callable=AsyncMock) as mock_chat, \
         patch("forgeflow.agents.architecture.interrupt", side_effect=capture_interrupt):
        mock_chat.return_value = (MOCK_ARCH_RESPONSE, 800, 0.0024)

        from forgeflow.agents.architecture import run
        with pytest.raises(GraphInterrupt):
            await run(state_with_epics)

    assert interrupt_value is not None
    assert interrupt_value["type"] == "architecture_review"
    assert "proposal" in interrupt_value
    assert interrupt_value["proposal"]["stack"]["framework"] == "FastAPI"


@pytest.mark.asyncio
async def test_architecture_budget_exceeded(state_with_epics):
    broke = state_with_epics.model_copy(update={"budget_used_usd": 5.0})
    from forgeflow.agents.architecture import run
    result = await run(broke)
    assert result["next_agent"] == "budget_exceeded"


@pytest.mark.asyncio
async def test_architecture_max_revisions_auto_approves(state_with_epics):
    """After MAX_REVISIONS attempts, architecture node auto-approves."""
    from forgeflow.agents.architecture import MAX_REVISIONS, run

    max_rev_state = state_with_epics.model_copy(
        update={"architecture_revision_count": MAX_REVISIONS}
    )
    result = await run(max_rev_state)
    assert result["next_agent"] == "code_generation"
    assert result["architecture_approved"] is True


# ── Routing via next_agent ────────────────────────────────────────────────────

class TestRouting:
    def test_route_field_drives_next_node(self):
        """next_agent Literal field is the single routing mechanism — verify it."""
        from forgeflow.graph import route_from_state

        for agent in ["spec_analyst", "architecture", "code_generation",
                      "code_review", "documentation", "evaluation",
                      "__end__", "budget_exceeded", "error"]:
            s = ForgeState(prd="x", next_agent=agent)
            assert route_from_state(s) == agent
