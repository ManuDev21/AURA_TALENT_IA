import { apiRequest } from '@/api/client'
import type {
  AttemptResult,
  AttemptSession,
  AttemptSummary,
  CatalogItem,
  CompanyAssessmentView,
  InstrumentSummary,
  VersionIntro,
} from '@/types/assessments'

export const assessmentKeys = {
  catalog: ['assessments', 'catalog'] as const,
  history: ['assessments', 'history'] as const,
  intro: (id: string) => ['assessments', 'intro', id] as const,
  result: (id: string) => ['assessments', 'result', id] as const,
  assignable: ['assessments', 'assignable'] as const,
  forApplication: (id: string) => ['assessments', 'application', id] as const,
  instruments: ['psychometrics', 'instruments'] as const,
}

const A = '/assessments'

export const assessmentsApi = {
  catalog: () => apiRequest<CatalogItem[]>(`${A}/catalog`),
  history: () => apiRequest<AttemptSummary[]>(`${A}/attempts/me`),
  intro: (versionId: string) => apiRequest<VersionIntro>(`${A}/versions/${versionId}`),
  start: (data: { version_id: string; consent: boolean; assignment_id?: string | null }) =>
    apiRequest<AttemptSession>(`${A}/attempts`, { method: 'POST', body: data }),
  answer: (attemptId: string, data: { question_id: string; option_id?: string; numeric_value?: number; time_ms?: number }) =>
    apiRequest<void>(`${A}/attempts/${attemptId}/answers`, { method: 'PUT', body: data }),
  submit: (attemptId: string) => apiRequest<AttemptResult>(`${A}/attempts/${attemptId}/submit`, { method: 'POST' }),
  result: (attemptId: string) => apiRequest<AttemptResult>(`${A}/attempts/${attemptId}/result`),
  share: (attemptId: string, share: boolean) =>
    apiRequest<AttemptResult>(`${A}/attempts/${attemptId}/sharing`, { method: 'PATCH', body: { share_with_company: share } }),
  assignable: () =>
    apiRequest<{ version_id: string; title: string; type_code: string; is_experimental: boolean; question_count: number }[]>(
      `${A}/assignable`,
    ),
  assign: (data: { version_id: string; application_id: string; due_at?: string | null }) =>
    apiRequest<CompanyAssessmentView>(`${A}/assignments`, { method: 'POST', body: data }),
  forApplication: (applicationId: string) =>
    apiRequest<CompanyAssessmentView[]>(`/applications/${applicationId}/assessments`),
}

export const instrumentsApi = {
  list: () => apiRequest<InstrumentSummary[]>('/psychometrics/instruments'),
  detail: (versionId: string) => apiRequest<Record<string, unknown>>(`/psychometrics/versions/${versionId}`),
  action: (versionId: string, action: 'publish' | 'retire' | 'clone') =>
    apiRequest<Record<string, unknown>>(`/psychometrics/versions/${versionId}/${action}`, { method: 'POST' }),
  importDefinition: (definition: unknown) =>
    apiRequest<Record<string, unknown>>('/psychometrics/instruments', { method: 'POST', body: definition }),
}
