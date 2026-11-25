export type ResumeTarget = 'general' | 'frontend' | 'backend' | 'data' | 'internship' | 'software' | 'custom'
export type ResumeTemplate = 'aura-classic' | 'aura-modern' | 'harvard'
export type SectionType =
  | 'header'
  | 'summary'
  | 'education'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'languages'
  | 'portfolio'
  | 'links'
  | 'custom'

export type SectionContent = Record<string, unknown>

export interface ResumeSection {
  id?: string
  section_type: SectionType
  title: string | null
  display_order?: number
  is_visible: boolean
  content: SectionContent
}

export interface ResumeSummary {
  id: string
  name: string
  target: ResumeTarget
  template: ResumeTemplate
  is_default: boolean
  version_no: number
  sections_count: number
  updated_at: string
}

export interface ResumeDetail extends ResumeSummary {
  sections: ResumeSection[]
}

export interface ResumeVersion {
  id: string
  version_no: number
  note: string | null
  created_at: string
  is_current: boolean
  sections_count: number
}

export interface Detected<T = string> {
  value: T
  confidence: number
  evidence: string
}

export interface ParsedExperience {
  title: string
  company_name: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
  achievements: string[]
  confidence: number
  evidence: string
}

export interface ParsedEducation {
  institution: string
  degree: string | null
  level: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  confidence: number
  evidence: string
}

export interface ParsedSkill {
  skill_id: string
  name: string
  category: string | null
  matched: string
  confidence: number
  evidence: string
}

export interface ParsedLanguage {
  language_code: string
  level: string | null
  confidence: number
  evidence: string
}

export interface ParsedCertification {
  name: string
  issuer: string | null
  confidence: number
  evidence: string
}

export interface ParsedLink {
  link_type: string
  url: string
  confidence: number
  evidence: string
}

export interface ParsedCv {
  fields: Partial<Record<'full_name' | 'email' | 'phone' | 'headline' | 'summary', Detected>>
  links: ParsedLink[]
  experiences: ParsedExperience[]
  education: ParsedEducation[]
  skills: ParsedSkill[]
  languages: ParsedLanguage[]
  certifications: ParsedCertification[]
  sections_found: string[]
  warnings: string[]
  stats: { characters: number; pages: number; lines: number }
}

export interface CvDocument {
  id: string
  original_filename: string
  mime_type: string
  size_bytes: number
  parse_status: 'pending' | 'processing' | 'done' | 'failed'
  parse_error: string | null
  parsed_data: ParsedCv | null
  confirmed_at: string | null
  created_at: string
}

export interface CvConfirmPayload {
  headline?: string | null
  summary?: string | null
  experiences: {
    company_name: string
    title: string
    start_date: string
    end_date: string | null
    is_current: boolean
    description: string | null
    achievements: string[]
  }[]
  education: {
    institution: string
    degree: string | null
    level: string | null
    start_date: string | null
    end_date: string | null
    is_current: boolean
  }[]
  certifications: { name: string; issuer: string | null }[]
  languages: { language_code: string; level: string }[]
  links: { link_type: string; url: string }[]
  skills: { skill_id: string; proficiency: number }[]
}

export interface ConfirmResult {
  created: Record<string, number>
  skipped: Record<string, number>
}
