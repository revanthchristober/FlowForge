"""Phase 3 scorer unit tests — pure deterministic functions, no LLM."""

import pytest
from forgeflow.eval.build_test import score_build_test
from forgeflow.eval.coverage import score_coverage
from forgeflow.eval.doc_completeness import score_doc_completeness
from forgeflow.eval.review_precision import score_review_precision
from forgeflow.state import CodeArtifact, Epic, Finding, ForgeState, Task


# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_state(**kwargs) -> ForgeState:
    defaults = {"prd": "# Test PRD\n\nA test project."}
    defaults.update(kwargs)
    return ForgeState(**defaults)


def make_task(title: str, description: str = "") -> Task:
    return Task(epic_id="e1", title=title, description=description, file_path=f"src/{title.lower().replace(' ', '_')}.py")


def make_finding(severity: str, category: str, description: str) -> Finding:
    return Finding(severity=severity, category=category, description=description)


# ── Coverage scorer ────────────────────────────────────────────────────────────

class TestCoverage:
    def test_full_match(self):
        state = make_state(tasks=[
            make_task("create endpoint"),
            make_task("list endpoint"),
            make_task("delete endpoint"),
        ])
        expected = {"must_have_tasks": ["create", "list", "delete"]}
        score, rationale = score_coverage(state, expected)
        assert score == 1.0
        assert "3/3" in rationale

    def test_partial_match(self):
        state = make_state(tasks=[
            make_task("create endpoint"),
            make_task("list endpoint"),
        ])
        expected = {"must_have_tasks": ["create", "list", "delete", "update"]}
        score, rationale = score_coverage(state, expected)
        assert score == 0.5
        assert "2/4" in rationale
        assert "missing" in rationale

    def test_empty_must_haves(self):
        state = make_state()
        expected = {"must_have_tasks": []}
        score, rationale = score_coverage(state, expected)
        assert score == 1.0
        assert "no expected tasks" in rationale

    def test_case_insensitive(self):
        state = make_state(tasks=[make_task("Create User Endpoint", "Add POST /users")])
        expected = {"must_have_tasks": ["create", "user"]}
        score, _ = score_coverage(state, expected)
        assert score == 1.0

    def test_no_tasks_in_state(self):
        state = make_state(tasks=[])
        expected = {"must_have_tasks": ["create", "delete"]}
        score, rationale = score_coverage(state, expected)
        assert score == 0.0
        assert "missing" in rationale

    def test_keyword_in_description(self):
        state = make_state(tasks=[
            make_task("Endpoint Module", "Handles filter and sort logic")
        ])
        expected = {"must_have_tasks": ["filter"]}
        score, _ = score_coverage(state, expected)
        assert score == 1.0


# ── Review precision scorer ────────────────────────────────────────────────────

class TestReviewPrecision:
    def test_catches_seeded_sql_injection(self):
        findings = [
            make_finding("blocker", "security", "bandit B608: SQL injection via string formatting"),
        ]
        state = make_state(review_findings=findings)
        expected = {"seeded_findings": [
            {"category": "security", "severity": "blocker", "pattern": "SQL injection"}
        ]}
        score, rationale = score_review_precision(state, expected)
        assert score == 1.0
        assert "caught" in rationale

    def test_misses_seeded_bug(self):
        state = make_state(review_findings=[])
        expected = {"seeded_findings": [
            {"category": "security", "severity": "blocker", "pattern": "SQL injection"}
        ]}
        score, rationale = score_review_precision(state, expected)
        assert score == 0.0
        assert "missed" in rationale

    def test_no_seeded_bugs_returns_one(self):
        state = make_state()
        expected = {"seeded_findings": []}
        score, rationale = score_review_precision(state, expected)
        assert score == 1.0
        assert "N/A" in rationale

    def test_partial_catch(self):
        findings = [
            make_finding("blocker", "security", "SQL injection via string concat"),
        ]
        state = make_state(review_findings=findings)
        expected = {"seeded_findings": [
            {"category": "security", "severity": "blocker", "pattern": "SQL injection"},
            {"category": "security", "severity": "major", "pattern": "plaintext password"},
        ]}
        score, rationale = score_review_precision(state, expected)
        assert score == 0.5
        assert "caught" in rationale
        assert "missed" in rationale

    def test_category_mismatch_does_not_match(self):
        findings = [
            make_finding("blocker", "pattern", "SQL injection found"),
        ]
        state = make_state(review_findings=findings)
        expected = {"seeded_findings": [
            {"category": "security", "severity": "blocker", "pattern": "SQL injection"}
        ]}
        score, _ = score_review_precision(state, expected)
        assert score == 0.0


# ── Build/test scorer ──────────────────────────────────────────────────────────

class TestBuildTest:
    def test_all_pass(self):
        state = make_state(sandbox_results={"overall": {
            "passed": 5, "failed": 0, "errors": 0, "success": True, "exit_code": 0, "mode": "subprocess"
        }})
        score, rationale = score_build_test(state)
        assert score == 1.0
        assert "5" in rationale

    def test_all_fail(self):
        state = make_state(sandbox_results={"overall": {
            "passed": 0, "failed": 3, "errors": 0, "success": False, "exit_code": 1, "mode": "subprocess"
        }})
        score, rationale = score_build_test(state)
        assert score == 0.0

    def test_mixed_results(self):
        state = make_state(sandbox_results={"overall": {
            "passed": 3, "failed": 1, "errors": 0, "success": False, "exit_code": 1, "mode": "subprocess"
        }})
        score, _ = score_build_test(state)
        assert score == pytest.approx(0.75)

    def test_no_sandbox_results(self):
        state = make_state(sandbox_results={})
        score, rationale = score_build_test(state)
        assert score == 0.0
        assert "no sandbox" in rationale

    def test_syntax_only_mode_success(self):
        state = make_state(sandbox_results={"overall": {
            "passed": 0, "failed": 0, "errors": 0, "success": True, "exit_code": 5, "mode": "syntax_only"
        }})
        score, rationale = score_build_test(state)
        assert score == 1.0
        assert "syntax" in rationale

    def test_sandbox_error(self):
        state = make_state(sandbox_results={"overall": {
            "error": "Docker timeout", "exit_code": -1, "success": False
        }})
        score, rationale = score_build_test(state)
        assert score == 0.0
        assert "error" in rationale


# ── Doc completeness scorer ────────────────────────────────────────────────────

class TestDocCompleteness:
    def test_all_sections_present(self):
        state = make_state(docs={
            "README.md": "## Overview\nSome text.\n## Install\nRun pip install.\n## Run\npython main.py\n## API\nSee below.\n## Environment\nSet POSTGRES_URL",
        })
        expected = {"required_doc_sections": ["Overview", "Install", "Run", "API", "Environment"]}
        score, rationale = score_doc_completeness(state, expected)
        assert score == 1.0
        assert "5/5" in rationale

    def test_partial_sections(self):
        state = make_state(docs={
            "README.md": "## Overview\nSome text.\n## Install\nPip is needed.",
        })
        expected = {"required_doc_sections": ["Overview", "Install", "Run", "Endpoints"]}
        score, rationale = score_doc_completeness(state, expected)
        assert score == 0.5
        assert "missing" in rationale

    def test_no_docs(self):
        state = make_state(docs={})
        expected = {"required_doc_sections": ["Overview", "Install"]}
        score, rationale = score_doc_completeness(state, expected)
        assert score == 0.0
        assert "no docs" in rationale

    def test_case_insensitive_match(self):
        state = make_state(docs={
            "README.md": "## overview\nSome text.\n## install\nRun pip.",
        })
        expected = {"required_doc_sections": ["Overview", "Install"]}
        score, _ = score_doc_completeness(state, expected)
        assert score == 1.0

    def test_no_required_sections(self):
        state = make_state(docs={})
        expected = {"required_doc_sections": []}
        score, rationale = score_doc_completeness(state, expected)
        assert score == 1.0
        assert "no required" in rationale

    def test_plain_substring_match(self):
        # "Overview" appears in body text, not as a heading
        state = make_state(docs={
            "README.md": "This section provides an Overview of the project.",
        })
        expected = {"required_doc_sections": ["Overview"]}
        score, _ = score_doc_completeness(state, expected)
        assert score == 1.0

    def test_multiple_doc_files(self):
        state = make_state(docs={
            "README.md": "## Overview\nProject description.",
            "API.md": "## API\n## Endpoints\nGET /items",
            "SETUP.md": "## Install\nnpm install",
        })
        expected = {"required_doc_sections": ["Overview", "API", "Install"]}
        score, _ = score_doc_completeness(state, expected)
        assert score == 1.0
