// API client — calls go through Next.js proxy /api/* → backend
import type {
  CostBreakdown,
  EvalResult,
  FullRunState,
  RunListItem,
  RunSummary,
} from './types'

// Use proxy path — works on any IP, no CORS issues
const BASE_URL = '/api'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${path} failed ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function listRuns(limit = 50): Promise<{ runs: RunListItem[]; count: number }> {
  return apiFetch(`/runs?limit=${limit}`)
}

export async function getRun(id: string): Promise<RunSummary> {
  return apiFetch(`/runs/${id}`)
}

export async function getRunFullState(id: string): Promise<FullRunState> {
  return apiFetch(`/runs/${id}/state`)
}

export async function getRunCost(id: string): Promise<CostBreakdown> {
  return apiFetch(`/runs/${id}/cost`)
}

export async function getRunEval(id: string): Promise<EvalResult> {
  return apiFetch(`/runs/${id}/eval`)
}

export async function startRun(prd: string, budgetCapUsd = 5.0, runId?: string): Promise<{ run_id: string; status: string }> {
  return apiFetch('/runs', {
    method: 'POST',
    body: JSON.stringify({ prd, budget_cap_usd: budgetCapUsd, run_id: runId }),
  })
}

export async function resumeRun(id: string, decision: { approve: boolean; notes?: string }): Promise<{ run_id: string; status: string; next_agent: string }> {
  return apiFetch(`/runs/${id}/resume`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  })
}

export function getSSEUrl(runId: string, afterId = 0): string {
  // SSE also goes through proxy
  return `/api/runs/${runId}/events?after_id=${afterId}`
}
