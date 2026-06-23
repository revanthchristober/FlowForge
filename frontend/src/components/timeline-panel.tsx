'use client'
import { useQuery } from '@tanstack/react-query'
import { getRunFullState } from '@/lib/api'
import type { AuditEntry } from '@/lib/types'

const AGENTS = ['spec_analyst', 'architecture', 'code_generation', 'code_review', 'documentation', 'evaluation']

const AGENT_LABELS: Record<string, string> = {
  spec_analyst: 'Spec Analyst',
  architecture: 'Architecture',
  code_generation: 'Code Generation',
  code_review: 'Code Review',
  documentation: 'Documentation',
  evaluation: 'Evaluation',
}

function agentStatus(agent: string, auditLog: AuditEntry[], nextAgent: string): 'pending' | 'running' | 'done' | 'error' {
  // Check if currently active first (before checking audit entries)
  if (nextAgent === agent) return 'running'
  const entries = auditLog.filter(e => e.agent === agent)
  if (entries.length === 0) return 'pending'
  if (entries.some(e => e.event === 'error')) return 'error'
  return 'done'
}

function agentCost(agent: string, auditLog: AuditEntry[]): number {
  return auditLog.filter(e => e.agent === agent).reduce((sum, e) => sum + e.cost_usd, 0)
}

function agentTokens(agent: string, auditLog: AuditEntry[]): number {
  return auditLog.filter(e => e.agent === agent).reduce((sum, e) => sum + e.tokens_used, 0)
}

function StatusDot({ status }: { status: 'pending' | 'running' | 'done' | 'error' }) {
  if (status === 'done') return <span className="text-green-400 text-lg">✓</span>
  if (status === 'running') return <span className="inline-block w-3 h-3 rounded-full bg-coral animate-pulse" />
  if (status === 'error') return <span className="text-red-400 text-lg">✗</span>
  return <span className="inline-block w-3 h-3 rounded-full bg-muted opacity-40" />
}

export function TimelinePanel({ runId }: { runId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['run-state', runId],
    queryFn: () => getRunFullState(runId),
    refetchInterval: (query) => {
      const next = query.state.data?.next_agent
      if (next === '__end__' || next === 'error' || next === 'budget_exceeded') return false
      return 3000
    },
  })

  if (isLoading) return <PanelSkeleton title="Pipeline Timeline" />

  const auditLog = data?.audit_log ?? []
  const nextAgent = data?.next_agent ?? ''

  return (
    <div className="bg-slate rounded-xl p-5 h-full">
      <h2 className="text-cream font-semibold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
        <span>🔄</span> Pipeline Timeline
      </h2>
      <div className="space-y-3">
        {AGENTS.map((agent) => {
          const status = agentStatus(agent, auditLog, nextAgent)
          const cost = agentCost(agent, auditLog)
          const tokens = agentTokens(agent, auditLog)
          return (
            <div key={agent} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              status === 'running' ? 'bg-navy/60 border border-coral/40' :
              status === 'done' ? 'bg-navy/40' : 'bg-navy/20 opacity-60'
            }`}>
              <div className="w-5 flex justify-center">
                <StatusDot status={status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-cream text-sm font-medium">{AGENT_LABELS[agent]}</div>
                {status !== 'pending' && (
                  <div className="text-muted text-xs mt-0.5">
                    {tokens > 0 && <span>{tokens.toLocaleString()} tokens</span>}
                    {cost > 0 && <span className="ml-2">${cost.toFixed(5)}</span>}
                  </div>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                status === 'done' ? 'bg-green-900/60 text-green-300' :
                status === 'running' ? 'bg-coral/20 text-coral' :
                status === 'error' ? 'bg-red-900/60 text-red-300' :
                'bg-navy/40 text-muted'
              }`}>{status}</span>
            </div>
          )
        })}
      </div>
      {auditLog.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate/50 text-muted text-xs">
          {auditLog.length} audit entries · next: {nextAgent}
        </div>
      )}
    </div>
  )
}

function PanelSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-slate rounded-xl p-5 h-full">
      <h2 className="text-cream font-semibold text-sm uppercase tracking-wider mb-4">{title}</h2>
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-12 bg-navy/40 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}
