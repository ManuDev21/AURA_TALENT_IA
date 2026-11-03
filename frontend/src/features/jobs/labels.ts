import type { Job, JobStatus, Stage } from '@/types/jobs'

export const PIPELINE: Stage[] = ['APPLIED', 'SCREENING', 'ASSESSMENT', 'INTERVIEW', 'FINAL_REVIEW', 'HIRED', 'CLOSED']

export const STAGE_LABELS: Record<Stage, string> = {
  APPLIED: 'Postulado',
  SCREENING: 'Revision de perfil',
  ASSESSMENT: 'Evaluacion',
  INTERVIEW: 'Entrevista',
  FINAL_REVIEW: 'Revision final',
  HIRED: 'Contratado',
  CLOSED: 'Cerrado',
}

/** Como ve la persona candidata cada etapa (sin lenguaje de descarte). */
export const CANDIDATE_STAGE_LABELS: Record<Stage, string> = {
  APPLIED: 'Postulacion recibida',
  SCREENING: 'Perfil en revision',
  ASSESSMENT: 'Evaluacion',
  INTERVIEW: 'Entrevista',
  FINAL_REVIEW: 'Revision final',
  HIRED: 'Seleccionado',
  CLOSED: 'Proceso concluido',
}

/** Espejo de las transiciones permitidas en el backend (la validacion final siempre es del servidor). */
export const STAGE_TRANSITIONS: Record<Stage, Stage[]> = {
  APPLIED: ['SCREENING', 'CLOSED'],
  SCREENING: ['ASSESSMENT', 'INTERVIEW', 'CLOSED'],
  ASSESSMENT: ['INTERVIEW', 'SCREENING', 'CLOSED'],
  INTERVIEW: ['FINAL_REVIEW', 'ASSESSMENT', 'CLOSED'],
  FINAL_REVIEW: ['HIRED', 'INTERVIEW', 'CLOSED'],
  HIRED: [],
  CLOSED: [],
}

export const JOB_STATUS: Record<JobStatus, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  PUBLISHED: { label: 'Publicada', tone: 'success' },
  PAUSED: { label: 'Pausada', tone: 'warning' },
  CLOSED: { label: 'Cerrada', tone: 'danger' },
}

export const MODALITY: Record<string, string> = { remote: 'Remoto', hybrid: 'Hibrido', onsite: 'Presencial' }

export const JOB_EMPLOYMENT: Record<string, string> = {
  full_time: 'Tiempo completo',
  part_time: 'Medio tiempo',
  contract: 'Por contrato',
  internship: 'Practicas',
  temporary: 'Temporal',
}

export const JOB_EDUCATION: Record<string, string> = {
  none: 'Sin requisito',
  secondary: 'Bachillerato',
  technical: 'Tecnico',
  bachelor: 'Licenciatura / Ingenieria',
  master: 'Maestria',
  doctorate: 'Doctorado',
}

export function salaryText(job: Job): string | null {
  if (!job.salary_min && !job.salary_max) return null
  const fmt = (v: string | null) => (v ? Number(v).toLocaleString('es-MX', { maximumFractionDigits: 0 }) : '')
  const range = job.salary_min && job.salary_max ? `${fmt(job.salary_min)} - ${fmt(job.salary_max)}` : fmt(job.salary_min ?? job.salary_max)
  return `${range} ${job.salary_currency ?? ''}`.trim()
}
