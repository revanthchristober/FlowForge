// TypeScript mirrors of backend Pydantic models (state.py + api.py)

export interface AuditEntry {
  ts: string
  agent: string
  event: string
  payload: Record<string, unknown>
  tokens_used: number
  cost_usd: number
  decision_actor: string | null
}

export interface Epic {
  id: string
  title: string
  description: string
  acceptance_criteria: string[]
}

export interface Task {
  id: string
  epic_id: string
  title: string
  description: string
  file_path: string
  dependencies: string[]
}

export interface ArchModule {
  name: string
  path: string
  responsibility: string
}

export interface Architecture {
  stack: Record<string, string>
  modules: ArchModule[]
  adr: string
  rationale: string
}

export interface Finding {
  id: string
  severity: 'info' | 'minor' | 'major' | 'blocker'
  category: 'security' | 'pattern' | 'test_coverage' | 'style' | 'logic'
  description: string
  file_path: string | null
  line_number: number | null
  suggested_fix: string | null
}

export interface EvalScores {
  prd_coverage: number | null
  review_precision: number | null
  build_test_pass: number | null
  doc_completeness: number | null
  overall?: number | null
}

export interface RunSummary {
  run_id: string
  status: 'running' | 'interrupted' | 'completed' | string
  next_agent: string
  budget_used_usd: number
  budget_cap_usd: number
  epic_count: number
  task_count: number
  has_architecture: boolean
  cost_breakdown: Record<string, number>
  interrupts: InterruptPayload[]
  eval_scores: EvalScores | null
}

export interface InterruptPayload {
  type: 'architecture_review' | 'code_review_gate' | string
  run_id: string
  proposal?: {
    stack: Record<string, string>
    modules: ArchModule[]
    adr: string
    rationale: string
  }
  findings?: Finding[]
  revision_count?: number
}

export interface CodeArtifactPreview {
  task_id: string
  file_path: string
  language: string
  content_preview: string
  has_tests: boolean
}

export interface FullRunState {
  run_id: string
  next_agent: string
  budget_used_usd: number
  budget_cap_usd: number
  epics: Epic[]
  tasks: Task[]
  architecture: Architecture | null
  architecture_approved: boolean
  code_artifacts: CodeArtifactPreview[]
  sandbox_results: Record<string, unknown>
  review_findings: Finding[]
  review_approved: boolean
  docs: Record<string, string>
  eval_scores: EvalScores | null
  interrupts: InterruptPayload[]
  audit_log: AuditEntry[]
}

export interface CostBreakdown {
  run_id: string
  total_usd: number
  cap_usd: number
  breakdown_by_agent: Record<string, number>
  breakdown_by_model: Record<string, number>
}

export interface EvalResult {
  run_id: string
  scores: EvalScores | null
  rationales: Record<string, string>
  overall?: number | null
  message?: string
}

export interface RunListItem {
  run_id: string
  first_ts: string | null
  last_ts: string | null
  agent_count: number
  total_cost_usd: number
  last_agent: string
  last_event: string
}

export interface SSEEvent {
  type: string
  node?: string
  run_id?: string
  data?: unknown
  db_id?: number
  error?: string
}
