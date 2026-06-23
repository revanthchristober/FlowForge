"""Phase 3 evaluation agent tests."""

import pytest
from unittest.mock import patch

from forgeflow.state import EvalScores, Finding, ForgeState, Task, Epic


def make_todo_state() -> ForgeState:
    """State matching the todo_api golden PRD."""
    tasks = [
        Task(epic_id="e1", title="create endpoint", description="POST /todos", file_path="src/create.py"),
        Task(epic_id="e1", title="list endpoint", description="GET /todos", file_path="src/list.py"),
        Task(epic_id="e1", title="get by id", description="GET /todos/:id", file_path="src/get.py"),
        Task(epic_id="e1", title="update endpoint", description="PATCH /todos/:id", file_path="src/update.py"),
        Task(epic_id="e1", title="delete endpoint", description="DELETE /todos/:id", file_path="src/delete.py"),
        Task(epic_id="e2", title="filter by status", description="Filter todos", file_path="src/filter.py"),
        Task(epic_id="e3", title="validation logic", description="Validate input", file_path="src/validation.py"),
    ]
    return ForgeState(
        prd="# Todo API — Product Requirements Document\n\n## Overview\nA REST API for todos.",
        tasks=tasks,
        docs={
            "README.md": "## Overview\nTodo API.\n## Install\nnpm install\n## Run\npython main.py\n## API\nREST\n## Environment\nSet vars",
        },
        sandbox_results={"overall": {
            "passed": 5, "failed": 0, "errors": 0, "success": True, "exit_code": 0, "mode": "subprocess"
        }},
        review_findings=[],
    )


class TestEvaluation:
    async def test_skips_non_golden_prd(self):
        from forgeflow.agents.evaluation import run
        state = ForgeState(prd="# Internal Spike\n\nNot a real PRD, just an experiment.")

        with patch("forgeflow.agents.evaluation.match_prd_to_golden", return_value=None):
            result = await run(state)

        assert result["eval_scores"] is None
        assert result["next_agent"] == "__end__"
        last = result["audit_log"][-1]
        assert last.event == "skipped_not_golden"

    async def test_scores_golden_prd(self):
        from forgeflow.agents.evaluation import run
        state = make_todo_state()

        result = await run(state)

        assert result["next_agent"] == "__end__"
        eval_scores = result["eval_scores"]
        assert eval_scores is not None
        assert isinstance(eval_scores, EvalScores)
        assert eval_scores.prd_coverage is not None
        assert eval_scores.review_precision is not None
        assert eval_scores.build_test_pass is not None
        assert eval_scores.doc_completeness is not None

    async def test_all_4_score_fields_set(self):
        from forgeflow.agents.evaluation import run
        state = make_todo_state()
        result = await run(state)
        es = result["eval_scores"]
        assert 0.0 <= es.prd_coverage <= 1.0
        assert 0.0 <= es.review_precision <= 1.0
        assert 0.0 <= es.build_test_pass <= 1.0
        assert 0.0 <= es.doc_completeness <= 1.0

    async def test_audit_entry_contains_rationales(self):
        from forgeflow.agents.evaluation import run
        state = make_todo_state()
        result = await run(state)

        last = result["audit_log"][-1]
        assert last.agent == "evaluation"
        assert last.event == "scoring_complete"
        assert "rationales" in last.payload
        assert "scores" in last.payload
        assert "prd_coverage" in last.payload["rationales"]

    async def test_next_agent_is_end(self):
        from forgeflow.agents.evaluation import run
        state = make_todo_state()
        result = await run(state)
        assert result["next_agent"] == "__end__"

    async def test_overall_score_computed(self):
        from forgeflow.agents.evaluation import run
        state = make_todo_state()
        result = await run(state)
        assert result["eval_scores"].overall is not None
        assert 0.0 <= result["eval_scores"].overall <= 1.0

    async def test_threshold_results_in_audit(self):
        from forgeflow.agents.evaluation import run
        state = make_todo_state()
        result = await run(state)
        last = result["audit_log"][-1]
        assert "thresholds_passed" in last.payload
        assert isinstance(last.payload["thresholds_passed"], dict)
