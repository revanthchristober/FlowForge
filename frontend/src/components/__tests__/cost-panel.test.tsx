import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CostPanel } from '../cost-panel'
import * as api from '@/lib/api'

vi.mock('@/lib/api')

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('CostPanel', () => {
  beforeEach(() => {
    vi.mocked(api.getRunCost).mockResolvedValue({
      run_id: 'test-123',
      total_usd: 0.0042,
      cap_usd: 5.0,
      breakdown_by_agent: {
        spec_analyst: 0.001,
        architecture: 0.002,
        code_generation: 0.0012,
      },
      breakdown_by_model: {
        'forge/planner': 0.003,
        'forge/worker': 0.0012,
      },
    })
  })

  it('renders total cost', async () => {
    render(<CostPanel runId="test-123" />, { wrapper })
    const total = await screen.findByText('$0.0042')
    expect(total).toBeInTheDocument()
  })

  it('renders by-agent section', async () => {
    render(<CostPanel runId="test-123" />, { wrapper })
    await screen.findByText('$0.0042')
    expect(screen.getByText('By Agent')).toBeInTheDocument()
  })

  it('renders by-model section with friendly names', async () => {
    render(<CostPanel runId="test-123" />, { wrapper })
    await screen.findByText('$0.0042')
    expect(screen.getByText('Planner (Sonnet)')).toBeInTheDocument()
    expect(screen.getByText('Worker (Groq)')).toBeInTheDocument()
  })

  it('shows cap percentage', async () => {
    render(<CostPanel runId="test-123" />, { wrapper })
    await screen.findByText('$0.0042')
    expect(screen.getByText(/of \$5.00 cap/)).toBeInTheDocument()
  })

  it('shows no costs message when empty', async () => {
    vi.mocked(api.getRunCost).mockResolvedValue({
      run_id: 'empty',
      total_usd: 0,
      cap_usd: 5.0,
      breakdown_by_agent: {},
      breakdown_by_model: {},
    })
    render(<CostPanel runId="empty" />, { wrapper })
    await screen.findByText('No costs tracked yet')
  })
})
