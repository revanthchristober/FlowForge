'use client'
import { useQuery } from '@tanstack/react-query'
import { getRunEval } from '@/lib/api'

const METRICS = [
  { key: 'prd_coverage', label: 'PRD Coverage', desc: 'Did spec analyst find all expected tasks?' },
  { key: 'review_precision', label: 'Review Precision', desc: 'Did reviewer catch all seeded bugs?' },
  { key: 'build_test_pass', label: 'Build / Tests', desc: 'Sandbox test pass rate' },
  { key: 'doc_completeness', label: 'Doc Completeness', desc: 'Required sections present?' },
] as const

function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'
  return <span className={`text-xl font-mono font-bold ${color}`}>{pct}%</span>
}

export function EvalPanel({ runId }: { runId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['run-eval', runId],
    queryFn: () => getRunEval(runId),
    refetchInterval: 5000,
  })

  if (isLoading) return <Skeleton />

  const scores = data?.scores
  const rationales = data?.rationales ?? {}
  const overall = data?.overall

  if (!scores) {
    return (
      <div className="bg-slate rounded-xl p-5 h-full">
        <h2 className="text-cream font-semibold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>📊</span> Eval Scorecard
        </h2>
        <div className="flex flex-col items-center justify-center h-32 text-muted text-sm gap-2 text-center">
          <span className="text-2xl">—</span>
          <span>N/A — not a golden PRD</span>
          <span className="text-xs">Run a golden PRD (todo_api, auth_unsafe…) to see scores</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate rounded-xl p-5 h-full">
      <h2 className="text-cream font-semibold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
        <span>📊</span> Eval Scorecard
      </h2>

      {overall != null && (
        <div className="text-center mb-4 py-3 bg-navy/40 rounded-lg">
          <div className="text-4xl font-mono font-bold text-coral">{Math.round(overall * 100)}%</div>
          <div className="text-muted text-xs mt-1">Overall Score</div>
        </div>
      )}

      <div className="space-y-3">
        {METRICS.map(({ key, label }) => {
          const score = scores[key]
          if (score == null) return null
          const pct = Math.round(score * 100)
          const barColor = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-cream text-xs font-medium">{label}</span>
                <ScoreRing score={score} />
              </div>
              <div className="h-1.5 bg-navy/60 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
              {rationales[key] && (
                <p className="text-muted text-xs leading-relaxed">{rationales[key]}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="bg-slate rounded-xl p-5 h-full">
      <h2 className="text-cream font-semibold text-sm uppercase tracking-wider mb-4">📊 Eval Scorecard</h2>
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-navy/40 rounded animate-pulse" />)}
      </div>
    </div>
  )
}
