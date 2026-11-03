export interface SkillCategory {
  code: string
  name: string
}

export interface Skill {
  id: string
  name: string
  slug: string
  skill_type: string
  category: SkillCategory | null
}

export interface SkillEvidence {
  id: string
  skill_id: string
  skill: Skill
  evidence_type: 'project' | 'credential' | 'certificate' | 'work_sample' | 'other'
  title: string
  description: string | null
  evidence_url: string | null
  issuer: string | null
  credential_ref: string | null
  source: 'candidate_submitted' | 'open_badge_import'
  share_with_companies: boolean
  created_at: string
}

export interface CandidateSkill {
  skill: Skill
  proficiency: number
  years_experience: string | null
  last_used_year: number | null
  source: string
  is_verified: boolean
}

export interface CandidateSkillPayload {
  proficiency: number
  years_experience?: number | null
  last_used_year?: number | null
}

export interface Profile {
  id: string
  headline: string | null
  summary: string | null
  location_city: string | null
  location_country: string | null
  availability: string | null
  work_modality: string | null
  desired_roles: string[]
  salary_expectation: string | null
  salary_currency: string | null
  goals: string | null
  interests: string[]
  is_discoverable: boolean
  completeness: number
}

export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'completeness' | 'salary_expectation'>> & {
  salary_expectation?: number | null
}

export interface Education {
  id: string
  institution: string
  degree: string | null
  field_of_study: string | null
  level: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
  source: string
}

export interface Experience {
  id: string
  company_name: string
  title: string
  employment_type: string | null
  location: string | null
  start_date: string
  end_date: string | null
  is_current: boolean
  description: string | null
  achievements: string[]
  source: string
}

export interface Certification {
  id: string
  name: string
  issuer: string | null
  issued_at: string | null
  expires_at: string | null
  credential_id: string | null
  credential_url: string | null
  source: string
}

export interface Language {
  id: string
  language_code: string
  level: string
  is_certified: boolean
  certificate_name: string | null
}

export interface ProfileLink {
  id: string
  link_type: string
  url: string
  label: string | null
  display_order: number
}

export interface CandidateOverview {
  full_name: string
  email: string
  profile: Profile
  education: Education[]
  experiences: Experience[]
  certifications: Certification[]
  languages: Language[]
  links: ProfileLink[]
  skills: CandidateSkill[]
  projects_count: number
}

export interface ItemKindMap {
  education: Education
  experiences: Experience
  certifications: Certification
  languages: Language
  links: ProfileLink
}
export type ItemKind = keyof ItemKindMap
export type ItemPayload<K extends ItemKind> = Omit<ItemKindMap[K], 'id' | 'source'>

export interface IndicatorFactor {
  skill: string
  proficiency: number
  years_experience: string | null
}

export interface Indicator {
  category_code: string
  category_name: string
  score: number
  skills_count: number
  factors: IndicatorFactor[]
}

export interface Indicators {
  indicators: Indicator[]
  method: string
  data_used: string[]
  limitations: string[]
  disclaimer: string
}

export interface Project {
  id: string
  title: string
  description: string | null
  role: string | null
  repo_url: string | null
  demo_url: string | null
  docs_url: string | null
  started_at: string | null
  ended_at: string | null
  is_featured: boolean
  display_order: number
  skills: Skill[]
}

export type ProjectPayload = Omit<Project, 'id' | 'skills'> & { skill_ids: string[] }

export interface PortfolioSettings {
  slug: string
  title: string | null
  visibility: 'private' | 'link' | 'public'
}

export interface PortfolioMe {
  settings: PortfolioSettings
  projects: Project[]
}

export interface PublicPortfolio {
  full_name: string
  title: string | null
  headline: string | null
  summary: string | null
  location: string | null
  projects: Project[]
  skills: { name: string; category: string | null; proficiency: number }[]
  links: ProfileLink[]
}

export interface Company {
  id: string
  name: string
  slug: string
  description: string | null
  sector: string | null
  location: string | null
  website: string | null
  size_range: string | null
  culture: string | null
  benefits: string[]
  contact_email: string | null
  status: string
}

export type CompanyUpdate = Partial<Omit<Company, 'id' | 'slug' | 'status'>>

export interface CompanyWorkspace {
  company: Company
  can_edit: boolean
  can_manage_members: boolean
}

export interface Member {
  user_id: string
  full_name: string
  email: string
  position: string | null
  status: string
  roles: string[]
  joined_at: string
}

export interface MemberInvite {
  email: string
  full_name: string
  role: 'ROLE_RECRUITER' | 'ROLE_COMPANY_ADMIN'
  position?: string | null
}
