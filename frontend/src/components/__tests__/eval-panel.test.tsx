import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EvalPanel } from '../eval-panel'
import * as api from '@/lib/api'

vi.mock('@/lib/api')

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('EvalPanel', () => {
  it('shows N/A when no scores returned', async () => {
    vi.mocked(api.getRunEval).mockResolvedValue({
      run_id: 'abc',
      scores: null,
      rationales: {},
      message: 'not a golden PRD',
    })
    render(<EvalPanel runId="abc" />, { wrapper })
    await screen.findByText(/N\/A/)
  })

  it('renders overall score', async () => {
    vi.mocked(api.getRunEval).mockResolvedValue({
      run_id: 'abc',
      scores: {
        prd_coverage: 0.8,
        review_precision: 1.0,
        build_test_pass: 0.9,
        doc_completeness: 0.7,
      },
      rationales: {
        prd_coverage: '4/5 tasks matched.',
        review_precision: 'no seeded bugs expected',
        build_test_pass: '3 passed, 0 failed',
        doc_completeness: '4/5 sections present.',
      },
      overall: 0.85,
    })
    render(<EvalPanel runId="abc" />, { wrapper })
    await screen.findByText('85%') // overall
    expect(screen.getAllByText('85%').length).toBeGreaterThanOrEqual(1)
  })

  it('shows all 4 metric labels', async () => {
    vi.mocked(api.getRunEval).mockResolvedValue({
      run_id: 'abc',
      scores: { prd_coverage: 0.8, review_precision: 1.0, build_test_pass: 0.9, doc_completeness: 0.7 },
      rationales: {},
      overall: 0.85,
    })
    render(<EvalPanel runId="abc" />, { wrapper })
    await screen.findByText('PRD Coverage')
    expect(screen.getByText('Review Precision')).toBeInTheDocument()
    expect(screen.getByText('Build / Tests')).toBeInTheDocument()
    expect(screen.getByText('Doc Completeness')).toBeInTheDocument()
  })

  it('shows rationale text', async () => {
    vi.mocked(api.getRunEval).mockResolvedValue({
      run_id: 'abc',
      scores: { prd_coverage: 0.8, review_precision: null, build_test_pass: null, doc_completeness: null },
      rationales: { prd_coverage: '4/5 tasks matched. found: create, list' },
      overall: 0.8,
    })
    render(<EvalPanel runId="abc" />, { wrapper })
    await screen.findByText(/4\/5 tasks matched/)
  })
})
