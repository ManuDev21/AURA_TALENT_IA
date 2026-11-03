import { apiDownload, apiRequest } from '@/api/client'
import type {
  Applicant,
  ApplicationDetail,
  AppNotification,
  CompanyJob,
  JobPage,
  JobPayload,
  JobStatus,
  MyApplication,
  Note,
  PublicJob,
  Stage,
} from '@/types/jobs'

export const jobKeys = {
  search: (params: Record<string, string>) => ['jobs', 'search', params] as const,
  job: (id: string) => ['jobs', 'detail', id] as const,
  company: ['jobs', 'company'] as const,
  applicants: (jobId: string) => ['jobs', 'applicants', jobId] as const,
  application: (id: string) => ['applications', 'detail', id] as const,
  mine: ['applications', 'me'] as const,
  notifications: ['notifications'] as const,
}

export const jobsApi = {
  search: (params: Record<string, string>) => apiRequest<JobPage>(`/jobs?${new URLSearchParams(params)}`),
  get: (id: string) => apiRequest<PublicJob>(`/jobs/${id}`),
  companyJobs: () => apiRequest<CompanyJob[]>('/jobs/company'),
  create: (data: JobPayload) => apiRequest<CompanyJob>('/jobs', { method: 'POST', body: data }),
  update: (id: string, data: JobPayload) => apiRequest<CompanyJob>(`/jobs/${id}`, { method: 'PUT', body: data }),
  setStatus: (id: string, status: JobStatus) =>
    apiRequest<CompanyJob>(`/jobs/${id}/status`, { method: 'POST', body: { status } }),
  confirmActive: (id: string) => apiRequest<CompanyJob>(`/jobs/company/${id}/confirm-active`, { method: 'POST' }),
  importDrafts: (items: JobPayload[]) => apiRequest<{ created: number; job_ids: string[] }>('/jobs/company/import', { method: 'POST', body: { items } }),
  exportCompanyCsv: () => apiDownload('/jobs/company/export.csv', 'aura-vacantes.csv'),
  remove: (id: string) => apiRequest<void>(`/jobs/${id}`, { method: 'DELETE' }),
  applicants: (jobId: string) => apiRequest<Applicant[]>(`/jobs/${jobId}/applications`),
}

export const applicationsApi = {
  apply: (data: { job_id: string; resume_id?: string | null; cover_letter?: string | null }) =>
    apiRequest<MyApplication>('/applications', { method: 'POST', body: data }),
  mine: () => apiRequest<MyApplication[]>('/applications/me'),
  withdraw: (id: string) => apiRequest<MyApplication>(`/applications/${id}/withdraw`, { method: 'POST' }),
  detail: (id: string) => apiRequest<ApplicationDetail>(`/applications/${id}`),
  transition: (id: string, data: { to_stage: Stage; comment?: string | null; confirm?: boolean }) =>
    apiRequest<ApplicationDetail>(`/applications/${id}/transition`, { method: 'POST', body: data }),
  addNote: (id: string, data: { body: string; visibility: 'team' | 'private' }) =>
    apiRequest<Note>(`/applications/${id}/notes`, { method: 'POST', body: data }),
}

export const notificationsApi = {
  list: () => apiRequest<{ items: AppNotification[]; unread: number }>('/notifications/me'),
  read: (id: string) => apiRequest<void>(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => apiRequest<void>('/notifications/me/read-all', { method: 'POST' }),
}
