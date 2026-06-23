'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRun, resumeRun } from '@/lib/api'
import type { InterruptPayload } from '@/lib/types'

const SEVERITY_COLORS: Record<string, string> = {
  blocker: 'text-red-400 bg-red-900/30',
  major: 'text-orange-400 bg-orange-900/30',
  minor: 'text-yellow-400 bg-yellow-900/30',
  info: 'text-blue-400 bg-blue-900/30',
}

function ArchitectureReview({ interrupt, onApprove, onRevise, loading }: {
  interrupt: InterruptPayload
  onApprove: () => void
  onRevise: (notes: string) => void
  loading: boolean
}) {
  const [showRevise, setShowRevise] = useState(false)
  const [notes, setNotes] = useState('')
  const proposal = interrupt.proposal

  return (
    <div className="space-y-4">
      <p className="text-muted text-xs uppercase tracking-wider">Architecture Proposal — Revision {(interrupt.revision_count ?? 0) + 1}</p>

      {proposal?.stack && (
        <div>
          <h4 className="text-cream text-xs font-semibold mb-2 uppercase">Tech Stack</h4>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(proposal.stack).map(([k, v]) => (
              <div key={k} className="flex gap-2 text-xs p-2 bg-navy/40 rounded">
                <span className="text-muted capitalize">{k}:</span>
                <span className="text-cream font-mono">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {proposal?.modules && proposal.modules.length > 0 && (
        <div>
          <h4 className="text-cream text-xs font-semibold mb-2 uppercase">Modules ({proposal.modules.length})</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {proposal.modules.map(m => (
              <div key={m.name} className="text-xs p-2 bg-navy/40 rounded flex gap-2">
                <span className="text-coral font-mono shrink-0">{m.path}</span>
                <span className="text-muted">{m.responsibility}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {proposal?.adr && (
        <div>
          <h4 className="text-cream text-xs font-semibold mb-2 uppercase">ADR</h4>
          <p className="text-muted text-xs leading-relaxed bg-navy/40 rounded p-3 line-clamp-4">{proposal.adr}</p>
        </div>
      )}

      {!showRevise ? (
        <div className="flex gap-3 pt-2">
          <button onClick={onApprove} disabled={loading}
            className="flex-1 bg-coral text-navy font-semibold py-2 px-4 rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors text-sm">
            {loading ? 'Processing…' : '✓ Approve'}
          </button>
          <button onClick={() => setShowRevise(true)} disabled={loading}
            className="flex-1 bg-navy border border-muted/40 text-cream py-2 px-4 rounded-lg hover:border-coral/60 disabled:opacity-50 transition-colors text-sm">
            ↺ Revise
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Describe what needs to change…"
            className="w-full bg-navy/60 border border-muted/40 rounded-lg p-3 text-cream text-sm placeholder-muted resize-none focus:outline-none focus:border-coral/60"
            rows={3} />
          <div className="flex gap-2">
            <button onClick={() => onRevise(notes)} disabled={loading || !notes.trim()}
              className="flex-1 bg-coral text-navy font-semibold py-2 px-4 rounded-lg hover:bg-coral/90 disabled:opacity-50 text-sm">
              Send Revision
            </button>
            <button onClick={() => setShowRevise(false)}
              className="px-4 py-2 text-muted hover:text-cream text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CodeReviewGate({ interrupt, onApprove, onRevise, loading }: {
  interrupt: InterruptPayload
  onApprove: () => void
  onRevise: (notes: string) => void
  loading: boolean
}) {
  const [showRevise, setShowRevise] = useState(false)
  const [notes, setNotes] = useState('')
  const findings = interrupt.findings ?? []

  return (
    <div className="space-y-4">
      <p className="text-muted text-xs uppercase tracking-wider">Code Review Gate</p>

      {findings.length > 0 ? (
        <div>
          <h4 className="text-cream text-xs font-semibold mb-2 uppercase">Findings ({findings.length})</h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {findings.map(f => (
              <div key={f.id} className={`text-xs p-2 rounded flex gap-2 ${SEVERITY_COLORS[f.severity] ?? 'text-cream bg-navy/40'}`}>
                <span className="font-mono uppercase shrink-0">[{f.severity}]</span>
                <span>{f.description}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-green-400 text-sm">✓ No issues found — clean code.</p>
      )}

      {!showRevise ? (
        <div className="flex gap-3 pt-2">
          <button onClick={onApprove} disabled={loading}
            className="flex-1 bg-coral text-navy font-semibold py-2 px-4 rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors text-sm">
            {loading ? 'Processing…' : '✓ Approve & Continue'}
          </button>
          <button onClick={() => setShowRevise(true)} disabled={loading}
            className="flex-1 bg-navy border border-muted/40 text-cream py-2 px-4 rounded-lg hover:border-coral/60 disabled:opacity-50 text-sm">
            ↺ Request Changes
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Describe what needs to change in the code…"
            className="w-full bg-navy/60 border border-muted/40 rounded-lg p-3 text-cream text-sm placeholder-muted resize-none focus:outline-none focus:border-coral/60"
            rows={3} />
          <div className="flex gap-2">
            <button onClick={() => onRevise(notes)} disabled={loading || !notes.trim()}
              className="flex-1 bg-coral text-navy font-semibold py-2 px-4 rounded-lg hover:bg-coral/90 disabled:opacity-50 text-sm">
              Send Feedback
            </button>
            <button onClick={() => setShowRevise(false)} className="px-4 py-2 text-muted hover:text-cream text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ApprovalPanel({ runId }: { runId: string }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => getRun(runId),
    refetchInterval: 3000,
  })

  const resume = useMutation({
    mutationFn: (decision: { approve: boolean; notes?: string }) => resumeRun(runId, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['run', runId] })
      queryClient.invalidateQueries({ queryKey: ['run-state', runId] })
    },
  })

  const isInterrupted = data?.status === 'interrupted'
  const interrupts: InterruptPayload[] = data?.interrupts ?? []
  const interrupt = interrupts[0] as InterruptPayload | undefined

  return (
    <div className="bg-slate rounded-xl p-5 h-full">
      <h2 className="text-cream font-semibold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
        <span>🔔</span> Approval Queue
        {isInterrupted && (
          <span className="ml-auto text-xs bg-coral/20 text-coral px-2 py-0.5 rounded-full animate-pulse">
            Action Required
          </span>
        )}
      </h2>

      {!isInterrupted || !interrupt ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted text-sm gap-2">
          <span className="text-2xl">✓</span>
          <span>No pending approvals</span>
          {data?.status === 'completed' && <span className="text-green-400 text-xs">Run completed</span>}
        </div>
      ) : interrupt.type === 'architecture_review' ? (
        <ArchitectureReview
          interrupt={interrupt}
          onApprove={() => resume.mutate({ approve: true })}
          onRevise={(notes) => resume.mutate({ approve: false, notes })}
          loading={resume.isPending}
        />
      ) : (
        <CodeReviewGate
          interrupt={interrupt}
          onApprove={() => resume.mutate({ approve: true })}
          onRevise={(notes) => resume.mutate({ approve: false, notes })}
          loading={resume.isPending}
        />
      )}

      {resume.isError && (
        <p className="text-red-400 text-xs mt-3">Error: {String(resume.error)}</p>
      )}
    </div>
  )
}
