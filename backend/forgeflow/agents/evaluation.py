"""Evaluation Agent — score a completed run against its golden PRD expectations."""

from __future__ import annotations

import logging

from forgeflow.eval.build_test import score_build_test
from forgeflow.eval.coverage import score_coverage
from forgeflow.eval.doc_completeness import score_doc_completeness
from forgeflow.eval.loader import load_expected, match_prd_to_golden
from forgeflow.eval.review_precision import score_review_precision
from forgeflow.state import AuditEntry, EvalScores, ForgeState
from forgeflow.tracing import observe

log = logging.getLogger(__name__)


@observe(name="evaluation")
async def run(state: ForgeState) -> dict:
    """LangGraph node: deterministically score the completed run."""
    log.info("[evaluation] Scoring run %s", state.run_id)

    # Identify which golden PRD this matches (if any)
    prd_name = match_prd_to_golden(state.prd)

    if prd_name is None:
        log.info("[evaluation] PRD not matched to any golden PRD — skipping scores")
        return {
            "eval_scores": None,
            "next_agent": "__end__",
            "audit_log": state.audit_log + [AuditEntry(
                agent="evaluation",
                event="skipped_not_golden",
                payload={"reason": "PRD not matched to any golden PRD"},
                decision_actor="system",
            )],
        }

    log.info("[evaluation] Matched to golden PRD: %s", prd_name)
    expected = load_expected(prd_name)

    # Run all 4 scorers
    cov_score, cov_rationale = score_coverage(state, expected)
    prec_score, prec_rationale = score_review_precision(state, expected)
    build_score, build_rationale = score_build_test(state)
    doc_score, doc_rationale = score_doc_completeness(state, expected)

    eval_scores = EvalScores(
        prd_coverage=cov_score,
        review_precision=prec_score,
        build_test_pass=build_score,
        doc_completeness=doc_score,
    )

    thresholds = expected.get("thresholds", {})
    threshold_results = {
        "prd_coverage": cov_score >= thresholds.get("prd_coverage", 0.0),
        "review_precision": prec_score >= thresholds.get("review_precision", 0.0),
        "build_test_pass": build_score >= thresholds.get("build_test_pass", 0.0),
        "doc_completeness": doc_score >= thresholds.get("doc_completeness", 0.0),
    }
    all_passed = all(threshold_results.values())

    log.info(
        "[evaluation] Scores — coverage=%.2f precision=%.2f build=%.2f docs=%.2f overall=%.2f",
        cov_score, prec_score, build_score, doc_score, eval_scores.overall or 0,
    )

    audit_entry = AuditEntry(
        agent="evaluation",
        event="scoring_complete",
        payload={
            "prd_name": prd_name,
            "scores": {
                "prd_coverage": cov_score,
                "review_precision": prec_score,
                "build_test_pass": build_score,
                "doc_completeness": doc_score,
                "overall": eval_scores.overall,
            },
            "rationales": {
                "prd_coverage": cov_rationale,
                "review_precision": prec_rationale,
                "build_test_pass": build_rationale,
                "doc_completeness": doc_rationale,
            },
            "thresholds_passed": threshold_results,
            "all_passed": all_passed,
        },
        decision_actor="system",
    )

    return {
        "eval_scores": eval_scores,
        "next_agent": "__end__",
        "audit_log": state.audit_log + [audit_entry],
    }
