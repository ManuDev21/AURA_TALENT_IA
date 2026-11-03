export type Option = { value: string; label: string }

const toOptions = (map: Record<string, string>): Option[] =>
  Object.entries(map).map(([value, label]) => ({ value, label }))

export const AVAILABILITY: Record<string, string> = {
  immediate: 'Inmediata',
  two_weeks: 'En 2 semanas',
  one_month: 'En 1 mes',
  negotiable: 'Negociable',
  not_available: 'No disponible',
}

export const WORK_MODALITY: Record<string, string> = {
  remote: 'Remoto',
  hybrid: 'Hibrido',
  onsite: 'Presencial',
  any: 'Cualquiera',
}

export const EDUCATION_LEVEL: Record<string, string> = {
  secondary: 'Bachillerato',
  technical: 'Tecnico',
  bachelor: 'Licenciatura / Ingenieria',
  master: 'Maestria',
  doctorate: 'Doctorado',
  bootcamp: 'Bootcamp',
  certificate: 'Diplomado / Curso',
  other: 'Otro',
}

export const EMPLOYMENT_TYPE: Record<string, string> = {
  full_time: 'Tiempo completo',
  part_time: 'Medio tiempo',
  contract: 'Por contrato',
  internship: 'Practicas',
  freelance: 'Freelance',
  temporary: 'Temporal',
  volunteer: 'Voluntariado',
}

export const LANGUAGE_LEVEL: Record<string, string> = {
  A1: 'A1 - Principiante',
  A2: 'A2 - Basico',
  B1: 'B1 - Intermedio',
  B2: 'B2 - Intermedio alto',
  C1: 'C1 - Avanzado',
  C2: 'C2 - Dominio',
  native: 'Nativo',
}

export const LANGUAGES: Record<string, string> = {
  es: 'Espanol',
  en: 'Ingles',
  pt: 'Portugues',
  fr: 'Frances',
  de: 'Aleman',
  it: 'Italiano',
  zh: 'Chino',
  ja: 'Japones',
  ko: 'Coreano',
}

export const LINK_TYPE: Record<string, string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  gitlab: 'GitLab',
  website: 'Sitio web',
  behance: 'Behance',
  other: 'Otro',
}

export const COMPANY_SIZE: Record<string, string> = {
  '1-10': '1 - 10 personas',
  '11-50': '11 - 50 personas',
  '51-200': '51 - 200 personas',
  '201-500': '201 - 500 personas',
  '501-1000': '501 - 1000 personas',
  '1000+': 'Mas de 1000',
}

export const PROFICIENCY: Record<number, string> = {
  1: 'Basico',
  2: 'En desarrollo',
  3: 'Competente',
  4: 'Avanzado',
  5: 'Experto',
}

export const options = {
  availability: toOptions(AVAILABILITY),
  modality: toOptions(WORK_MODALITY),
  educationLevel: toOptions(EDUCATION_LEVEL),
  employmentType: toOptions(EMPLOYMENT_TYPE),
  languageLevel: toOptions(LANGUAGE_LEVEL),
  languages: toOptions(LANGUAGES),
  linkType: toOptions(LINK_TYPE),
  companySize: toOptions(COMPANY_SIZE),
}
