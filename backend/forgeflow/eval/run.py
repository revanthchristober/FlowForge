"""
Eval runner — runs all golden PRDs through the full pipeline and scores them.

Usage:
  uv run python -m forgeflow.eval.run
  uv run python -m forgeflow.eval.run --save-baseline
  uv run python -m forgeflow.eval.run --baseline eval/baselines.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.types import Command

from forgeflow.config import settings
from forgeflow.eval.loader import list_golden_prds, load_expected, load_prd
from forgeflow.graph import build_graph
from forgeflow.state import ForgeState

log = logging.getLogger(__name__)

RESULTS_DIR = Path(__file__).parent / "results"
BASELINE_PATH = Path(__file__).parent / "baselines.json"


async def run_one_prd(graph, prd_name: str, prd_text: str) -> dict:
    """
    Run a single PRD through the full pipeline with HITL auto-approve.
    Returns the final state dict.
    """
    run_id = f"eval-{prd_name}-{uuid.uuid4().hex[:8]}"
    config = {"configurable": {"thread_id": run_id}}
    initial = ForgeState(run_id=run_id, prd=prd_text, budget_cap_usd=5.0)

    log.info("[eval_runner] Starting PRD=%s run_id=%s", prd_name, run_id)

    # Stream the graph — auto-approve all HITL interrupts
    max_iterations = 20
    iteration = 0

    # Start the run
    final_state: dict = {}
    async for chunk in graph.astream(initial, config=config, stream_mode="values"):
        final_state = chunk

    # Handle interrupt loops (HITL gates)
    while iteration < max_iterations:
        iteration += 1
        snapshot = await graph.aget_state(config)

        if snapshot is None:
            break

        # Check for pending interrupts
        has_interrupt = False
        if snapshot.tasks:
            for task in snapshot.tasks:
                if hasattr(task, "interrupts") and task.interrupts:
                    has_interrupt = True
                    break

        if not has_interrupt:
            break

        log.info("[eval_runner] Auto-approving HITL gate (iteration %d)", iteration)
        async for chunk in graph.astream(
            Command(resume={"approve": True}),
            config=config,
            stream_mode="values",
        ):
            final_state = chunk

    return final_state


async def run_eval_suite(prd_names: list[str] | None = None) -> dict:
    """Run all (or given) golden PRDs and return scored results."""
    if prd_names is None:
        prd_names = list_golden_prds()

    if not prd_names:
        print("No golden PRDs found in golden_prds/")
        return {}

    results: dict[str, dict] = {}

    async with AsyncPostgresSaver.from_conn_string(settings.DATABASE_URL) as checkpointer:
        await checkpointer.setup()
        graph = build_graph(checkpointer)

        for prd_name in prd_names:
            print(f"\n→ Running PRD: {prd_name}...")
            try:
                prd_text = load_prd(prd_name)
                expected = load_expected(prd_name)
                final_state = await run_one_prd(graph, prd_name, prd_text)

                # Extract eval scores from state
                state_obj = ForgeState(**final_state) if isinstance(final_state, dict) else final_state
                scores = {}
                rationales = {}

                if state_obj.eval_scores:
                    scores = {
                        "prd_coverage": state_obj.eval_scores.prd_coverage,
                        "review_precision": state_obj.eval_scores.review_precision,
                        "build_test_pass": state_obj.eval_scores.build_test_pass,
                        "doc_completeness": state_obj.eval_scores.doc_completeness,
                        "overall": state_obj.eval_scores.overall,
                    }

                # Extract rationales from audit log
                for entry in reversed(state_obj.audit_log):
                    if entry.agent == "evaluation" and entry.event == "scoring_complete":
                        rationales = entry.payload.get("rationales", {})
                        break

                # Check thresholds
                thresholds = expected.get("thresholds", {})
                passed = {}
                for key, threshold in thresholds.items():
                    passed[key] = (scores.get(key) or 0.0) >= threshold

                results[prd_name] = {
                    "prd_name": prd_name,
                    "scores": scores,
                    "rationales": rationales,
                    "thresholds_passed": passed,
                    "all_passed": all(passed.values()) if passed else True,
                    "audit_entries": len(state_obj.audit_log),
                    "total_cost_usd": state_obj.budget_used_usd,
                }

                print(f"  ✓ {prd_name}: overall={scores.get('overall', 'N/A')}")

            except Exception as e:
                log.error("[eval_runner] PRD %s failed: %s", prd_name, e, exc_info=True)
                results[prd_name] = {"prd_name": prd_name, "error": str(e)}

    return results


def print_scorecard(results: dict) -> None:
    """Print a formatted scorecard table."""
    if not results:
        print("No results to display.")
        return

    header = f"{'PRD':<20} {'Coverage':>10} {'Precision':>10} {'Build':>7} {'Docs':>7} {'Overall':>9} {'Pass':>5}"
    print("\n" + "=" * len(header))
    print("ForgeFlow Eval Scorecard")
    print("=" * len(header))
    print(header)
    print("-" * len(header))

    for name, result in results.items():
        if "error" in result:
            print(f"{name:<20} {'ERROR':>10} {result['error'][:40]}")
            continue

        scores = result.get("scores", {})
        passed = result.get("all_passed", False)

        def fmt(val):
            if val is None:
                return "   N/A"
            return f"{val:.2f}"

        print(
            f"{name:<20}"
            f" {fmt(scores.get('prd_coverage')):>10}"
            f" {fmt(scores.get('review_precision')):>10}"
            f" {fmt(scores.get('build_test_pass')):>7}"
            f" {fmt(scores.get('doc_completeness')):>7}"
            f" {fmt(scores.get('overall')):>9}"
            f" {'✓' if passed else '✗':>5}"
        )

    print("=" * len(header))


def save_baseline(results: dict, path: Path = BASELINE_PATH) -> None:
    """Save current results as baseline for future comparisons."""
    baseline = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }
    path.write_text(json.dumps(baseline, indent=2), encoding="utf-8")
    print(f"\n✓ Baseline saved to {path}")


def compare_to_baseline(results: dict, baseline_path: Path = BASELINE_PATH) -> None:
    """Compare current results against a saved baseline and print deltas."""
    if not baseline_path.exists():
        print(f"No baseline found at {baseline_path}")
        return

    with baseline_path.open() as f:
        baseline_data = json.load(f)

    baseline_results = baseline_data.get("results", {})
    baseline_ts = baseline_data.get("timestamp", "unknown")

    print(f"\nComparing against baseline from {baseline_ts}")
    print(f"{'PRD':<20} {'Metric':<20} {'Baseline':>10} {'Current':>10} {'Delta':>8}")
    print("-" * 72)

    for prd_name, current in results.items():
        if "error" in current:
            continue
        baseline_prd = baseline_results.get(prd_name, {})
        if "error" in baseline_prd:
            continue

        current_scores = current.get("scores", {})
        baseline_scores = baseline_prd.get("scores", {})

        for metric in ["prd_coverage", "review_precision", "build_test_pass", "doc_completeness", "overall"]:
            cur = current_scores.get(metric)
            base = baseline_scores.get(metric)
            if cur is None and base is None:
                continue
            delta = (cur or 0) - (base or 0)
            arrow = "↑" if delta > 0.01 else ("↓" if delta < -0.01 else "→")
            print(
                f"{prd_name:<20} {metric:<20}"
                f" {(base or 0):>10.3f} {(cur or 0):>10.3f}"
                f" {arrow}{abs(delta):>6.3f}"
            )


def main() -> None:
    logging.basicConfig(level=logging.WARNING)

    parser = argparse.ArgumentParser(description="ForgeFlow eval runner")
    parser.add_argument("--prd", nargs="*", help="Specific PRD names to run (default: all)")
    parser.add_argument("--save-baseline", action="store_true", help="Save results as new baseline")
    parser.add_argument("--baseline", type=Path, default=None, help="Compare against this baseline file")
    args = parser.parse_args()

    results = asyncio.run(run_eval_suite(args.prd))
    print_scorecard(results)

    # Save timestamped result
    RESULTS_DIR.mkdir(exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    result_path = RESULTS_DIR / f"eval_{ts}.json"
    result_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\n✓ Results saved to {result_path}")

    if args.save_baseline:
        save_baseline(results)

    if args.baseline:
        compare_to_baseline(results, args.baseline)
    elif BASELINE_PATH.exists():
        compare_to_baseline(results)


if __name__ == "__main__":
    main()
