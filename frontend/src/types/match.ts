export type RequirementStatus = 'met' | 'partial' | 'missing'

export interface MatchFactor {
  code: string
  label: string
  weight: number
  score: number
  detail: string
  evidence: string[]
}

export interface MatchRequirement {
  kind: 'skill' | 'experience' | 'education' | 'language' | 'certification'
  label: string
  status: RequirementStatus
  detail: string
  required: boolean
}

export interface MatchGap {
  kind: string
  name: string
  required: boolean
  detail: string
  skill_id?: string | null
}

export interface MatchResult {
  job_id: string
  job_title: string
  company_name: string
  score: number
  score_low: number
  score_high: number
  label: 'Alta' | 'Media' | 'Baja'
  factors: MatchFactor[]
  requirements: MatchRequirement[]
  strengths: string[]
  gaps: MatchGap[]
  recommendations: string[]
  data_completeness: number
  explanation: { method: string; data_used: string[]; not_used: string[]; limitations: string[] }
  model_version: string
  computed_at: string
  disclaimer: string
}

export interface MatchBrief {
  job_id: string
  job_title: string
  company_name: string
  modality: 'remote' | 'hybrid' | 'onsite'
  location: string | null
  score: number
  score_low: number
  score_high: number
  label: MatchResult['label']
  required_met: number
  required_total: number
  top_gap: string | null
}

export interface ApplicantMatch {
  application_id: string
  score: number
  score_low: number
  score_high: number
  label: MatchResult['label']
  required_met: number
  required_total: number
}

export interface GapReport {
  analyzed_jobs: number
  gaps: { name: string; kind: string; jobs_count: number; jobs: string[]; required_in: number; suggestion: string }[]
  strengths: string[]
  note: string
}
