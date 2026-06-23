"""Phase 4 backend API tests — list runs + state shape for the frontend."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from forgeflow.state import (
    ArchModule, Architecture, AuditEntry, CodeArtifact, Epic, EvalScores,
    Finding, ForgeState, Task,
)


def make_completed_state() -> ForgeState:
    epic = Epic(title="CRUD", description="...", acceptance_criteria=["c1"])
    task = Task(epic_id=epic.id, title="create", description="POST", file_path="src/a.py")
    arch = Architecture(
        stack={"framework": "FastAPI"},
        modules=[ArchModule(name="m", path="src/a.py", responsibility="..")],
        adr="Use FastAPI.",
        rationale="Async support.",
    )
    artifact = CodeArtifact(task_id=task.id, file_path="src/a.py", content="app = FastAPI()", language="python")
    return ForgeState(
        prd="# Todo API\nDescription.",
        epics=[epic],
        tasks=[task],
        architecture=arch,
        architecture_approved=True,
        code_artifacts=[artifact],
        review_findings=[
            Finding(severity="minor", category="style", description="missing docstring"),
        ],
        review_approved=True,
        docs={"README.md": "## Overview"},
        eval_scores=EvalScores(prd_coverage=0.8, review_precision=1.0, build_test_pass=0.9, doc_completeness=0.7),
        sandbox_results={"overall": {"passed": 2, "failed": 0, "errors": 0, "success": True, "exit_code": 0, "mode": "subprocess"}},
        budget_used_usd=0.05,
        next_agent="__end__",
        audit_log=[
            AuditEntry(agent="spec_analyst", event="analysis_complete", cost_usd=0.01, decision_actor="system"),
            AuditEntry(agent="architecture", event="proposal_generated", cost_usd=0.02, decision_actor="system"),
            AuditEntry(agent="architecture", event="hitl_decision", payload={"approved": True}, decision_actor="human"),
            AuditEntry(agent="evaluation", event="scoring_complete", payload={"scores": {}}, decision_actor="system"),
        ],
    )


# ── /runs (list) ───────────────────────────────────────────────────────────────

class TestListRunsEndpoint:
    async def test_list_runs_returns_recent_runs(self):
        from datetime import datetime, timezone
        from forgeflow import api

        mock_rows = [
            {
                "run_id": "abc-123",
                "first_ts": datetime.now(timezone.utc),
                "last_ts": datetime.now(timezone.utc),
                "agent_count": 4,
                "total_cost_usd": 0.05,
                "last_agent": "evaluation",
                "last_event": "scoring_complete",
            }
        ]

        with patch("forgeflow.api.list_runs", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = mock_rows
            result = await api.get_runs(limit=50)

        assert "runs" in result
        assert result["count"] == 1
        assert result["runs"][0]["run_id"] == "abc-123"
        assert result["runs"][0]["last_agent"] == "evaluation"

    async def test_list_runs_empty(self):
        from forgeflow import api

        with patch("forgeflow.api.list_runs", new_callable=AsyncMock) as mock_list:
            mock_list.return_value = []
            result = await api.get_runs()

        assert result["runs"] == []
        assert result["count"] == 0


# ── /runs/{id}/state (full state) ──────────────────────────────────────────────

class TestRunFullStateEndpoint:
    async def test_full_state_includes_all_fields(self):
        from forgeflow import api

        state = make_completed_state()
        mock_graph = MagicMock()

        # aget_state must be awaitable
        mock_snapshot = MagicMock()
        mock_snapshot.tasks = []
        mock_graph.aget_state = AsyncMock(return_value=mock_snapshot)

        with patch.object(api, "_graph", mock_graph), \
             patch("forgeflow.api.get_run_state", new_callable=AsyncMock) as mock_get_state:
            mock_get_state.return_value = state
            result = await api.get_run_full_state("abc-123")

        assert result["run_id"] == "abc-123"
        assert len(result["epics"]) == 1
        assert len(result["tasks"]) == 1
        assert result["architecture"] is not None
        assert result["architecture"]["stack"]["framework"] == "FastAPI"
        assert len(result["code_artifacts"]) == 1
        assert result["code_artifacts"][0]["has_tests"] is False
        assert result["eval_scores"] is not None
        assert result["eval_scores"]["prd_coverage"] == 0.8
        assert "audit_log" in result
        assert len(result["audit_log"]) == 4

    async def test_full_state_404_when_run_missing(self):
        from forgeflow import api
        from fastapi import HTTPException

        mock_graph = MagicMock()

        with patch.object(api, "_graph", mock_graph), \
             patch("forgeflow.api.get_run_state", new_callable=AsyncMock) as mock_get_state:
            mock_get_state.return_value = None

            with pytest.raises(HTTPException) as exc_info:
                await api.get_run_full_state("missing")

        assert exc_info.value.status_code == 404


# ── /runs/{id} status field ────────────────────────────────────────────────────

class TestRunSummaryStatus:
    async def test_status_completed_when_end_reached(self):
        from forgeflow import api

        state = make_completed_state()
        mock_graph = MagicMock()
        mock_snapshot = MagicMock()
        mock_snapshot.tasks = []
        mock_graph.aget_state = AsyncMock(return_value=mock_snapshot)

        with patch.object(api, "_graph", mock_graph), \
             patch("forgeflow.api.get_run_state", new_callable=AsyncMock) as mock_get_state:
            mock_get_state.return_value = state
            result = await api.get_run("abc")

        assert result.status == "completed"
        assert result.next_agent == "__end__"

    async def test_status_interrupted_when_interrupts_present(self):
        from forgeflow import api

        state = make_completed_state()
        state = state.model_copy(update={"next_agent": "architecture"})

        mock_graph = MagicMock()
        mock_task = MagicMock()
        mock_interrupt = MagicMock()
        mock_interrupt.value = {"type": "architecture_review", "proposal": {"stack": {"db": "pg"}}}
        mock_task.interrupts = [mock_interrupt]
        mock_snapshot = MagicMock()
        mock_snapshot.tasks = [mock_task]
        mock_graph.aget_state = AsyncMock(return_value=mock_snapshot)

        with patch.object(api, "_graph", mock_graph), \
             patch("forgeflow.api.get_run_state", new_callable=AsyncMock) as mock_get_state:
            mock_get_state.return_value = state
            result = await api.get_run("abc")

        assert result.status == "interrupted"
        assert len(result.interrupts) == 1


# ── Eval endpoint contract ─────────────────────────────────────────────────────

class TestEvalEndpointContract:
    async def test_eval_endpoint_returns_scores_and_rationales(self):
        from forgeflow import api

        state = make_completed_state()
        mock_graph = MagicMock()

        with patch.object(api, "_graph", mock_graph), \
             patch("forgeflow.api.get_run_state", new_callable=AsyncMock) as mock_get_state:
            mock_get_state.return_value = state
            result = await api.get_eval("abc")

        assert result["scores"] is not None
        assert "prd_coverage" in result["scores"]
        assert "rationales" in result

    async def test_eval_endpoint_returns_null_when_no_scores(self):
        from forgeflow import api

        state = make_completed_state()
        state = state.model_copy(update={"eval_scores": None})

        mock_graph = MagicMock()
        with patch.object(api, "_graph", mock_graph), \
             patch("forgeflow.api.get_run_state", new_callable=AsyncMock) as mock_get_state:
            mock_get_state.return_value = state
            result = await api.get_eval("abc")

        assert result["scores"] is None
        assert "message" in result
