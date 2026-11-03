export interface CatalogItem {
  assessment_id: string
  version_id: string
  code: string
  title: string
  description: string | null
  type_code: string
  type_name: string
  is_experimental: boolean
  question_count: number
  time_limit_seconds: number | null
  last_attempt: { id: string; status: string; overall_score: string | null; submitted_at: string | null } | null
  pending_assignments: { id: string; company_name: string; job_title: string | null; due_at: string | null }[]
}

export interface VersionIntro {
  version_id: string
  version_no: number
  title: string
  description: string | null
  type_code: string
  is_experimental: boolean
  instructions: string | null
  consent_text: string | null
  limitations_text: string | null
  disclaimer_text: string | null
  time_limit_seconds: number | null
  question_count: number
  requires_consent: boolean
}

export interface Question {
  id: string
  question_type: string
  stem: string
  context: Record<string, unknown> | null
  options: { id: string; label: string }[]
  scale: { min: number; max: number; labels: Record<string, string> } | null
}

export interface AttemptSession {
  attempt_id: string
  status: string
  version_id: string
  title: string
  type_code: string
  is_experimental: boolean
  started_at: string
  expires_at: string | null
  share_with_company: boolean
  assignment_company: string | null
  questions: Question[]
  answers: Record<string, { option_id: string | null; numeric_value: string | null }>
}

export interface DimensionResult {
  code: string
  name: string
  description: string | null
  score: string
  band: 'low' | 'moderate' | 'high'
  interpretation: string
  evidence: { stem: string; answer: string | null; reverse_keyed: boolean; contribution: number }[]
  recommendations: string[]
}

export interface ReviewItem {
  question_id: string
  stem: string
  selected: string | null
  is_correct: boolean | null
  correct: string | null
  rubric_score: number | null
  rationale: string | null
  best_option: string | null
  explanation: string | null
}

export interface AttemptResult {
  attempt_id: string
  title: string
  type_code: string
  is_experimental: boolean
  version_no: number
  submitted_at: string | null
  duration_seconds: number | null
  overall_score: string | null
  overall_band: 'low' | 'moderate' | 'high' | null
  summary: string | null
  recommendations: string[]
  dimensions: DimensionResult[]
  review: ReviewItem[]
  quality_notes: string[]
  disclaimer: string
  explanation: { method: string; data_used: string[]; limitations: string[] }
  share_with_company: boolean
  assignment_company: string | null
}

export interface AttemptSummary {
  id: string
  title: string
  type_code: string
  is_experimental: boolean
  status: string
  started_at: string
  submitted_at: string | null
  overall_score: string | null
  share_with_company: boolean
  assignment_company: string | null
}

export interface CompanyAssessmentView {
  assignment_id: string
  version_id: string
  title: string
  type_code: string
  is_experimental: boolean
  status: string
  due_at: string | null
  created_at: string
  shared: boolean
  result: {
    overall_score: string | null
    overall_band: string | null
    summary: string | null
    dimensions: DimensionResult[]
    quality_notes: string[]
    disclaimer: string
  } | null
}

export interface InstrumentSummary {
  id: string
  code: string
  title: string
  type_code: string
  is_experimental: boolean
  license_type: string
  versions: { id: string; version_no: number; status: string; published_at: string | null; question_count: number; attempts: number }[]
}
