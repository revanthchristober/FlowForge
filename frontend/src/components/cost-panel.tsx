'use client'
import { useQuery } from '@tanstack/react-query'
import { getRunCost } from '@/lib/api'

const MODEL_LABELS: Record<string, string> = {
  'forge/planner': 'Planner (Sonnet)',
  'forge/worker': 'Worker (Groq)',
  'forge/judge': 'Judge (Haiku)',
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="text-cream font-mono">${value.toFixed(5)}</span>
      </div>
      <div className="h-1.5 bg-navy/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function CostPanel({ runId }: { runId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['run-cost', runId],
    queryFn: () => getRunCost(runId),
    refetchInterval: 5000,
  })

  if (isLoading) return <Skeleton />

  const total = data?.total_usd ?? 0
  const cap = data?.cap_usd ?? 5
  const capPct = cap > 0 ? Math.min((total / cap) * 100, 100) : 0
  const byAgent = Object.entries(data?.breakdown_by_agent ?? {})
  const byModel = Object.entries(data?.breakdown_by_model ?? {})
  const maxAgent = Math.max(...byAgent.map(([, v]) => v), 0.001)
  const maxModel = Math.max(...byModel.map(([, v]) => v), 0.001)

  return (
    <div className="bg-slate rounded-xl p-5 h-full">
      <h2 className="text-cream font-semibold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
        <span>💰</span> Cost Tracking
      </h2>

      {/* Big number */}
      <div className="text-center mb-5">
        <div className="text-3xl font-mono text-coral">${total.toFixed(4)}</div>
        <div className="text-muted text-xs mt-1">of ${cap.toFixed(2)} cap ({capPct.toFixed(1)}%)</div>
        <div className="mt-2 h-2 bg-navy/60 rounded-full overflow-hidden">
          <div className="h-full bg-coral rounded-full transition-all duration-500" style={{ width: `${capPct}%` }} />
        </div>
      </div>

      {/* By agent */}
      {byAgent.length > 0 && (
        <div className="mb-4">
          <h4 className="text-muted text-xs uppercase tracking-wider mb-2">By Agent</h4>
          <div className="space-y-2">
            {byAgent.sort(([, a], [, b]) => b - a).map(([agent, cost]) => (
              <Bar key={agent} label={agent.replace('_', ' ')} value={cost} max={maxAgent} color="bg-coral/70" />
            ))}
          </div>
        </div>
      )}

      {/* By model */}
      {byModel.length > 0 && (
        <div>
          <h4 className="text-muted text-xs uppercase tracking-wider mb-2">By Model</h4>
          <div className="space-y-2">
            {byModel.sort(([, a], [, b]) => b - a).map(([model, cost]) => (
              <Bar key={model} label={MODEL_LABELS[model] ?? model} value={cost} max={maxModel} color="bg-blue-500/60" />
            ))}
          </div>
        </div>
      )}

      {byAgent.length === 0 && byModel.length === 0 && (
        <div className="text-center text-muted text-sm py-8">No costs tracked yet</div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="bg-slate rounded-xl p-5 h-full">
      <h2 className="text-cream font-semibold text-sm uppercase tracking-wider mb-4">💰 Cost Tracking</h2>
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-8 bg-navy/40 rounded animate-pulse" />)}
      </div>
    </div>
  )
}
