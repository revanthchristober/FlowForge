"""PRD coverage scorer — what % of expected tasks did the spec analyst find?"""

from __future__ import annotations

from forgeflow.state import ForgeState


def score_coverage(state: ForgeState, expected: dict) -> tuple[float, str]:
    """
    Check how many of the must_have_tasks keywords appear in the generated tasks.
    Returns (score 0.0-1.0, rationale string).
    """
    must_have = expected.get("must_have_tasks", [])
    if not must_have:
        return (1.0, "no expected tasks defined")

    # Build searchable text from all tasks
    task_texts = []
    for task in state.tasks:
        task_texts.append(f"{task.title} {task.description}".lower())
    combined = " ".join(task_texts)

    matched = []
    missed = []

    for keyword in must_have:
        if keyword.lower() in combined:
            matched.append(keyword)
        else:
            missed.append(keyword)

    score = len(matched) / len(must_have)
    rationale_parts = []
    if matched:
        rationale_parts.append(f"found: {', '.join(matched)}")
    if missed:
        rationale_parts.append(f"missing: {', '.join(missed)}")

    rationale = f"{len(matched)}/{len(must_have)} tasks matched. " + "; ".join(rationale_parts)
    return (round(score, 3), rationale)
