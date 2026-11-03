import { apiRequest } from '@/api/client'
import type {
  CandidateOverview,
  CandidateSkill,
  CandidateSkillPayload,
  CompanyUpdate,
  Company,
  CompanyWorkspace,
  Indicators,
  ItemKind,
  ItemKindMap,
  ItemPayload,
  Member,
  MemberInvite,
  PortfolioMe,
  PortfolioSettings,
  Profile,
  ProfileUpdate,
  Project,
  ProjectPayload,
  PublicPortfolio,
  Skill,
  SkillCategory,
} from '@/types/talent'

export const queryKeys = {
  candidate: ['candidate', 'overview'] as const,
  indicators: ['candidate', 'indicators'] as const,
  portfolio: ['portfolio', 'me'] as const,
  company: ['company', 'current'] as const,
  members: ['company', 'members'] as const,
  skills: (q: string, category?: string) => ['skills', q, category ?? ''] as const,
  skillCategories: ['skills', 'categories'] as const,
}

export const candidateApi = {
  overview: () => apiRequest<CandidateOverview>('/candidates/me'),
  updateProfile: (data: ProfileUpdate) => apiRequest<Profile>('/candidates/me/profile', { method: 'PATCH', body: data }),
  indicators: () => apiRequest<Indicators>('/candidates/me/indicators'),
  createItem: <K extends ItemKind>(kind: K, data: ItemPayload<K>) =>
    apiRequest<ItemKindMap[K]>(`/candidates/me/${kind}`, { method: 'POST', body: data }),
  updateItem: <K extends ItemKind>(kind: K, id: string, data: ItemPayload<K>) =>
    apiRequest<ItemKindMap[K]>(`/candidates/me/${kind}/${id}`, { method: 'PUT', body: data }),
  deleteItem: (kind: ItemKind, id: string) => apiRequest<void>(`/candidates/me/${kind}/${id}`, { method: 'DELETE' }),
  upsertSkill: (skillId: string, data: CandidateSkillPayload) =>
    apiRequest<CandidateSkill>(`/candidates/me/skills/${skillId}`, { method: 'PUT', body: data }),
  deleteSkill: (skillId: string) => apiRequest<void>(`/candidates/me/skills/${skillId}`, { method: 'DELETE' }),
}

export const skillsApi = {
  search: (q: string, category?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (q) params.set('q', q)
    if (category) params.set('category', category)
    return apiRequest<Skill[]>(`/skills?${params}`)
  },
  categories: () => apiRequest<SkillCategory[]>('/skills/categories'),
  create: (data: { name: string; category_code: string; skill_type: string; aliases: string[] }) =>
    apiRequest<Skill>('/skills', { method: 'POST', body: data }),
}

export const portfolioApi = {
  me: () => apiRequest<PortfolioMe>('/portfolio/me'),
  updateSettings: (data: Partial<PortfolioSettings>) =>
    apiRequest<PortfolioSettings>('/portfolio/me', { method: 'PATCH', body: data }),
  createProject: (data: ProjectPayload) => apiRequest<Project>('/portfolio/me/projects', { method: 'POST', body: data }),
  updateProject: (id: string, data: ProjectPayload) =>
    apiRequest<Project>(`/portfolio/me/projects/${id}`, { method: 'PUT', body: data }),
  deleteProject: (id: string) => apiRequest<void>(`/portfolio/me/projects/${id}`, { method: 'DELETE' }),
  public: (slug: string) => apiRequest<PublicPortfolio>(`/portfolio/public/${encodeURIComponent(slug)}`, { auth: false }),
}

export const companyApi = {
  current: () => apiRequest<CompanyWorkspace>('/companies/current'),
  update: (data: CompanyUpdate) => apiRequest<Company>('/companies/current', { method: 'PATCH', body: data }),
  members: () => apiRequest<Member[]>('/companies/current/members'),
  invite: (data: MemberInvite) => apiRequest<Member>('/companies/current/members', { method: 'POST', body: data }),
  removeMember: (userId: string) => apiRequest<void>(`/companies/current/members/${userId}`, { method: 'DELETE' }),
}
