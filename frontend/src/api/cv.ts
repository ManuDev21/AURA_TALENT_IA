import { apiDownload, apiRequest, apiUpload } from '@/api/client'
import type {
  ConfirmResult,
  CvConfirmPayload,
  CvDocument,
  ResumeDetail,
  ResumeSection,
  ResumeSummary,
  ResumeTarget,
  ResumeTemplate,
  ResumeVersion,
} from '@/types/cv'

export const cvKeys = {
  resumes: ['cv', 'resumes'] as const,
  resume: (id: string) => ['cv', 'resume', id] as const,
  versions: (id: string) => ['cv', 'versions', id] as const,
  documents: ['cv', 'documents'] as const,
  document: (id: string) => ['cv', 'document', id] as const,
}

type SectionPayload = Pick<ResumeSection, 'section_type' | 'title' | 'is_visible' | 'content'>

export const cvApi = {
  list: () => apiRequest<ResumeSummary[]>('/cv/resumes'),
  get: (id: string) => apiRequest<ResumeDetail>(`/cv/resumes/${id}`),
  create: (data: { name: string; target: ResumeTarget; template: ResumeTemplate }) =>
    apiRequest<ResumeDetail>('/cv/resumes', { method: 'POST', body: data }),
  update: (id: string, data: Partial<Pick<ResumeSummary, 'name' | 'target' | 'template' | 'is_default'>>) =>
    apiRequest<ResumeDetail>(`/cv/resumes/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => apiRequest<void>(`/cv/resumes/${id}`, { method: 'DELETE' }),
  duplicate: (id: string, data: { name?: string; target?: ResumeTarget }) =>
    apiRequest<ResumeDetail>(`/cv/resumes/${id}/duplicate`, { method: 'POST', body: data }),
  saveSections: (id: string, sections: SectionPayload[]) =>
    apiRequest<ResumeDetail>(`/cv/resumes/${id}/sections`, { method: 'PUT', body: { sections } }),
  syncSection: (id: string, sectionId: string) =>
    apiRequest<ResumeDetail>(`/cv/resumes/${id}/sections/${sectionId}/sync`, { method: 'POST' }),
  versions: (id: string) => apiRequest<ResumeVersion[]>(`/cv/resumes/${id}/versions`),
  saveVersion: (id: string, note: string | null) =>
    apiRequest<ResumeDetail>(`/cv/resumes/${id}/versions`, { method: 'POST', body: { note } }),
  restore: (id: string, versionId: string) =>
    apiRequest<ResumeDetail>(`/cv/resumes/${id}/versions/${versionId}/restore`, { method: 'POST' }),
  exportPdf: (id: string, name: string) => apiDownload(`/cv/resumes/${id}/export.pdf`, `${name}.pdf`),

  documents: () => apiRequest<CvDocument[]>('/cv/documents'),
  document: (id: string) => apiRequest<CvDocument>(`/cv/documents/${id}`),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiUpload<CvDocument>('/cv/documents', form)
  },
  confirm: (id: string, data: CvConfirmPayload) =>
    apiRequest<ConfirmResult>(`/cv/documents/${id}/confirm`, { method: 'POST', body: data }),
  removeDocument: (id: string) => apiRequest<void>(`/cv/documents/${id}`, { method: 'DELETE' }),
}
