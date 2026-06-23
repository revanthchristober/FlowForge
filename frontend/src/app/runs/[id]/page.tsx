'use client'
import { use } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { getRun } from '@/lib/api'
import { useSSE } from '@/lib/sse'
import { TimelinePanel } from '@/components/timeline-panel'
import { ApprovalPanel } from '@/components/approval-panel'
import { CostPanel } from '@/components/cost-panel'
import { EvalPanel } from '@/components/eval-panel'

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-green-400 bg-green-900/30',
  interrupted: 'text-yellow-400 bg-yellow-900/30',
  running: 'text-blue-400 bg-blue-900/30',
}

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  // SSE subscription — keeps all panels fresh via query invalidation
  useSSE(id)

  const isTerminal = (status?: string) =>
    status === 'completed' || status === 'interrupted'

  const { data: run } = useQuery({
    queryKey: ['run', id],
    queryFn: () => getRun(id),
    refetchInterval: (query) =>
      isTerminal(query.state.data?.status) ? false : 3000,
  })

  const budgetPct = run ? Math.min((run.budget_used_usd / run.budget_cap_usd) * 100, 100) : 0
  const statusClass = STATUS_COLORS[run?.status ?? ''] ?? 'text-[#8BA4C0] bg-[#1E3A5F]'

  return (
    <div className="min-h-screen bg-[#0B1A33]">
      {/* Header */}
      <header className="border-b border-[#1E3A5F] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-[#8BA4C0] hover:text-[#FAF7F2] text-sm transition-colors">
            ← Back
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-[#FAF7F2] font-bold text-lg">
                <span className="text-[#FF6B6B]">Forge</span>Flow
              </h1>
              <span className="text-[#8BA4C0] text-sm font-mono">{id.slice(0, 12)}…</span>
              {run && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass}`}>
                  {run.status}
                </span>
              )}
            </div>
            {run && (
              <div className="flex items-center gap-4 mt-1">
                <span className="text-[#8BA4C0] text-xs">
                  {run.epic_count} epics · {run.task_count} tasks
                </span>
                {/* Budget bar */}
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <div className="h-1.5 bg-[#1E3A5F] rounded-full flex-1 overflow-hidden">
                    <div
                      className="h-full bg-[#FF6B6B] rounded-full transition-all duration-500"
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <span className="text-[#8BA4C0] text-xs font-mono whitespace-nowrap">
                    ${run.budget_used_usd.toFixed(4)} / ${run.budget_cap_usd}
                  </span>
                </div>
              </div>
            )}
          </div>
          <Link href="/"
            className="text-xs bg-[#FF6B6B] text-[#0B1A33] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#FF6B6B]/90 transition-colors">
            + New Run
          </Link>
        </div>
      </header>

      {/* 4-panel grid */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top-left: Timeline */}
          <div className="min-h-80">
            <TimelinePanel runId={id} />
          </div>

          {/* Top-right: Approval */}
          <div className="min-h-80">
            <ApprovalPanel runId={id} />
          </div>

          {/* Bottom-left: Cost */}
          <div className="min-h-64">
            <CostPanel runId={id} />
          </div>

          {/* Bottom-right: Eval */}
          <div className="min-h-64">
            <EvalPanel runId={id} />
          </div>
        </div>
      </main>
    </div>
  )
}
