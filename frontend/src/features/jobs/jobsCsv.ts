import { skillsApi } from '@/api/talent'
import type { JobPayload } from '@/types/jobs'

export async function parseJobsCsv(text: string): Promise<JobPayload[]> {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"'
      i += 1
    } else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      cell = ''
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
    } else cell += char
  }
  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  if (quoted || rows.length < 2) throw new Error('El archivo debe ser CSV válido e incluir encabezados y al menos una vacante.')
  const headerRow = rows[0]
  if (!headerRow) throw new Error('No se encontraron encabezados CSV.')
  const headers = headerRow.map((h) => h.replace(/^\uFEFF/, '').trim())
  if (rows.length - 1 > 25) throw new Error('Importa como máximo 25 vacantes a la vez.')
  if (!['title', 'description', 'modality'].every((key) => headers.includes(key))) {
    throw new Error('Faltan columnas requeridas: title, description, modality.')
  }
  const catalog = headers.includes('skills_json') ? await skillsApi.search('', undefined, 100) : []
  const skillIndex = new Map(catalog.map((skill) => [skill.name.toLocaleLowerCase(), skill.id]))
  return Promise.all(rows.slice(1).map(async (values, index): Promise<JobPayload> => {
    const rowData = Object.fromEntries(
      headers.map((header, column) => [header, values[column]?.trim() ?? '']),
    ) as Record<string, string>
    const get = (key: string) => rowData[key] ?? ''
    const number = (key: string) => (get(key) ? Number(get(key)) : null)
    const lines = (key: string) => (get(key) ? get(key).split('|').map((v) => v.trim()).filter(Boolean) : [])
    const json = <T,>(key: string, fallback: T): T => {
      if (!get(key)) return fallback
      try {
        return JSON.parse(get(key)) as T
      } catch {
        throw new Error(`La columna ${key} de la fila ${index + 2} no contiene JSON válido.`)
      }
    }
    if (!get('title') || get('description').length < 20) {
      throw new Error(`La fila ${index + 2} requiere título y descripción de al menos 20 caracteres.`)
    }
    if (!['remote', 'hybrid', 'onsite'].includes(get('modality'))) {
      throw new Error(`La fila ${index + 2} tiene una modalidad inválida.`)
    }
    const skillRows = json<{ name: string; importance: 'required' | 'preferred'; min_proficiency: number }[]>(
      'skills_json',
      [],
    )
    const skills: JobPayload['skills'] = []
    for (const item of skillRows) {
      let skillId = skillIndex.get(item.name.toLocaleLowerCase())
      if (!skillId) {
        const found = await skillsApi.search(item.name, undefined, 10)
        skillId = found.find((skill) => skill.name.toLocaleLowerCase() === item.name.toLocaleLowerCase())?.id ?? found[0]?.id
      }
      if (!skillId) throw new Error(`La habilidad "${item.name}" de la fila ${index + 2} no existe en el catálogo destino.`)
      skills.push({ skill_id: skillId, importance: item.importance, min_proficiency: item.min_proficiency })
    }
    return {
      title: get('title'),
      description: get('description'),
      location: get('location') || null,
      modality: get('modality'),
      employment_type: get('employment_type') || 'full_time',
      salary_min: number('salary_min'),
      salary_max: number('salary_max'),
      salary_currency: get('salary_currency') || null,
      show_salary: get('show_salary') === 'true',
      experience_min_years: number('experience_min_years') ?? 0,
      education_level: get('education_level') || null,
      responsibilities: lines('responsibilities'),
      benefits: lines('benefits'),
      schedule_description: get('schedule_description') || null,
      response_sla_days: number('response_sla_days'),
      process_estimate_days: number('process_estimate_days'),
      closes_at: get('closes_at') || null,
      skills,
      languages: json<JobPayload['languages']>('languages_json', []),
      requirements: json<JobPayload['requirements']>('requirements_json', []),
    }
  }))
}
