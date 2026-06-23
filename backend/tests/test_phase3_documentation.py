"""Phase 3 documentation agent tests."""

import pytest
from unittest.mock import AsyncMock, patch

from forgeflow.state import (
    ArchModule, Architecture, AuditEntry, CodeArtifact, Epic, ForgeState, Task
)


def make_full_state() -> ForgeState:
    epic = Epic(title="Todo CRUD", description="CRUD operations", acceptance_criteria=["Create todo"])
    task = Task(epic_id=epic.id, title="Create endpoint", description="POST /todos", file_path="src/todos.py")
    arch = Architecture(
        stack={"framework": "FastAPI", "database": "SQLite"},
        modules=[ArchModule(name="todos", path="src/todos.py", responsibility="CRUD logic")],
        adr="Use FastAPI for async support.",
        rationale="Simple and fast.",
    )
    artifact = CodeArtifact(
        task_id=task.id,
        file_path="src/todos.py",
        content="from fastapi import FastAPI\napp = FastAPI()",
        language="python",
    )
    return ForgeState(
        prd="# Todo API\nA simple REST API.",
        epics=[epic],
        tasks=[task],
        architecture=arch,
        architecture_approved=True,
        code_artifacts=[artifact],
        review_approved=True,
        budget_cap_usd=5.0,
        budget_used_usd=0.05,
    )


MOCK_DOC_RESPONSE = {
    "readme": "## Overview\nA todo API.\n## Install\npip install\n## Run\nuvicorn main:app\n## Environment\nset POSTGRES_URL",
    "api": "## Overview\nAPI docs.\n## API\nREST endpoints.\n## Endpoints\nGET /todos",
    "setup": "## Overview\nSetup guide.\n## Install\nuv sync\n## Environment\nset keys\n## Run\nmake dev",
}


class TestDocumentation:
    async def test_happy_path_generates_three_docs(self):
        from forgeflow.agents.documentation import run
        state = make_full_state()

        with patch("forgeflow.agents.documentation.chat_json", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = (MOCK_DOC_RESPONSE, 500, 0.001)
            result = await run(state)

        assert result["next_agent"] == "evaluation"
        assert "README.md" in result["docs"]
        assert "API.md" in result["docs"]
        assert "SETUP.md" in result["docs"]
        assert len(result["docs"]) == 3

    async def test_audit_entry_logged(self):
        from forgeflow.agents.documentation import run
        state = make_full_state()

        with patch("forgeflow.agents.documentation.chat_json", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = (MOCK_DOC_RESPONSE, 500, 0.001)
            result = await run(state)

        last_entry = result["audit_log"][-1]
        assert last_entry.agent == "documentation"
        assert last_entry.event == "docs_generated"
        assert last_entry.payload["doc_count"] == 3
        assert last_entry.payload["model"] == "forge/judge"

    async def test_budget_exceeded_skips_to_evaluation(self):
        from forgeflow.agents.documentation import run
        state = make_full_state()
        # Exhaust the budget
        state = state.model_copy(update={"budget_used_usd": 10.0, "budget_cap_usd": 5.0})

        with patch("forgeflow.agents.documentation.chat_json", new_callable=AsyncMock) as mock_chat:
            result = await run(state)
            mock_chat.assert_not_called()

        assert result["next_agent"] == "evaluation"
        assert result["docs"] == {}
        last_entry = result["audit_log"][-1]
        assert "budget" in last_entry.event

    async def test_llm_error_skips_to_evaluation(self):
        from forgeflow.agents.documentation import run
        state = make_full_state()

        with patch("forgeflow.agents.documentation.chat_json", new_callable=AsyncMock) as mock_chat:
            mock_chat.side_effect = RuntimeError("LLM unavailable")
            result = await run(state)

        assert result["next_agent"] == "evaluation"
        assert result["docs"] == {}
        assert "documentation failed" in (result.get("error") or "")
        last_entry = result["audit_log"][-1]
        assert last_entry.event == "error"

    async def test_no_code_artifacts_still_generates_docs(self):
        from forgeflow.agents.documentation import run
        state = make_full_state()
        # Remove code artifacts — docs should still be generated from epics/arch
        state = state.model_copy(update={"code_artifacts": []})

        with patch("forgeflow.agents.documentation.chat_json", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = (MOCK_DOC_RESPONSE, 500, 0.001)
            result = await run(state)

        assert result["next_agent"] == "evaluation"
        mock_chat.assert_called_once()

    async def test_budget_updated_after_success(self):
        from forgeflow.agents.documentation import run
        state = make_full_state()
        initial_budget = state.budget_used_usd

        with patch("forgeflow.agents.documentation.chat_json", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = (MOCK_DOC_RESPONSE, 500, 0.002)
            result = await run(state)

        assert result["budget_used_usd"] > initial_budget
