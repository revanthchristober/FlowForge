'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { listRuns } from '@/lib/api'
import { NewRunForm } from '@/components/new-run-form'
import type { RunListItem } from '@/lib/types'

const STATUS_COLORS: Record<string, string> = {
  scoring_complete: 'text-green-400 bg-green-900/30',
  hitl_decision: 'text-yellow-400 bg-yellow-900/30',
  error: 'text-red-400 bg-red-900/30',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function RunCard({ run }: { run: RunListItem }) {
  const shortId = run.run_id.slice(0, 8)
  const statusClass = STATUS_COLORS[run.last_event] ?? 'text-muted bg-[#1E3A5F]'
  const isRecent = run.last_ts && Date.now() - new Date(run.last_ts).getTime() < 60_000

  return (
    <Link href={`/runs/${run.run_id}`}>
      <div className={`bg-[#1E3A5F] hover:bg-[#1E3A5F]/80 rounded-xl p-4 border transition-all cursor-pointer ${
        isRecent ? 'border-[#FF6B6B]/40' : 'border-transparent hover:border-[#8BA4C0]/30'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[#FAF7F2] text-sm font-medium">{shortId}</span>
              {isRecent && <span className="text-xs bg-[#FF6B6B]/20 text-[#FF6B6B] px-2 py-0.5 rounded-full animate-pulse">live</span>}
            </div>
            <div className="text-[#8BA4C0] text-xs">
              {run.agent_count} agents · ${run.total_cost_usd.toFixed(5)} · {run.last_agent?.replace('_', ' ')}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass}`}>
              {run.last_event?.replace(/_/g, ' ')}
            </span>
            <div className="text-[#8BA4C0] text-xs mt-1">{run.last_ts ? timeAgo(run.last_ts) : '—'}</div>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const [showForm, setShowForm] = useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: ['runs'],
    queryFn: () => listRuns(50),
    refetchInterval: 5000,
  })

  return (
    <div className="min-h-screen bg-[#0B1A33]">
      <header className="border-b border-[#1E3A5F] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-[#FAF7F2] font-bold text-xl tracking-tight">
            <span className="text-[#FF6B6B]">Forge</span>Flow
          </h1>
          <p className="text-[#8BA4C0] text-xs mt-0.5">PRD → production · multi-agent · governed</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#FF6B6B] text-[#0B1A33] font-semibold px-4 py-2 rounded-lg hover:bg-[#FF6B6B]/90 transition-colors text-sm"
        >
          + New Run
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[#FAF7F2] font-semibold text-lg">Recent Runs</h2>
          {data && <span className="text-[#8BA4C0] text-sm">{data.count} total</span>}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#1E3A5F] rounded-xl animate-pulse" />)}
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/40 rounded-xl p-4 text-red-400 text-sm">
            Could not reach API — make sure the backend is running:{' '}
            <code className="font-mono">make dev</code>
          </div>
        )}

        {data && data.runs.length === 0 && (
          <div className="text-center py-16 text-[#8BA4C0]">
            <div className="text-4xl mb-3">🔧</div>
            <p className="text-lg font-medium text-[#FAF7F2] mb-2">No runs yet</p>
            <p className="text-sm mb-6">Start your first ForgeFlow run to see the pipeline in action.</p>
            <button onClick={() => setShowForm(true)}
              className="bg-[#FF6B6B] text-[#0B1A33] font-semibold px-6 py-3 rounded-xl hover:bg-[#FF6B6B]/90 transition-colors">
              Start First Run
            </button>
          </div>
        )}

        {data && data.runs.length > 0 && (
          <div className="space-y-3">
            {data.runs.map(run => <RunCard key={run.run_id} run={run} />)}
          </div>
        )}
      </main>

      {showForm && <NewRunForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
