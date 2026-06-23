"""ForgeFlow FastAPI application with SSE live-run streaming."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from forgeflow.config import settings
from forgeflow.db import close_pool, emit_run_event, get_pool, list_runs, poll_run_events, setup_db
from forgeflow.graph import build_graph, get_run_state, resume_run, start_run
from forgeflow.state import ForgeState

log = logging.getLogger(__name__)

# ── In-process SSE fan-out ────────────────────────────────────────────────────
# Maps run_id → list of subscriber queues
_sse_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)

_graph: Any = None
_checkpointer: Any = None


def broadcast(run_id: str, event: dict) -> None:
    """Push an event to all SSE subscribers for a run."""
    for q in _sse_subscribers.get(run_id, []):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global _graph, _checkpointer

    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from forgeflow.config import settings as _settings

    await get_pool()
    await setup_db()

    # AsyncPostgresSaver.from_conn_string returns a context manager;
    # use async with to get the actual checkpointer object.
    async with AsyncPostgresSaver.from_conn_string(_settings.DATABASE_URL) as checkpointer:
        await checkpointer.setup()
        _checkpointer = checkpointer
        _graph = build_graph(checkpointer)

        log.info("ForgeFlow API ready")
        yield

    await close_pool()
    log.info("ForgeFlow API shutdown")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="ForgeFlow API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / response models ─────────────────────────────────────────────────

class StartRunRequest(BaseModel):
    prd: str
    budget_cap_usd: float = 5.0
    run_id: str | None = None


class ResumeRunRequest(BaseModel):
    decision: dict   # e.g. {"approve": True} or {"approve": False, "notes": "..."}


class RunSummary(BaseModel):
    run_id: str
    status: str
    next_agent: str
    budget_used_usd: float
    budget_cap_usd: float
    epic_count: int
    task_count: int
    has_architecture: bool
    cost_breakdown: dict
    interrupts: list
    eval_scores: dict | None = None


# ── Background run wrapper ────────────────────────────────────────────────────

async def _run_in_background(run_id: str, prd: str, budget_cap: float) -> None:
    """Stream astream_events to SSE subscribers and the run_events DB table."""
    config = {"configurable": {"thread_id": run_id}}
    initial = ForgeState(run_id=run_id, prd=prd, budget_cap_usd=budget_cap)

    broadcast(run_id, {"type": "run_started", "run_id": run_id})
    await emit_run_event(run_id, {"type": "run_started", "run_id": run_id})

    try:
        async for event in _graph.astream_events(initial, config=config, version="v2"):
            evt_type = event.get("event", "")
            evt_name = event.get("name", "")

            if evt_type in ("on_chain_start", "on_chain_end",
                            "on_chain_stream", "on_chain_error"):
                payload = {
                    "type": evt_type,
                    "node": evt_name,
                    "run_id": run_id,
                    "data": _safe_serialize(event.get("data", {})),
                }
                broadcast(run_id, payload)
                await emit_run_event(run_id, payload)

        broadcast(run_id, {"type": "run_complete", "run_id": run_id})
        await emit_run_event(run_id, {"type": "run_complete", "run_id": run_id})

    except Exception as e:
        err_payload = {"type": "run_error", "run_id": run_id, "error": str(e)}
        broadcast(run_id, err_payload)
        await emit_run_event(run_id, err_payload)
        log.error("[api] Run %s error: %s", run_id, e, exc_info=True)


def _safe_serialize(obj: Any) -> Any:
    """Best-effort JSON-serializable version of obj."""
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/runs", response_model=dict, status_code=201)
async def create_run(body: StartRunRequest):
    run_id = body.run_id or str(uuid.uuid4())
    asyncio.create_task(_run_in_background(run_id, body.prd, body.budget_cap_usd))
    return {"run_id": run_id, "status": "started"}


@app.get("/runs")
async def get_runs(limit: int = 50):
    """List recent runs (derived from audit_log)."""
    rows = await list_runs(limit=limit)
    result = []
    for row in rows:
        result.append({
            "run_id": row["run_id"],
            "first_ts": row["first_ts"].isoformat() if row["first_ts"] else None,
            "last_ts": row["last_ts"].isoformat() if row["last_ts"] else None,
            "agent_count": row["agent_count"],
            "total_cost_usd": float(row["total_cost_usd"] or 0.0),
            "last_agent": row["last_agent"],
            "last_event": row["last_event"],
        })
    return {"runs": result, "count": len(result)}


@app.post("/runs/{run_id}/resume", response_model=dict)
async def resume(run_id: str, body: ResumeRunRequest):
    if _graph is None:
        raise HTTPException(503, "Graph not initialized")
    try:
        state = await resume_run(_graph, run_id, body.decision)
        broadcast(run_id, {"type": "run_resumed", "run_id": run_id, "decision": body.decision})
        return {"run_id": run_id, "status": "resumed", "next_agent": state.get("next_agent")}
    except Exception as e:
        log.error("[api] Resume error for %s: %s", run_id, e)
        raise HTTPException(400, str(e))


@app.get("/runs/{run_id}", response_model=RunSummary)
async def get_run(run_id: str):
    if _graph is None:
        raise HTTPException(503, "Graph not initialized")
    raw = await get_run_state(_graph, run_id)
    if raw is None:
        raise HTTPException(404, f"Run {run_id} not found")

    if isinstance(raw, ForgeState):
        state = raw
    elif isinstance(raw, dict) and raw.get("prd"):
        state = ForgeState(**raw)
    else:
        raise HTTPException(500, f"Could not parse state for run {run_id}")

    config = {"configurable": {"thread_id": run_id}}
    snapshot = await _graph.aget_state(config)
    interrupts = []
    if snapshot and snapshot.tasks:
        for task in snapshot.tasks:
            if hasattr(task, "interrupts"):
                interrupts.extend([i.value for i in task.interrupts])

    eval_scores = None
    if isinstance(state, ForgeState) and state.eval_scores:
        eval_scores = state.eval_scores.model_dump()

    # Decide status: interrupted vs running vs completed
    if interrupts:
        status_label = "interrupted"
    elif isinstance(state, ForgeState) and state.next_agent == "__end__":
        status_label = "completed"
    else:
        status_label = "running"

    return RunSummary(
        run_id=run_id,
        status=status_label,
        next_agent=state.next_agent if isinstance(state, ForgeState) else raw.get("next_agent", ""),
        budget_used_usd=state.budget_used_usd if isinstance(state, ForgeState) else raw.get("budget_used_usd", 0),
        budget_cap_usd=state.budget_cap_usd if isinstance(state, ForgeState) else raw.get("budget_cap_usd", 5),
        epic_count=len(state.epics) if isinstance(state, ForgeState) else len(raw.get("epics", [])),
        task_count=len(state.tasks) if isinstance(state, ForgeState) else len(raw.get("tasks", [])),
        has_architecture=state.architecture is not None if isinstance(state, ForgeState) else bool(raw.get("architecture")),
        cost_breakdown=state.cost_breakdown() if isinstance(state, ForgeState) else {},
        interrupts=interrupts,
        eval_scores=eval_scores,
    )


@app.get("/runs/{run_id}/state")
async def get_run_full_state(run_id: str):
    """Return the full state — used by frontend panels for richer detail."""
    if _graph is None:
        raise HTTPException(503, "Graph not initialized")
    raw = await get_run_state(_graph, run_id)
    if raw is None:
        raise HTTPException(404, f"Run {run_id} not found")
    if isinstance(raw, ForgeState):
        state = raw
    elif isinstance(raw, dict) and raw.get("prd"):
        state = ForgeState(**raw)
    else:
        raise HTTPException(500, f"Could not parse state for run {run_id}")

    # Collect interrupts with their full payloads
    config = {"configurable": {"thread_id": run_id}}
    snapshot = await _graph.aget_state(config)
    interrupts = []
    if snapshot and snapshot.tasks:
        for task in snapshot.tasks:
            if hasattr(task, "interrupts"):
                interrupts.extend([i.value for i in task.interrupts])

    return {
        "run_id": run_id,
        "next_agent": state.next_agent,
        "budget_used_usd": state.budget_used_usd,
        "budget_cap_usd": state.budget_cap_usd,
        "epics": [e.model_dump() for e in state.epics],
        "tasks": [t.model_dump() for t in state.tasks],
        "architecture": state.architecture.model_dump() if state.architecture else None,
        "architecture_approved": state.architecture_approved,
        "code_artifacts": [
            {
                "task_id": a.task_id,
                "file_path": a.file_path,
                "language": a.language,
                "content_preview": a.content[:500],
                "has_tests": a.test_content is not None,
            }
            for a in state.code_artifacts
        ],
        "sandbox_results": state.sandbox_results,
        "review_findings": [f.model_dump() for f in state.review_findings],
        "review_approved": state.review_approved,
        "docs": state.docs,
        "eval_scores": state.eval_scores.model_dump() if state.eval_scores else None,
        "interrupts": interrupts,
        "audit_log": [e.model_dump() for e in state.audit_log],
    }


@app.get("/runs/{run_id}/events")
async def stream_events(run_id: str, after_id: int = 0):
    """
    SSE stream — emits live events for a run.
    Polls DB for past events (after_id), then subscribes to live broadcast.
    """
    async def generator():
        # 1. Replay any past events from DB
        past = await poll_run_events(run_id, after_id=after_id)
        for row in past:
            yield {"data": json.dumps({"db_id": row["id"], **row["event"]})}

        # 2. Subscribe to live broadcast
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        _sse_subscribers[run_id].append(q)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=25)
                    yield {"data": json.dumps(event)}
                    if event.get("type") in ("run_complete", "run_error"):
                        break
                except asyncio.TimeoutError:
                    yield {"data": json.dumps({"type": "ping"})}
        finally:
            try:
                _sse_subscribers[run_id].remove(q)
            except ValueError:
                pass

    return EventSourceResponse(generator())


@app.get("/runs/{run_id}/cost")
async def get_cost(run_id: str):
    if _graph is None:
        raise HTTPException(503, "Graph not initialized")
    raw = await get_run_state(_graph, run_id)
    if raw is None:
        raise HTTPException(404, f"Run {run_id} not found")
    if isinstance(raw, ForgeState):
        state = raw
    elif isinstance(raw, dict) and raw.get("prd"):
        state = ForgeState(**raw)
    else:
        raise HTTPException(500, f"Could not parse state for run {run_id}")

    # Breakdown by model — derived from "model" key in audit entry payloads
    breakdown_by_model: dict[str, float] = {}
    for entry in state.audit_log:
        model = entry.payload.get("model")
        if model and entry.cost_usd:
            breakdown_by_model[model] = round(
                breakdown_by_model.get(model, 0.0) + entry.cost_usd, 6
            )

    return {
        "run_id": run_id,
        "total_usd": round(state.budget_used_usd, 6),
        "cap_usd": state.budget_cap_usd,
        "breakdown_by_agent": state.cost_breakdown(),
        "breakdown_by_model": breakdown_by_model,
    }


@app.get("/runs/{run_id}/eval")
async def get_eval(run_id: str):
    """Return evaluation scores and rationales for a completed run."""
    if _graph is None:
        raise HTTPException(503, "Graph not initialized")
    raw = await get_run_state(_graph, run_id)
    if raw is None:
        raise HTTPException(404, f"Run {run_id} not found")
    if isinstance(raw, ForgeState):
        state = raw
    elif isinstance(raw, dict) and raw.get("prd"):
        state = ForgeState(**raw)
    else:
        raise HTTPException(500, f"Could not parse state for run {run_id}")

    if not state.eval_scores:
        return {
            "run_id": run_id,
            "scores": None,
            "rationales": {},
            "message": "No eval scores available — run not yet complete or not a golden PRD",
        }

    # Pull rationales from the evaluation audit entry
    rationales = {}
    for entry in reversed(state.audit_log):
        if entry.agent == "evaluation" and entry.event == "scoring_complete":
            rationales = entry.payload.get("rationales", {})
            break

    return {
        "run_id": run_id,
        "scores": state.eval_scores.model_dump(),
        "rationales": rationales,
        "overall": state.eval_scores.overall,
    }


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
