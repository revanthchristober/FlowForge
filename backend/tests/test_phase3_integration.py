"""Phase 3 integration tests — full pipeline including documentation + evaluation."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from forgeflow.state import (
    ArchModule, Architecture, AuditEntry, CodeArtifact, Epic, ForgeState, Task
)


# ── Helpers ────────────────────────────────────────────────────────────────────

MOCK_DOC_RESPONSE = {
    "readme": "## Overview\nA todo API.\n## Install\npip install\n## Run\npython main.py\n## Environment\nSet vars",
    "api": "## Overview\nREST API.\n## API\nEndpoints.\n## Endpoints\nGET /todos",
    "setup": "## Overview\nSetup.\n## Install\nuv sync\n## Environment\nSet keys\n## Run\nmake dev",
}


def make_state_after_review() -> ForgeState:
    """Simulate the state at the code_review → documentation handoff."""
    epic = Epic(title="Todo CRUD", description="CRUD ops", acceptance_criteria=["Create"])
    task = Task(
        epic_id=epic.id, title="create endpoint",
        description="POST /todos", file_path="src/create.py"
    )
    arch = Architecture(
        stack={"framework": "FastAPI", "database": "SQLite"},
        modules=[ArchModule(name="todos", path="src/todos.py", responsibility="CRUD")],
        adr="Use FastAPI.",
        rationale="Simple and fast.",
    )
    artifact = CodeArtifact(
        task_id=task.id, file_path="src/create.py",
        content="from fastapi import FastAPI\napp = FastAPI()",
        language="python",
    )
    return ForgeState(
        prd="# Todo API — Product Requirements Document\n\n## Overview\nA REST API for todos.",
        epics=[epic],
        tasks=[task],
        architecture=arch,
        architecture_approved=True,
        code_artifacts=[artifact],
        review_approved=True,
        review_findings=[],
        sandbox_results={"overall": {
            "passed": 2, "failed": 0, "errors": 0, "success": True, "exit_code": 0, "mode": "subprocess"
        }},
        budget_cap_usd=5.0,
        budget_used_usd=0.10,
        next_agent="documentation",
        audit_log=[
            AuditEntry(agent="spec_analyst", event="analysis_complete", decision_actor="system"),
            AuditEntry(agent="architecture", event="proposal_generated", decision_actor="system"),
            AuditEntry(agent="architecture", event="hitl_decision", payload={"approved": True}, decision_actor="human"),
            AuditEntry(agent="code_generation", event="generation_complete", decision_actor="system"),
            AuditEntry(agent="code_review", event="hitl_decision", payload={"approved": True}, decision_actor="human"),
        ],
    )


class TestDocumentationToEvalPipeline:
    """Test the documentation → evaluation flow end-to-end with mocked LLM."""

    async def test_documentation_then_evaluation_full_flow(self):
        """Full pipeline: docs generated → evaluation scored → __end__."""
        from forgeflow.agents.documentation import run as docs_run
        from forgeflow.agents.evaluation import run as eval_run

        state = make_state_after_review()

        # Step 1: documentation agent
        with patch("forgeflow.agents.documentation.chat_json", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = (MOCK_DOC_RESPONSE, 400, 0.001)
            docs_result = await docs_run(state)

        assert docs_result["next_agent"] == "evaluation"
        assert len(docs_result["docs"]) == 3

        # Apply docs to state
        state_with_docs = state.model_copy(update={
            "docs": docs_result["docs"],
            "budget_used_usd": docs_result["budget_used_usd"],
            "audit_log": docs_result["audit_log"],
        })

        # Step 2: evaluation agent (no mock needed — deterministic)
        eval_result = await eval_run(state_with_docs)

        assert eval_result["next_agent"] == "__end__"
        assert eval_result["eval_scores"] is not None
        assert eval_result["eval_scores"].overall is not None

    async def test_eval_scores_all_four_fields(self):
        from forgeflow.agents.documentation import run as docs_run
        from forgeflow.agents.evaluation import run as eval_run

        state = make_state_after_review()

        with patch("forgeflow.agents.documentation.chat_json", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = (MOCK_DOC_RESPONSE, 400, 0.001)
            docs_result = await docs_run(state)

        state_with_docs = state.model_copy(update={
            "docs": docs_result["docs"],
            "budget_used_usd": docs_result["budget_used_usd"],
            "audit_log": docs_result["audit_log"],
        })

        eval_result = await eval_run(state_with_docs)
        es = eval_result["eval_scores"]

        assert es.prd_coverage is not None
        assert es.review_precision is not None
        assert es.build_test_pass is not None
        assert es.doc_completeness is not None

    async def test_full_audit_trail_after_phase3(self):
        from forgeflow.agents.documentation import run as docs_run
        from forgeflow.agents.evaluation import run as eval_run

        state = make_state_after_review()
        initial_audit_count = len(state.audit_log)

        with patch("forgeflow.agents.documentation.chat_json", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = (MOCK_DOC_RESPONSE, 400, 0.001)
            docs_result = await docs_run(state)

        state_with_docs = state.model_copy(update={
            "docs": docs_result["docs"],
            "budget_used_usd": docs_result["budget_used_usd"],
            "audit_log": docs_result["audit_log"],
        })

        eval_result = await eval_run(state_with_docs)
        final_log = eval_result["audit_log"]

        # Should have: 5 pre-existing + 1 docs + 1 eval = 7
        assert len(final_log) == initial_audit_count + 2

        agents_in_log = [e.agent for e in final_log]
        assert "documentation" in agents_in_log
        assert "evaluation" in agents_in_log

    async def test_evaluation_rationales_in_audit(self):
        from forgeflow.agents.documentation import run as docs_run
        from forgeflow.agents.evaluation import run as eval_run

        state = make_state_after_review()

        with patch("forgeflow.agents.documentation.chat_json", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = (MOCK_DOC_RESPONSE, 400, 0.001)
            docs_result = await docs_run(state)

        state_with_docs = state.model_copy(update={
            "docs": docs_result["docs"],
            "audit_log": docs_result["audit_log"],
            "budget_used_usd": docs_result["budget_used_usd"],
        })

        eval_result = await eval_run(state_with_docs)

        eval_entry = next(
            e for e in eval_result["audit_log"]
            if e.agent == "evaluation" and e.event == "scoring_complete"
        )
        assert "prd_coverage" in eval_entry.payload["rationales"]
        assert "build_test_pass" in eval_entry.payload["rationales"]
        assert "doc_completeness" in eval_entry.payload["rationales"]

    async def test_eval_skips_docs_gracefully_on_budget_exceeded(self):
        """Even with docs skipped, evaluation still runs."""
        from forgeflow.agents.documentation import run as docs_run
        from forgeflow.agents.evaluation import run as eval_run

        state = make_state_after_review()
        state = state.model_copy(update={"budget_used_usd": 10.0})  # bust budget

        docs_result = await docs_run(state)
        assert docs_result["docs"] == {}
        assert docs_result["next_agent"] == "evaluation"

        state_after_docs = state.model_copy(update={
            "docs": {},
            "audit_log": docs_result["audit_log"],
        })

        eval_result = await eval_run(state_after_docs)
        # Evaluation still runs — it's deterministic, no budget check
        assert eval_result["next_agent"] == "__end__"
