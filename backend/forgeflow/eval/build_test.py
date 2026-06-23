"""Build/test scorer — did the generated code pass its sandbox tests?"""

from __future__ import annotations

from forgeflow.state import ForgeState


def score_build_test(state: ForgeState) -> tuple[float, str]:
    """
    Read sandbox_results["overall"] from state.
    Returns (score 0.0-1.0, rationale string).
    """
    overall = state.sandbox_results.get("overall", {})

    if not overall:
        return (0.0, "no sandbox results recorded")

    if "error" in overall and overall.get("exit_code", -1) < 0:
        return (0.0, f"sandbox error: {overall['error']}")

    passed = overall.get("passed", 0)
    failed = overall.get("failed", 0)
    errors = overall.get("errors", 0)
    total = passed + failed + errors
    success = overall.get("success", False)
    mode = overall.get("mode", "unknown")

    # Syntax-only mode with no tests is still a pass (code at least compiles)
    if total == 0 and success:
        return (1.0, f"syntax clean, no tests collected (mode={mode})")

    if total == 0:
        return (0.0, "sandbox ran but no results recorded")

    score = passed / total
    rationale = (
        f"{passed} passed, {failed} failed, {errors} errors "
        f"(mode={mode}, exit_code={overall.get('exit_code', '?')})"
    )
    return (round(score, 3), rationale)
