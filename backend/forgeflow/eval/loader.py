"""Load golden PRDs and expected-output YAML files for the eval harness."""

from __future__ import annotations

import re
from pathlib import Path

import yaml

GOLDEN_DIR = Path(__file__).parents[3] / "golden_prds"


def load_prd(prd_name: str) -> str:
    """Read the markdown PRD text for a golden PRD by stem name."""
    path = GOLDEN_DIR / f"{prd_name}.md"
    return path.read_text(encoding="utf-8")


def load_expected(prd_name: str) -> dict:
    """Load the expected-output YAML for a golden PRD."""
    path = GOLDEN_DIR / f"{prd_name}.expected.yaml"
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def list_golden_prds() -> list[str]:
    """Return all PRD stem names that have a matching expected.yaml."""
    if not GOLDEN_DIR.exists():
        return []
    return sorted(
        p.stem.replace(".expected", "")
        for p in GOLDEN_DIR.glob("*.expected.yaml")
    )


def match_prd_to_golden(prd_text: str) -> str | None:
    """
    Try to identify which golden PRD matches the given text.
    Matches on the first markdown heading (# Title).
    Returns the stem name (e.g. "todo_api") or None if unknown.
    """
    # Extract first heading
    heading_match = re.search(r"^#\s+(.+)$", prd_text, re.MULTILINE)
    if not heading_match:
        return None

    prd_title = heading_match.group(1).strip().lower()

    for name in list_golden_prds():
        try:
            golden_text = load_prd(name)
            golden_heading = re.search(r"^#\s+(.+)$", golden_text, re.MULTILINE)
            if golden_heading:
                golden_title = golden_heading.group(1).strip().lower()
                if golden_title == prd_title:
                    return name
        except FileNotFoundError:
            continue

    # Fallback: keyword overlap (title words vs golden PRD text)
    prd_words = set(prd_title.split())
    best_name: str | None = None
    best_overlap = 0

    for name in list_golden_prds():
        try:
            golden_text = load_prd(name)
            golden_words = set(re.findall(r"\w+", golden_text[:500].lower()))
            overlap = len(prd_words & golden_words)
            if overlap > best_overlap and overlap >= 3:
                best_overlap = overlap
                best_name = name
        except FileNotFoundError:
            continue

    return best_name
