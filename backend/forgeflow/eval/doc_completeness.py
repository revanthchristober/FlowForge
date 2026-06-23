"""Doc completeness scorer — are all required sections present in generated docs?"""

from __future__ import annotations

import re

from forgeflow.state import ForgeState


def score_doc_completeness(state: ForgeState, expected: dict) -> tuple[float, str]:
    """
    Check if all required_doc_sections appear in state.docs.
    Matches on markdown heading (# Section) OR plain substring (case-insensitive).
    Returns (score 0.0-1.0, rationale string).
    """
    required = expected.get("required_doc_sections", [])
    if not required:
        return (1.0, "no required doc sections defined")

    if not state.docs:
        return (0.0, f"no docs generated; required: {', '.join(required)}")

    # Join all doc content for searching
    all_docs = "\n".join(state.docs.values()).lower()

    found = []
    missing = []

    for section in required:
        sec_lower = section.lower()
        # Match as markdown heading: "# Section" or "## Section" etc.
        heading_pattern = rf"^#+\s+{re.escape(sec_lower)}"
        if re.search(heading_pattern, all_docs, re.MULTILINE):
            found.append(section)
        elif sec_lower in all_docs:
            # Plain substring match (e.g. "Overview" in a paragraph)
            found.append(section)
        else:
            missing.append(section)

    score = len(found) / len(required)
    parts = []
    if found:
        parts.append(f"found: {', '.join(found)}")
    if missing:
        parts.append(f"missing: {', '.join(missing)}")

    rationale = f"{len(found)}/{len(required)} sections present. " + "; ".join(parts)
    return (round(score, 3), rationale)
