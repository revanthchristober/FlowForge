"""Unit tests for ForgeState — no Docker, no LLM, no network."""

import pytest
from pydantic import ValidationError

from forgeflow.state import (
    AuditEntry,
    Epic,
    EvalScores,
    Finding,
    ForgeState,
    Task,
)


class TestForgeStateCreation:
    def test_minimal_construction(self):
        s = ForgeState(prd="Build a todo app")
        assert s.prd == "Build a todo app"
        assert s.run_id  # auto-generated UUID
        assert s.next_agent == "spec_analyst"
        assert s.budget_cap_usd == 5.0
        assert s.budget_used_usd == 0.0
        assert s.epics == []
        assert s.tasks == []
        assert s.audit_log == []

    def test_explicit_run_id(self):
        s = ForgeState(run_id="my-run-123", prd="x")
        assert s.run_id == "my-run-123"

    def test_prd_required(self):
        with pytest.raises(ValidationError):
            ForgeState()  # missing prd

    def test_next_agent_literal_valid(self):
        for agent in ["spec_analyst", "architecture", "code_generation",
                      "code_review", "documentation", "evaluation",
                      "__end__", "budget_exceeded", "error"]:
            s = ForgeState(prd="x", next_agent=agent)
            assert s.next_agent == agent

    def test_next_agent_literal_invalid(self):
        with pytest.raises(ValidationError):
            ForgeState(prd="x", next_agent="totally_fake_agent")


class TestBudgetGuard:
    def test_within_budget_true(self):
        s = ForgeState(prd="x", budget_cap_usd=5.0, budget_used_usd=1.0)
        assert s.within_budget() is True

    def test_within_budget_false(self):
        s = ForgeState(prd="x", budget_cap_usd=5.0, budget_used_usd=5.0)
        assert s.within_budget() is False

    def test_within_budget_at_cap(self):
        s = ForgeState(prd="x", budget_cap_usd=5.0, budget_used_usd=5.0)
        assert s.within_budget() is False

    def test_zero_cap_never_within(self):
        s = ForgeState(prd="x", budget_cap_usd=0.0, budget_used_usd=0.0)
        assert s.within_budget() is False


class TestAddAudit:
    def test_add_audit_appends(self):
        s = ForgeState(prd="x")
        s2 = s.add_audit("spec_analyst", "analysis_complete", tokens=100, cost=0.001)
        assert len(s2.audit_log) == 1
        assert s2.audit_log[0].agent == "spec_analyst"
        assert s2.audit_log[0].tokens_used == 100

    def test_add_audit_updates_budget(self):
        s = ForgeState(prd="x", budget_used_usd=0.5)
        s2 = s.add_audit("spec_analyst", "done", cost=0.25)
        assert abs(s2.budget_used_usd - 0.75) < 1e-9

    def test_add_audit_does_not_mutate_original(self):
        s = ForgeState(prd="x")
        _ = s.add_audit("spec_analyst", "done")
        assert len(s.audit_log) == 0  # original unchanged

    def test_chained_audit(self):
        s = ForgeState(prd="x")
        s = s.add_audit("spec_analyst", "start")
        s = s.add_audit("spec_analyst", "done", tokens=50, cost=0.01)
        assert len(s.audit_log) == 2
        assert s.audit_log[1].event == "done"


class TestCostBreakdown:
    def test_cost_breakdown_groups_by_agent(self):
        s = ForgeState(prd="x")
        s = s.add_audit("spec_analyst", "done", cost=0.01)
        s = s.add_audit("spec_analyst", "retry", cost=0.005)
        s = s.add_audit("architecture", "done", cost=0.02)
        bd = s.cost_breakdown()
        assert abs(bd["spec_analyst"] - 0.015) < 1e-9
        assert abs(bd["architecture"] - 0.02) < 1e-9

    def test_cost_breakdown_empty(self):
        s = ForgeState(prd="x")
        assert s.cost_breakdown() == {}


class TestSubModels:
    def test_epic_auto_id(self):
        e = Epic(title="T", description="D")
        assert e.id  # UUID generated

    def test_task_requires_fields(self):
        with pytest.raises(ValidationError):
            Task()  # missing required fields

    def test_finding_severity_valid(self):
        for sev in ("info", "minor", "major", "blocker"):
            f = Finding(severity=sev, category="security", description="test")
            assert f.severity == sev

    def test_finding_severity_invalid(self):
        with pytest.raises(ValidationError):
            Finding(severity="critical", category="security", description="test")

    def test_finding_category_invalid(self):
        with pytest.raises(ValidationError):
            Finding(severity="info", category="unknown_cat", description="test")


class TestEvalScores:
    def test_overall_average(self):
        e = EvalScores(prd_coverage=0.9, review_precision=0.8, build_test_pass=1.0, doc_completeness=0.7)
        assert e.overall == pytest.approx(0.85, abs=1e-3)

    def test_overall_partial(self):
        e = EvalScores(prd_coverage=0.9, build_test_pass=0.7)
        assert e.overall == pytest.approx(0.8, abs=1e-3)

    def test_overall_none(self):
        e = EvalScores()
        assert e.overall is None


class TestModelCopy:
    def test_model_copy_update(self):
        s = ForgeState(prd="x", next_agent="spec_analyst")
        s2 = s.model_copy(update={"next_agent": "architecture"})
        assert s2.next_agent == "architecture"
        assert s.next_agent == "spec_analyst"  # original unchanged
