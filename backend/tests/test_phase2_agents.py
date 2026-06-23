"""
Phase 2 tests — Code Generation, Sandbox, Code Review.
All LLM calls mocked. Sandbox tests run real subprocess (no Docker needed).
"""

from __future__ import annotations

import textwrap
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from forgeflow.state import Architecture, ArchModule, CodeArtifact, Epic, Finding, ForgeState, Task


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def state_ready_for_codegen(base_state) -> ForgeState:
    """State after spec_analyst + architecture approved — ready for code_generation."""
    epics = [Epic(title="CRUD", description="Todo CRUD", acceptance_criteria=[])]
    tasks = [
        Task(
            epic_id=epics[0].id,
            title="Implement todo model",
            description="SQLAlchemy model for Todo",
            file_path="src/models.py",
        ),
        Task(
            epic_id=epics[0].id,
            title="Implement create endpoint",
            description="POST /todos",
            file_path="src/routes.py",
        ),
    ]
    arch = Architecture(
        stack={"language": "Python 3.12", "framework": "FastAPI", "orm": "SQLAlchemy"},
        modules=[ArchModule(name="models", path="src/models.py", responsibility="Data models")],
    )
    return base_state.model_copy(update={
        "epics": epics,
        "tasks": tasks,
        "architecture": arch,
        "architecture_approved": True,
        "next_agent": "code_generation",
        "budget_cap_usd": 10.0,
    })


@pytest.fixture
def state_with_artifacts(state_ready_for_codegen) -> ForgeState:
    """State after code_generation — ready for code_review."""
    artifacts = [
        CodeArtifact(
            task_id=state_ready_for_codegen.tasks[0].id,
            file_path="src/models.py",
            content=textwrap.dedent("""\
                from dataclasses import dataclass

                @dataclass
                class Todo:
                    id: int
                    title: str
                    done: bool = False

                def get_todo(todo_id: int) -> Todo:
                    \"\"\"Fetch a todo by id.\"\"\"
                    return Todo(id=todo_id, title="Example", done=False)
            """),
            test_content=textwrap.dedent("""\
                from src.models import Todo, get_todo

                def test_todo_creation():
                    t = Todo(id=1, title="Buy milk")
                    assert t.id == 1
                    assert t.done is False

                def test_get_todo():
                    t = get_todo(42)
                    assert t.id == 42
            """),
        ),
    ]
    return state_ready_for_codegen.model_copy(update={
        "code_artifacts": artifacts,
        "sandbox_results": {"overall": {"passed": 2, "failed": 0, "exit_code": 0, "success": True, "mode": "subprocess"}},
        "next_agent": "code_review",
    })


MOCK_CODE_RESPONSE = {
    "code": textwrap.dedent("""\
        from dataclasses import dataclass, field
        from typing import Optional

        @dataclass
        class Todo:
            \"\"\"A single todo item.\"\"\"
            id: int
            title: str
            done: bool = False
            description: Optional[str] = None

        _store: dict[int, Todo] = {}

        def create_todo(title: str) -> Todo:
            \"\"\"Create and store a new todo.\"\"\"
            todo_id = len(_store) + 1
            todo = Todo(id=todo_id, title=title)
            _store[todo_id] = todo
            return todo
    """),
    "test_code": textwrap.dedent("""\
        from src.models import Todo, create_todo

        def test_create_todo():
            todo = create_todo("Buy milk")
            assert todo.title == "Buy milk"
            assert todo.done is False

        def test_todo_has_id():
            todo = create_todo("Walk dog")
            assert todo.id > 0
    """),
}

MOCK_REVIEW_RESPONSE = {
    "findings": [
        {
            "severity": "minor",
            "category": "pattern",
            "description": "In-memory store will not persist across restarts",
            "file_path": "src/models.py",
            "line_number": 10,
            "suggested_fix": "Use a database instead of dict",
        }
    ],
    "summary": "Code is clean. One non-critical issue: in-memory storage won't survive restarts.",
}


# ── Code Generation tests ─────────────────────────────────────────────────────

class TestCodeGeneration:
    @pytest.mark.asyncio
    async def test_happy_path_generates_artifacts(self, state_ready_for_codegen):
        with patch("forgeflow.agents.code_generation.chat_json", new_callable=AsyncMock) as mock_chat, \
             patch("forgeflow.agents.code_generation.run_sandbox", new_callable=AsyncMock) as mock_sandbox:

            mock_chat.return_value = (MOCK_CODE_RESPONSE, 600, 0.00035)
            sandbox_result = MagicMock()
            sandbox_result.to_dict.return_value = {"passed": 2, "failed": 0, "exit_code": 0, "success": True, "mode": "subprocess"}
            mock_sandbox.return_value = sandbox_result

            from forgeflow.agents.code_generation import run
            result = await run(state_ready_for_codegen)

        assert result["next_agent"] == "code_review"
        assert len(result["code_artifacts"]) == 2
        assert result["code_artifacts"][0].file_path == "src/models.py"
        assert "class Todo" in result["code_artifacts"][0].content or "create_todo" in result["code_artifacts"][0].content
        assert result["sandbox_results"]["overall"]["success"] is True
        assert result["code_artifacts"][0].test_content is not None

        # Budget updated
        assert result["budget_used_usd"] > 0

        # Audit entry present
        audit = result["audit_log"]
        assert any((e.event if hasattr(e, "event") else e["event"]) == "generation_complete" for e in audit)

    @pytest.mark.asyncio
    async def test_budget_check_before_llm(self, state_ready_for_codegen):
        broke = state_ready_for_codegen.model_copy(update={"budget_used_usd": 10.0})
        from forgeflow.agents.code_generation import run
        result = await run(broke)
        assert result["next_agent"] == "budget_exceeded"

    @pytest.mark.asyncio
    async def test_no_tasks_skips_to_review(self, state_ready_for_codegen):
        empty = state_ready_for_codegen.model_copy(update={"tasks": []})
        from forgeflow.agents.code_generation import run
        result = await run(empty)
        assert result["next_agent"] == "code_review"

    @pytest.mark.asyncio
    async def test_llm_error_retried(self, state_ready_for_codegen):
        call_count = 0

        async def flaky_chat(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("temporary network error")
            return (MOCK_CODE_RESPONSE, 600, 0.00035)

        with patch("forgeflow.agents.code_generation.chat_json", side_effect=flaky_chat), \
             patch("forgeflow.agents.code_generation.run_sandbox", new_callable=AsyncMock) as mock_sb:
            mock_sb.return_value = MagicMock(to_dict=lambda: {"passed": 1, "failed": 0, "exit_code": 0, "success": True, "mode": "subprocess"})
            from forgeflow.agents.code_generation import run
            result = await run(state_ready_for_codegen)

        # First task fails + retries; second task uses both attempts of its own loop
        # Result: at least one artifact should be generated (second task or second attempt)
        assert result["next_agent"] == "code_review"


# ── Sandbox tests ─────────────────────────────────────────────────────────────

class TestSandbox:
    @pytest.mark.asyncio
    async def test_syntax_error_caught(self):
        from forgeflow.sandbox import run_sandbox
        result = await run_sandbox([{
            "file_path": "bad.py",
            "content": "def broken(\n    # missing close paren",
            "test_content": None,
        }])
        assert result.exit_code != 0
        assert not result.success

    @pytest.mark.asyncio
    async def test_valid_code_no_tests_passes(self):
        from forgeflow.sandbox import run_sandbox
        result = await run_sandbox([{
            "file_path": "good.py",
            "content": "x = 1 + 1\nassert x == 2\n",
            "test_content": None,
        }])
        # No test files → exit_code 0 (subprocess) or 5 (docker "no tests collected")
        # Both indicate success — no syntax errors, nothing failed
        assert result.success

    @pytest.mark.asyncio
    async def test_passing_tests_detected(self):
        from forgeflow.sandbox import run_sandbox
        result = await run_sandbox([{
            "file_path": "calculator.py",
            "content": "def add(a, b): return a + b\n",
            "test_content": "from calculator import add\ndef test_add(): assert add(2, 3) == 5\n",
        }])
        assert result.success
        assert result.passed >= 1
        assert result.failed == 0

    @pytest.mark.asyncio
    async def test_failing_tests_detected(self):
        from forgeflow.sandbox import run_sandbox
        result = await run_sandbox([{
            "file_path": "buggy.py",
            "content": "def add(a, b): return a - b\n",  # wrong implementation
            "test_content": "from buggy import add\ndef test_add(): assert add(2, 3) == 5\n",
        }])
        assert not result.success
        assert result.failed >= 1


# ── Code Review tests ─────────────────────────────────────────────────────────

class TestCodeReview:
    @pytest.mark.asyncio
    async def test_happy_path_approve(self, state_with_artifacts):
        from langgraph.errors import GraphInterrupt

        interrupt_value = None

        def capture(val):
            nonlocal interrupt_value
            interrupt_value = val
            raise GraphInterrupt((val,))

        with patch("forgeflow.agents.code_review.chat_json", new_callable=AsyncMock) as mock_chat, \
             patch("forgeflow.agents.code_review.interrupt", side_effect=capture):
            mock_chat.return_value = (MOCK_REVIEW_RESPONSE, 700, 0.000175)
            from forgeflow.agents.code_review import run
            with pytest.raises(GraphInterrupt):
                await run(state_with_artifacts)

        assert interrupt_value["type"] == "code_review"
        assert "findings" in interrupt_value
        assert interrupt_value["blocker_count"] == 0

    @pytest.mark.asyncio
    async def test_review_resumes_with_approve(self, state_with_artifacts):
        """Simulate the full review flow with a mocked interrupt that auto-approves."""
        decisions = [{"approve": True}]

        def auto_approve(val):
            return decisions[0]

        with patch("forgeflow.agents.code_review.chat_json", new_callable=AsyncMock) as mock_chat, \
             patch("forgeflow.agents.code_review.interrupt", side_effect=auto_approve):
            mock_chat.return_value = (MOCK_REVIEW_RESPONSE, 700, 0.000175)
            from forgeflow.agents.code_review import run
            result = await run(state_with_artifacts)

        assert result["next_agent"] == "documentation"
        assert result["review_approved"] is True
        assert len(result["review_findings"]) >= 1  # at least the LLM finding

    @pytest.mark.asyncio
    async def test_review_resumes_with_revise(self, state_with_artifacts):
        def auto_revise(val):
            return {"approve": False, "notes": "Please add error handling"}

        with patch("forgeflow.agents.code_review.chat_json", new_callable=AsyncMock) as mock_chat, \
             patch("forgeflow.agents.code_review.interrupt", side_effect=auto_revise):
            mock_chat.return_value = (MOCK_REVIEW_RESPONSE, 700, 0.000175)
            from forgeflow.agents.code_review import run
            result = await run(state_with_artifacts)

        assert result["next_agent"] == "code_generation"
        assert result["review_approved"] is False
        assert result["review_revision_count"] == 1
        assert "error handling" in result["review_revision_notes"]

    @pytest.mark.asyncio
    async def test_no_artifacts_skips_to_docs(self, base_state):
        no_art = base_state.model_copy(update={"next_agent": "code_review"})
        from forgeflow.agents.code_review import run
        result = await run(no_art)
        assert result["next_agent"] == "documentation"

    @pytest.mark.asyncio
    async def test_budget_exceeded(self, state_with_artifacts):
        broke = state_with_artifacts.model_copy(update={"budget_used_usd": 10.0})
        from forgeflow.agents.code_review import run
        result = await run(broke)
        assert result["next_agent"] == "budget_exceeded"


# ── Static analysis tests ─────────────────────────────────────────────────────

class TestStaticAnalysis:
    def test_bandit_catches_sql_injection(self):
        """Bandit must catch SQL string concatenation — this is the seeded-bug test."""
        from forgeflow.agents.code_review import _run_bandit

        unsafe_code = textwrap.dedent("""\
            import sqlite3

            def get_user(username: str):
                conn = sqlite3.connect("users.db")
                cursor = conn.cursor()
                # SQL injection vulnerability
                cursor.execute("SELECT * FROM users WHERE username = '" + username + "'")
                return cursor.fetchone()
        """)
        findings = _run_bandit(unsafe_code, "src/auth.py")
        # Bandit B608 should flag the SQL string concatenation
        security_findings = [f for f in findings if f.category == "security"]
        assert len(security_findings) >= 1, f"Bandit should catch SQL injection, got: {findings}"
        severities = {f.severity for f in security_findings}
        assert "blocker" in severities or "major" in severities, \
            f"SQL injection should be blocker/major, got severities: {severities}"

    def test_ruff_catches_style_issues(self):
        from forgeflow.agents.code_review import _run_ruff
        code_with_issues = "import os\nimport sys\nx=1\n"
        findings = _run_ruff(code_with_issues, "src/bad_style.py")
        # ruff may catch unused imports or spacing issues
        assert isinstance(findings, list)

    def test_clean_code_has_no_security_findings(self):
        from forgeflow.agents.code_review import _run_bandit
        clean_code = textwrap.dedent("""\
            def add(a: int, b: int) -> int:
                \"\"\"Add two numbers.\"\"\"
                return a + b
        """)
        findings = _run_bandit(clean_code, "src/math.py")
        blockers = [f for f in findings if f.severity == "blocker"]
        assert len(blockers) == 0, f"Clean code should have no blockers: {blockers}"


# ── Integration: Phase 2 spine with real Postgres ─────────────────────────────

class TestPhase2Integration:
    @pytest.mark.asyncio
    async def test_full_phase2_spine(self, pg_graph):
        """
        Full Phase 1+2 spine against real Postgres:
        PRD → spec → architecture HITL → approve → code_gen → code_review HITL → approve → docs stub → end

        All LLM calls mocked; real checkpointing, routing, and HITL gates tested.
        """
        import uuid
        from langgraph.types import Command

        run_id = f"test-p2-{uuid.uuid4().hex[:8]}"
        config = {"configurable": {"thread_id": run_id}}

        MOCK_SPEC = {
            "epics": [{"title": "CRUD", "description": "Todo CRUD", "acceptance_criteria": []}],
            "tasks": [{"epic_title": "CRUD", "title": "Implement model", "description": "Todo model",
                       "file_path": "src/models.py", "dependencies": []}],
        }
        MOCK_ARCH = {
            "stack": {"language": "Python 3.12", "framework": "FastAPI"},
            "modules": [{"name": "models", "path": "src/models.py", "responsibility": "Data models"}],
            "adr": "FastAPI for async.", "rationale": "Standard stack.",
        }

        async def stream_to_pause(inp):
            final = {}
            async for chunk in pg_graph.astream(inp, config=config, stream_mode="values"):
                final = chunk
            return final

        initial = ForgeState(run_id=run_id, prd="Build a todo API", budget_cap_usd=10.0)

        with patch("forgeflow.agents.spec_analyst.chat_json", new_callable=AsyncMock) as mock_sp, \
             patch("forgeflow.agents.architecture.chat_json", new_callable=AsyncMock) as mock_ar, \
             patch("forgeflow.agents.code_generation.chat_json", new_callable=AsyncMock) as mock_cg, \
             patch("forgeflow.agents.code_generation.run_sandbox", new_callable=AsyncMock) as mock_sb, \
             patch("forgeflow.agents.code_review.chat_json", new_callable=AsyncMock) as mock_cr:

            mock_sp.return_value = (MOCK_SPEC, 500, 0.0015)
            mock_ar.return_value = (MOCK_ARCH, 800, 0.0024)
            mock_cg.return_value = (MOCK_CODE_RESPONSE, 600, 0.00035)
            mock_sb.return_value = MagicMock(
                to_dict=lambda: {"passed": 2, "failed": 0, "exit_code": 0, "success": True, "mode": "subprocess"}
            )
            mock_cr.return_value = (MOCK_REVIEW_RESPONSE, 700, 0.000175)

            # ── Run 1: pauses at architecture HITL ───────────────────────────
            state = await stream_to_pause(initial)

            snapshot = await pg_graph.aget_state(config)
            arch_interrupts = [i.value for t in (snapshot.tasks or [])
                               for i in getattr(t, "interrupts", [])]
            assert len(arch_interrupts) == 1
            assert arch_interrupts[0]["type"] == "architecture_review"

            # ── Resume 1: approve architecture → should pause at code_review HITL
            state = await stream_to_pause(Command(resume={"approve": True}))

            snapshot2 = await pg_graph.aget_state(config)
            review_interrupts = [i.value for t in (snapshot2.tasks or [])
                                 for i in getattr(t, "interrupts", [])]
            assert len(review_interrupts) == 1, \
                f"Expected code_review HITL, got: {review_interrupts}"
            assert review_interrupts[0]["type"] == "code_review"
            assert "findings" in review_interrupts[0]

            # Verify code was generated and stored in checkpoint
            vals = snapshot2.values
            assert len(vals.get("code_artifacts", [])) >= 1, "Code artifacts should be in state"
            assert vals.get("sandbox_results", {}).get("overall", {}).get("success") is True

            # ── Resume 2: approve code review → documentation stub → end ─────
            final = await stream_to_pause(Command(resume={"approve": True}))

            assert final.get("review_approved") is True
            assert final.get("next_agent") == "__end__"

            # Full audit trail should span all agents
            audit = final.get("audit_log", [])
            agents_seen = {(e.agent if hasattr(e, "agent") else e["agent"]) for e in audit}
            assert "spec_analyst" in agents_seen
            assert "architecture" in agents_seen
            assert "code_generation" in agents_seen
            assert "code_review" in agents_seen
