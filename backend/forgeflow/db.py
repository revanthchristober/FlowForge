"""Postgres connection pool + audit_log table setup."""

from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from forgeflow.config import settings

log = logging.getLogger(__name__)

_pool: AsyncConnectionPool | None = None


async def get_pool() -> AsyncConnectionPool:
    global _pool
    if _pool is None:
        _pool = AsyncConnectionPool(
            conninfo=settings.DATABASE_URL,
            min_size=2,
            max_size=10,
            open=False,
        )
        await _pool.open()
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_conn():
    pool = await get_pool()
    async with pool.connection() as conn:
        conn.row_factory = dict_row
        yield conn


# ── Schema setup ───────────────────────────────────────────────────────────────

SETUP_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    run_id      TEXT        NOT NULL,
    ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    agent       TEXT        NOT NULL,
    event       TEXT        NOT NULL,
    payload     JSONB       NOT NULL DEFAULT '{}',
    tokens_used INT         NOT NULL DEFAULT 0,
    cost_usd    NUMERIC(10,6) NOT NULL DEFAULT 0,
    decision_actor TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_run_id ON audit_log(run_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts     ON audit_log(ts DESC);

-- Prevent UPDATE/DELETE on audit rows (append-only enforcement)
CREATE OR REPLACE RULE audit_no_update AS
    ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_no_delete AS
    ON DELETE TO audit_log DO INSTEAD NOTHING;

CREATE TABLE IF NOT EXISTS run_events (
    id      BIGSERIAL PRIMARY KEY,
    run_id  TEXT        NOT NULL,
    ts      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event   JSONB       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events(run_id, id);
"""


async def setup_db() -> None:
    """Idempotent: creates tables and extensions if they don't exist."""
    async with get_conn() as conn:
        await conn.execute(SETUP_SQL)
        await conn.commit()
    log.info("DB setup complete")


async def persist_audit_entry(run_id: str, entry: dict) -> None:
    async with get_conn() as conn:
        await conn.execute(
            """
            INSERT INTO audit_log (run_id, ts, agent, event, payload, tokens_used, cost_usd, decision_actor)
            VALUES (%(run_id)s, %(ts)s, %(agent)s, %(event)s, %(payload)s, %(tokens_used)s, %(cost_usd)s, %(decision_actor)s)
            """,
            {
                "run_id": run_id,
                "ts": entry["ts"],
                "agent": entry["agent"],
                "event": entry["event"],
                "payload": json.dumps(entry.get("payload", {})),
                "tokens_used": entry.get("tokens_used", 0),
                "cost_usd": entry.get("cost_usd", 0.0),
                "decision_actor": entry.get("decision_actor"),
            },
        )
        await conn.commit()


async def get_audit_log(run_id: str) -> list[dict]:
    async with get_conn() as conn:
        rows = await conn.execute(
            "SELECT * FROM audit_log WHERE run_id = %s ORDER BY ts ASC",
            (run_id,),
        )
        return await rows.fetchall()


async def emit_run_event(run_id: str, event: dict) -> None:
    async with get_conn() as conn:
        await conn.execute(
            "INSERT INTO run_events (run_id, event) VALUES (%s, %s)",
            (run_id, json.dumps(event)),
        )
        await conn.commit()


async def poll_run_events(run_id: str, after_id: int = 0) -> list[dict]:
    async with get_conn() as conn:
        rows = await conn.execute(
            "SELECT id, ts, event FROM run_events WHERE run_id = %s AND id > %s ORDER BY id ASC",
            (run_id, after_id),
        )
        return await rows.fetchall()


async def list_runs(limit: int = 50) -> list[dict]:
    """
    Return recent runs derived from audit_log.
    Each row: run_id, first_ts, last_ts, agent_count, total_cost_usd, last_event, last_agent.
    """
    async with get_conn() as conn:
        rows = await conn.execute(
            """
            SELECT
                run_id,
                MIN(ts)                    AS first_ts,
                MAX(ts)                    AS last_ts,
                COUNT(DISTINCT agent)      AS agent_count,
                COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
                (SELECT event FROM audit_log a2
                   WHERE a2.run_id = audit_log.run_id
                   ORDER BY ts DESC LIMIT 1) AS last_event,
                (SELECT agent FROM audit_log a3
                   WHERE a3.run_id = audit_log.run_id
                   ORDER BY ts DESC LIMIT 1) AS last_agent
            FROM audit_log
            GROUP BY run_id
            ORDER BY MAX(ts) DESC
            LIMIT %s
            """,
            (limit,),
        )
        return await rows.fetchall()


# ── CLI entry (called by Makefile `make up`) ───────────────────────────────────

if __name__ == "__main__":
    import asyncio
    import sys

    if "--setup" in sys.argv:
        asyncio.run(setup_db())
        print("✓ Database setup complete")
