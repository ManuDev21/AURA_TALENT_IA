import { apiRequest } from '@/api/client'
import type { ApplicantMatch, GapReport, MatchBrief, MatchResult } from '@/types/match'

export const matchKeys = {
  job: (id: string) => ['match', 'job', id] as const,
  top: ['match', 'top'] as const,
  gaps: ['match', 'gaps'] as const,
  application: (id: string) => ['match', 'application', id] as const,
  applicants: (jobId: string) => ['match', 'applicants', jobId] as const,
}

export const matchApi = {
  forJob: (jobId: string) => apiRequest<MatchResult>(`/match/me/jobs/${jobId}`),
  top: (limit = 12) => apiRequest<MatchBrief[]>(`/match/me/top?limit=${limit}`),
  gaps: () => apiRequest<GapReport>('/match/me/gaps'),
  forApplication: (applicationId: string) => apiRequest<MatchResult>(`/match/applications/${applicationId}`),
  applicants: (jobId: string) => apiRequest<ApplicantMatch[]>(`/match/jobs/${jobId}/applicants`),
}
