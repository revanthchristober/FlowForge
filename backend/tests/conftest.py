"""Pytest fixtures — unit tests run without Docker/LLM."""

import pytest
import pytest_asyncio
from forgeflow.state import Epic, ForgeState, Task


@pytest.fixture
def sample_prd() -> str:
    return """\
# Todo API PRD

## Overview
A simple REST API for managing todo items.

## Features
- Create, read, update, delete todo items
- Mark todos as complete/incomplete
- Filter todos by status
- Basic validation (title required, max 200 chars)

## Tech requirements
- Python REST API
- Persistent storage
- JSON responses
"""


@pytest.fixture
def base_state(sample_prd) -> ForgeState:
    return ForgeState(run_id="test-run-001", prd=sample_prd)


@pytest.fixture
def state_with_epics(base_state) -> ForgeState:
    epics = [
        Epic(title="CRUD Operations", description="Basic todo management", acceptance_criteria=["Can create todo"]),
        Epic(title="Filtering", description="Filter by status", acceptance_criteria=["Can filter by complete"]),
    ]
    tasks = [
        Task(epic_id=epics[0].id, title="Implement create endpoint", description="POST /todos", file_path="src/routes/todos.py"),
        Task(epic_id=epics[0].id, title="Implement list endpoint", description="GET /todos", file_path="src/routes/todos.py"),
    ]
    return base_state.model_copy(update={"epics": epics, "tasks": tasks})


@pytest_asyncio.fixture
async def pg_graph():
    """Real Postgres checkpointer + compiled graph. Shared across Phase 1 and Phase 2 tests."""
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from forgeflow.config import settings
    from forgeflow.graph import build_graph

    async with AsyncPostgresSaver.from_conn_string(settings.DATABASE_URL) as checkpointer:
        await checkpointer.setup()
        graph = build_graph(checkpointer)
        yield graph
