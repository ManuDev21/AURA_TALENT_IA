import { apiDownload, apiRequest } from '@/api/client'
import type { SkillEvidence } from '@/types/talent'

export const passportKeys = { evidence: ['passport', 'evidence'] as const }

export const passportApi = {
  list: () => apiRequest<SkillEvidence[]>('/candidates/me/skill-evidence'),
  add: (data: {
    skill_id: string
    evidence_type: SkillEvidence['evidence_type']
    title: string
    description: string | null
    evidence_url: string | null
    issuer: string | null
    credential_ref: string | null
    share_with_companies: boolean
  }) => apiRequest<SkillEvidence>('/candidates/me/skill-evidence', { method: 'POST', body: data }),
  importBadge: (data: {
    skill_id: string
    credential_title: string
    issuer: string | null
    credential_ref: string | null
    credential_url: string | null
    evidence_url: string | null
    description: string | null
    share_with_companies: boolean
  }) => apiRequest<SkillEvidence>('/candidates/me/skill-evidence/open-badge', { method: 'POST', body: data }),
  share: (id: string, share_with_companies: boolean) =>
    apiRequest<SkillEvidence>(`/candidates/me/skill-evidence/${id}`, { method: 'PATCH', body: { share_with_companies } }),
  remove: (id: string) => apiRequest<void>(`/candidates/me/skill-evidence/${id}`, { method: 'DELETE' }),
  export: () => apiDownload('/candidates/me/skills-passport', 'aura-skills-passport.json'),
}
