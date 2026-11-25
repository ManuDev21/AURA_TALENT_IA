import type { ResumeTarget, SectionType } from '@/types/cv'

export type FieldKind = 'text' | 'textarea' | 'month' | 'checkbox' | 'lines' | 'tags'

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  span?: 1 | 2
  placeholder?: string
}

export const SECTION_LABELS: Record<SectionType, string> = {
  header: 'Encabezado',
  summary: 'Perfil profesional',
  experience: 'Experiencia',
  education: 'Educacion',
  projects: 'Proyectos',
  skills: 'Habilidades',
  certifications: 'Certificaciones',
  languages: 'Idiomas',
  links: 'Enlaces',
  portfolio: 'Portfolio',
  custom: 'Seccion personalizada',
}

/** Titulos por defecto dentro del documento (con acentos: van al CV final). */
export const DEFAULT_TITLES: Record<SectionType, string | null> = {
  header: null,
  summary: 'Perfil profesional',
  experience: 'Experiencia',
  education: 'Educación',
  projects: 'Proyectos',
  skills: 'Habilidades',
  certifications: 'Certificaciones',
  languages: 'Idiomas',
  links: 'Enlaces',
  portfolio: 'Portfolio',
  custom: 'Información adicional',
}

export const TARGET_LABELS: Record<ResumeTarget, string> = {
  general: 'General',
  frontend: 'Frontend',
  backend: 'Backend',
  data: 'Data',
  internship: 'Practicas profesionales',
  software: 'Software Developer',
  custom: 'Personalizado',
}

export const TEMPLATE_LABELS = { 'aura-classic': 'Clasica', 'aura-modern': 'Moderna', harvard: 'Harvard' } as const

const LINK_FIELDS: FieldDef[] = [
  { key: 'label', label: 'Etiqueta', kind: 'text' },
  { key: 'url', label: 'URL', kind: 'text', placeholder: 'https://' },
]

/** Campos de cada elemento para las secciones de tipo lista. */
export const ITEM_FIELDS: Partial<Record<SectionType, FieldDef[]>> = {
  experience: [
    { key: 'title', label: 'Puesto', kind: 'text' },
    { key: 'company', label: 'Empresa', kind: 'text' },
    { key: 'location', label: 'Ubicacion', kind: 'text' },
    { key: 'current', label: 'Puesto actual', kind: 'checkbox' },
    { key: 'start', label: 'Inicio', kind: 'month' },
    { key: 'end', label: 'Fin', kind: 'month' },
    { key: 'description', label: 'Descripcion', kind: 'textarea', span: 2 },
    { key: 'achievements', label: 'Logros (uno por linea)', kind: 'lines', span: 2 },
  ],
  education: [
    { key: 'institution', label: 'Institucion', kind: 'text' },
    { key: 'degree', label: 'Titulo', kind: 'text' },
    { key: 'field', label: 'Area', kind: 'text' },
    { key: 'current', label: 'En curso', kind: 'checkbox' },
    { key: 'start', label: 'Inicio', kind: 'month' },
    { key: 'end', label: 'Fin', kind: 'month' },
    { key: 'description', label: 'Descripcion', kind: 'textarea', span: 2 },
  ],
  projects: [
    { key: 'title', label: 'Proyecto', kind: 'text' },
    { key: 'role', label: 'Rol', kind: 'text' },
    { key: 'description', label: 'Descripcion', kind: 'textarea', span: 2 },
    { key: 'url', label: 'URL', kind: 'text', span: 2 },
    { key: 'technologies', label: 'Tecnologias', kind: 'tags', span: 2 },
  ],
  certifications: [
    { key: 'name', label: 'Certificacion', kind: 'text' },
    { key: 'issuer', label: 'Emisor', kind: 'text' },
    { key: 'date', label: 'Fecha', kind: 'month' },
    { key: 'url', label: 'URL', kind: 'text' },
  ],
  languages: [
    { key: 'language', label: 'Idioma', kind: 'text' },
    { key: 'level', label: 'Nivel', kind: 'text', placeholder: 'Nativo, B2, Avanzado...' },
  ],
  links: LINK_FIELDS,
  portfolio: LINK_FIELDS,
}

export const HEADER_FIELDS: FieldDef[] = [
  { key: 'full_name', label: 'Nombre completo', kind: 'text' },
  { key: 'headline', label: 'Titular', kind: 'text' },
  { key: 'email', label: 'Correo', kind: 'text' },
  { key: 'phone', label: 'Telefono', kind: 'text' },
  { key: 'location', label: 'Ubicacion', kind: 'text', span: 2 },
]
export { LINK_FIELDS }

/** Primer campo de texto: se usa como titulo resumido de cada elemento. */
export function itemTitle(type: SectionType, item: Record<string, unknown>): string {
  const key = ITEM_FIELDS[type]?.[0]?.key
  return (key && typeof item[key] === 'string' && (item[key] as string)) || 'Sin titulo'
}

export function emptyItem(type: SectionType): Record<string, unknown> {
  const item: Record<string, unknown> = {}
  for (const f of ITEM_FIELDS[type] ?? []) {
    item[f.key] = f.kind === 'checkbox' ? false : f.kind === 'lines' || f.kind === 'tags' ? [] : ''
  }
  return item
}

export function emptyContent(type: SectionType): Record<string, unknown> {
  if (type === 'header') return { full_name: '', links: [] }
  if (type === 'summary' || type === 'custom') return { text: '' }
  if (type === 'skills') return { groups: [] }
  return { items: [] }
}

/** Limpia el contenido antes de enviarlo: cadenas vacias a null en campos opcionales. */
export function cleanContent(type: SectionType, content: Record<string, unknown>): Record<string, unknown> {
  const clean = (item: Record<string, unknown>, fields: FieldDef[]) => {
    const out: Record<string, unknown> = { ...item }
    fields.forEach((f, index) => {
      if ((f.kind === 'text' || f.kind === 'textarea' || f.kind === 'month') && out[f.key] === '' && index > 0) {
        out[f.key] = null
      }
      if (f.kind === 'lines' && Array.isArray(out[f.key])) {
        out[f.key] = (out[f.key] as string[]).map((l) => l.trim()).filter(Boolean)
      }
    })
    if (out.current === true && 'end' in out) out.end = null
    return out
  }
  const fields = ITEM_FIELDS[type]
  if (fields) {
    const items = (content.items as Record<string, unknown>[] | undefined) ?? []
    return { ...content, items: items.map((i) => clean(i, fields)) }
  }
  if (type === 'header') return clean(content, [{ key: '_', label: '', kind: 'text' }, ...HEADER_FIELDS.slice(1)])
  return content
}
