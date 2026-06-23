import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TimelinePanel } from '../timeline-panel'
import * as api from '@/lib/api'

vi.mock('@/lib/api')

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const MOCK_STATE = {
  run_id: 'test',
  next_agent: 'code_generation',
  budget_used_usd: 0.03,
  budget_cap_usd: 5.0,
  epics: [],
  tasks: [],
  architecture: null,
  architecture_approved: true,
  code_artifacts: [],
  sandbox_results: {},
  review_findings: [],
  review_approved: false,
  docs: {},
  eval_scores: null,
  interrupts: [],
  audit_log: [
    { ts: '2026-01-01T00:00:00Z', agent: 'spec_analyst', event: 'analysis_complete', payload: {}, tokens_used: 500, cost_usd: 0.001, decision_actor: 'system' },
    { ts: '2026-01-01T00:01:00Z', agent: 'architecture', event: 'proposal_generated', payload: {}, tokens_used: 1000, cost_usd: 0.002, decision_actor: 'system' },
    { ts: '2026-01-01T00:02:00Z', agent: 'architecture', event: 'hitl_decision', payload: { approved: true }, tokens_used: 0, cost_usd: 0, decision_actor: 'human' },
  ],
}

describe('TimelinePanel', () => {
  beforeEach(() => {
    vi.mocked(api.getRunFullState).mockResolvedValue(MOCK_STATE)
  })

  it('shows all 6 agent names', async () => {
    render(<TimelinePanel runId="test" />, { wrapper })
    await screen.findByText('Spec Analyst')
    expect(screen.getByText('Architecture')).toBeInTheDocument()
    expect(screen.getByText('Code Generation')).toBeInTheDocument()
    expect(screen.getByText('Code Review')).toBeInTheDocument()
    expect(screen.getByText('Documentation')).toBeInTheDocument()
    expect(screen.getByText('Evaluation')).toBeInTheDocument()
  })

  it('shows done status for completed agents', async () => {
    render(<TimelinePanel runId="test" />, { wrapper })
    await screen.findByText('Spec Analyst')
    const doneItems = screen.getAllByText('done')
    expect(doneItems.length).toBeGreaterThanOrEqual(1)
  })

  it('shows running status for active agent', async () => {
    render(<TimelinePanel runId="test" />, { wrapper })
    await screen.findByText('Code Generation')
    expect(screen.getByText('running')).toBeInTheDocument()
  })

  it('shows audit entry count', async () => {
    render(<TimelinePanel runId="test" />, { wrapper })
    await screen.findByText(/3 audit entries/)
  })
})
