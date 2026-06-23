"""ForgeState — single source of truth for all agent state."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Sub-models ─────────────────────────────────────────────────────────────────

class Epic(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    acceptance_criteria: list[str] = []


class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    epic_id: str
    title: str
    description: str
    file_path: str
    dependencies: list[str] = []


class ArchModule(BaseModel):
    name: str
    path: str
    responsibility: str


class Architecture(BaseModel):
    stack: dict[str, str]           # layer → technology (e.g. "orm" → "sqlalchemy")
    modules: list[ArchModule] = []
    adr: str = ""                   # architecture decision record
    rationale: str = ""


class CodeArtifact(BaseModel):
    task_id: str
    file_path: str
    content: str
    language: str = "python"
    test_content: Optional[str] = None


class Finding(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    severity: Literal["info", "minor", "major", "blocker"]
    category: Literal["security", "pattern", "test_coverage", "style", "logic"]
    description: str
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    suggested_fix: Optional[str] = None


class AuditEntry(BaseModel):
    ts: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    agent: str
    event: str
    payload: dict = Field(default_factory=dict)
    tokens_used: int = 0
    cost_usd: float = 0.0
    decision_actor: Optional[str] = None  # "human" | "system"


class EvalScores(BaseModel):
    prd_coverage: Optional[float] = None
    review_precision: Optional[float] = None
    build_test_pass: Optional[float] = None
    doc_completeness: Optional[float] = None

    @property
    def overall(self) -> Optional[float]:
        scores = [s for s in [
            self.prd_coverage,
            self.review_precision,
            self.build_test_pass,
            self.doc_completeness,
        ] if s is not None]
        return round(sum(scores) / len(scores), 3) if scores else None


# ── Root state ─────────────────────────────────────────────────────────────────

NextAgent = Literal[
    "spec_analyst",
    "architecture",
    "code_generation",
    "code_review",
    "documentation",
    "evaluation",
    "__end__",
    "budget_exceeded",
    "error",
]


class ForgeState(BaseModel):
    # Identity
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    prd: str

    # Planning
    epics: list[Epic] = Field(default_factory=list)
    tasks: list[Task] = Field(default_factory=list)

    # Architecture
    architecture: Optional[Architecture] = None
    architecture_approved: bool = False
    architecture_revision_count: int = 0
    architecture_revision_notes: str = ""

    # Code
    code_artifacts: list[CodeArtifact] = Field(default_factory=list)
    sandbox_results: dict[str, dict] = Field(default_factory=dict)  # task_id → result

    # Review
    review_findings: list[Finding] = Field(default_factory=list)
    review_approved: bool = False
    review_revision_count: int = 0
    review_revision_notes: str = ""

    # Docs
    docs: dict[str, str] = Field(default_factory=dict)  # filename → content

    # Eval
    eval_scores: Optional[EvalScores] = None

    # Cost governance
    budget_cap_usd: float = 5.0
    budget_used_usd: float = 0.0

    # Routing — Literal-typed so bad values are caught at parse time
    next_agent: NextAgent = "spec_analyst"

    # Append-only audit trail (nodes always return state.audit_log + [new_entry])
    audit_log: list[AuditEntry] = Field(default_factory=list)

    # Error info
    error: Optional[str] = None

    # ── Helpers ────────────────────────────────────────────────────────────────

    def within_budget(self) -> bool:
        return self.budget_used_usd < self.budget_cap_usd

    def add_audit(
        self,
        agent: str,
        event: str,
        payload: dict | None = None,
        tokens: int = 0,
        cost: float = 0.0,
        actor: str | None = None,
    ) -> "ForgeState":
        """Return a new state with one AuditEntry appended."""
        entry = AuditEntry(
            agent=agent,
            event=event,
            payload=payload or {},
            tokens_used=tokens,
            cost_usd=cost,
            decision_actor=actor,
        )
        return self.model_copy(update={
            "audit_log": self.audit_log + [entry],
            "budget_used_usd": round(self.budget_used_usd + cost, 6),
        })

    def cost_breakdown(self) -> dict:
        breakdown: dict[str, float] = {}
        for entry in self.audit_log:
            breakdown[entry.agent] = round(breakdown.get(entry.agent, 0.0) + entry.cost_usd, 6)
        return breakdown
