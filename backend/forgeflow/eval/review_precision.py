"""Review precision scorer — did the code reviewer catch all seeded bugs?"""

from __future__ import annotations

from forgeflow.state import ForgeState


def score_review_precision(state: ForgeState, expected: dict) -> tuple[float, str]:
    """
    For each seeded_finding in expected, check if state.review_findings caught it.
    Match on: same category + same severity + pattern keyword in description.
    Returns (score 0.0-1.0, rationale string).
    """
    seeded = expected.get("seeded_findings", [])
    if not seeded:
        return (1.0, "no seeded bugs expected — N/A")

    caught = []
    missed = []

    for seed in seeded:
        seed_category = seed.get("category", "")
        seed_severity = seed.get("severity", "")
        seed_pattern = seed.get("pattern", "").lower()

        found = False
        for finding in state.review_findings:
            category_match = (finding.category == seed_category) if seed_category else True
            severity_match = (finding.severity == seed_severity) if seed_severity else True
            pattern_match = seed_pattern in finding.description.lower() if seed_pattern else True

            if category_match and severity_match and pattern_match:
                found = True
                break

        label = seed_pattern or f"{seed_category}/{seed_severity}"
        if found:
            caught.append(label)
        else:
            missed.append(label)

    score = len(caught) / len(seeded)
    parts = []
    if caught:
        parts.append(f"caught: {', '.join(caught)}")
    if missed:
        parts.append(f"missed: {', '.join(missed)}")

    rationale = f"{len(caught)}/{len(seeded)} seeded bugs caught. " + "; ".join(parts)
    return (round(score, 3), rationale)
