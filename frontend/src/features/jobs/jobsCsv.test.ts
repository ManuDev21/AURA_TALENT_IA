import { beforeEach, describe, expect, it, vi } from 'vitest'

const { search } = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('@/api/talent', () => ({ skillsApi: { search } }))

import { parseJobsCsv } from '@/features/jobs/jobsCsv'

describe('parseJobsCsv', () => {
  beforeEach(() => search.mockReset())

  it('lee comas entrecomilladas, BOM y campos básicos sin perder el texto', async () => {
    const csv = '\uFEFFtitle,description,modality,responsibilities\r\n"Analista, Jr","Analizar datos, crear reportes y colaborar con producto.",remote,"SQL | Documentación"'
    const [job] = await parseJobsCsv(csv)
    expect(job).toMatchObject({
      title: 'Analista, Jr',
      description: 'Analizar datos, crear reportes y colaborar con producto.',
      modality: 'remote',
      responsibilities: ['SQL', 'Documentación'],
      skills: [],
    })
    expect(search).not.toHaveBeenCalled()
  })

  it('mapea nombres de habilidades al catálogo de destino y conserva condiciones', async () => {
    search.mockResolvedValueOnce([{ id: 'react-id', name: 'React' }])
    const csv = [
      'title,description,modality,response_sla_days,skills_json,languages_json,requirements_json',
      'Frontend,Construir interfaces y probar componentes,hybrid,5,"[{""name"":""React"",""importance"":""required"",""min_proficiency"":3}]","[{""language_code"":""en"",""min_level"":""B1"",""is_required"":true}]","[{""requirement_type"":""other"",""description"":""Portafolio"",""is_required"":true}]"',
    ].join('\n')
    const [job] = await parseJobsCsv(csv)
    expect(job?.skills).toEqual([{ skill_id: 'react-id', importance: 'required', min_proficiency: 3 }])
    expect(job?.response_sla_days).toBe(5)
    expect(job?.languages).toHaveLength(1)
    expect(job?.requirements[0]?.description).toBe('Portafolio')
  })

  it('rechaza CSVs sin campos mínimos o con demasiadas filas', async () => {
    await expect(parseJobsCsv('name,company\nA,B')).rejects.toThrow('Faltan columnas requeridas')
    const rows = ['title,description,modality', ...Array.from({ length: 26 }, (_, i) => `P${i},Descripción suficiente para el puesto,remote`)]
    await expect(parseJobsCsv(rows.join('\n'))).rejects.toThrow('máximo 25')
  })
})
