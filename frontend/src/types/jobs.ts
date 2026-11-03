import type { ResumeSection } from '@/types/cv'
import type { CandidateSkill, Certification, Education, Experience, Language, ProfileLink, Skill, SkillEvidence } from '@/types/talent'

export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED'
export type Stage = 'APPLIED' | 'SCREENING' | 'ASSESSMENT' | 'INTERVIEW' | 'FINAL_REVIEW' | 'HIRED' | 'CLOSED'

export interface JobSkill {
  skill: Skill
  importance: 'required' | 'preferred'
  min_proficiency: number
  weight: string
}

export interface JobLanguage {
  language_code: string
  min_level: string
  is_required: boolean
}

export interface JobRequirement {
  id: string
  requirement_type: string
  description: string
  is_required: boolean
}

export interface Job {
  id: string
  title: string
  description: string
  location: string | null
  modality: 'remote' | 'hybrid' | 'onsite'
  employment_type: string
  salary_min: string | null
  salary_max: string | null
  salary_currency: string | null
  show_salary: boolean
  experience_min_years: string
  education_level: string | null
  responsibilities: string[]
  benefits: string[]
  schedule_description: string | null
  response_sla_days: number | null
  process_estimate_days: number | null
  last_confirmed_at: string | null
  transparency_score: number
  transparent_fields: string[]
  missing_transparency_fields: string[]
  status: JobStatus
  published_at: string | null
  closes_at: string | null
  created_at: string
  updated_at: string
  company: { id: string; name: string; slug: string; sector: string | null; location: string | null }
  skills: JobSkill[]
  languages: JobLanguage[]
  requirements: JobRequirement[]
}

export interface CompanyJob extends Job {
  applications_count: number
  stage_counts: Partial<Record<Stage, number>>
}

export interface PublicJob extends Job {
  my_application: { id: string; current_stage: Stage; status: string; applied_at: string } | null
}

export interface JobPage {
  items: PublicJob[]
  total: number
  limit: number
  offset: number
}

export interface JobPayload {
  title: string
  description: string
  location: string | null
  modality: string
  employment_type: string
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  show_salary: boolean
  experience_min_years: number
  education_level: string | null
  responsibilities: string[]
  benefits: string[]
  schedule_description: string | null
  response_sla_days: number | null
  process_estimate_days: number | null
  closes_at: string | null
  skills: { skill_id: string; importance: 'required' | 'preferred'; min_proficiency: number }[]
  languages: { language_code: string; min_level: string; is_required: boolean }[]
  requirements: { requirement_type: string; description: string; is_required: boolean }[]
}

export interface MyApplication {
  id: string
  job: Job
  current_stage: Stage
  status: 'active' | 'withdrawn' | 'hired' | 'closed'
  applied_at: string
  withdrawn_at: string | null
  last_update_at: string | null
  estimated_next_update_at: string | null
  timeline: { to_stage: Stage; created_at: string }[]
}

export interface Applicant {
  application_id: string
  candidate_id: string
  full_name: string
  headline: string | null
  location: string | null
  completeness: number
  top_skills: string[]
  current_stage: Stage
  status: string
  applied_at: string
}

export interface HistoryEntry {
  id: string
  from_stage: Stage | null
  to_stage: Stage
  actor_type: string
  comment: string | null
  created_at: string
}

export interface Note {
  id: string
  author_id: string | null
  author_name: string | null
  body: string
  visibility: 'team' | 'private'
  created_at: string
}

export interface ApplicationDetail {
  id: string
  job_id: string
  job_title: string
  current_stage: Stage
  status: string
  applied_at: string
  cover_letter: string | null
  allowed_transitions: Stage[]
  candidate: {
    full_name: string
    email: string
    headline: string | null
    summary: string | null
    location: string | null
    availability: string | null
    work_modality: string | null
    experiences: Experience[]
    education: Education[]
    certifications: Certification[]
    languages: Language[]
    links: ProfileLink[]
    skills: CandidateSkill[]
    shared_skill_evidence: SkillEvidence[]
  }
  resume_sections: ResumeSection[]
  history: HistoryEntry[]
  notes: Note[]
}

export interface AppNotification {
  id: string
  notification_type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}
