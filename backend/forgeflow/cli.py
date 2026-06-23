"""ForgeFlow CLI — for `make demo` and quick local testing."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path


async def demo(prd_path: str) -> None:
    from forgeflow.db import setup_db
    from forgeflow.graph import build_graph, get_checkpointer_cm, start_run, resume_run
    import uuid

    prd = Path(prd_path).read_text()
    run_id = str(uuid.uuid4())

    print(f"\n{'='*60}")
    print(f"ForgeFlow Demo Run")
    print(f"Run ID: {run_id}")
    print(f"PRD:    {prd_path}")
    print(f"{'='*60}\n")

    await setup_db()
    async with get_checkpointer_cm() as checkpointer:
        await checkpointer.setup()
        graph = build_graph(checkpointer)

        state = await start_run(graph, run_id, prd)
        _print_state(state)

        # Check for HITL interrupt
        config = {"configurable": {"thread_id": run_id}}
        snapshot = await graph.aget_state(config)

        if snapshot and snapshot.tasks:
            for task in snapshot.tasks:
                if hasattr(task, "interrupts") and task.interrupts:
                    interrupt_val = task.interrupts[0].value
                    print(f"\n⏸  HITL Gate: {interrupt_val.get('type', 'unknown')}")
                    print("   Proposal:")
                    print(json.dumps(interrupt_val.get("proposal", {}), indent=2)[:1000])
                    print("\n→ Auto-approving for demo...")

                    state = await resume_run(graph, run_id, {"approve": True})
                    _print_state(state)

    print("\n✓ Demo complete")
    print(f"  Epics: {len(state.get('epics', []))}")
    print(f"  Tasks: {len(state.get('tasks', []))}")
    print(f"  Cost:  ${state.get('budget_used_usd', 0):.4f}")


def _print_state(state: dict) -> None:
    print(f"\nState snapshot:")
    print(f"  next_agent:  {state.get('next_agent')}")
    print(f"  epics:       {len(state.get('epics', []))}")
    print(f"  tasks:       {len(state.get('tasks', []))}")
    print(f"  budget_used: ${state.get('budget_used_usd', 0):.4f}")
    print(f"  audit_log:   {len(state.get('audit_log', []))} entries")


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] != "demo":
        print("Usage: python -m forgeflow.cli demo <prd_path>")
        sys.exit(1)
    asyncio.run(demo(sys.argv[2]))
