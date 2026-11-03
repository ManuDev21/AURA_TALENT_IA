import { apiDownload, apiRequest } from '@/api/client'

export interface FunnelStep {
  stage: string
  label: string
  count: number
  rate_from_start: number
  rate_from_previous: number
}

export interface CompanyAnalytics {
  scope: { job_id: string | null; job_title: string | null; jobs: number }
  kpis: {
    jobs_published: number
    applications: number
    active: number
    hired: number
    closed: number
    withdrawn: number
    avg_match: number | null
    assessments_assigned: number
    assessments_completed: number
  }
  funnel: FunnelStep[]
  stage_durations: { stage: string; label: string; avg_days: number; samples: number }[]
  weekly: { week_start: string; count: number }[]
  top_skills: { name: string; count: number }[]
  top_gaps: { name: string; count: number }[]
  jobs: { id: string; title: string; status: string; applications: number }[]
  small_sample: boolean
  explanation: { method: string; data_used: string[]; limitations: string[] }
}

export interface PersonalAnalytics {
  kpis: {
    completeness: number
    skills: number
    applications: number
    active_applications: number
    assessments_completed: number
    avg_assessment: number | null
    best_match: number | null
    recommendations_acted: number
  }
  applications_by_stage: { stage: string; label: string; count: number }[]
  career_paths: { title: string; progress: number }[]
}

export const analyticsKeys = {
  company: (jobId: string) => ['analytics', 'company', jobId] as const,
  me: ['analytics', 'me'] as const,
}

export const analyticsApi = {
  company: (jobId?: string) => apiRequest<CompanyAnalytics>(`/analytics/company${jobId ? `?job_id=${jobId}` : ''}`),
  me: () => apiRequest<PersonalAnalytics>('/analytics/me'),
  vacancyReport: (jobId: string, fmt: 'pdf' | 'xlsx') => apiDownload(`/reports/jobs/${jobId}.${fmt}`, `reporte-vacante.${fmt}`),
  personalReport: () => apiDownload('/reports/me.pdf', 'reporte-perfil.pdf'),
}
