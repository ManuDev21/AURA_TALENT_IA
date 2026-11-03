import { Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { jobKeys, jobsApi } from '@/api/jobs'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraSelect, AuraTextarea } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { FormAlert } from '@/features/auth/FormAlert'
import { applyServerErrors } from '@/features/auth/serverErrors'
import { JOB_EDUCATION, JOB_EMPLOYMENT, MODALITY } from '@/features/jobs/labels'
import { SkillPicker } from '@/features/talent/SkillPicker'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import type { CompanyJob, JobPayload } from '@/types/jobs'
import type { Skill } from '@/types/talent'
import { options, PROFICIENCY } from '@/utils/labels'

const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }))

interface Values {
  title: string
  description: string
  location: string
  modality: string
  employment_type: string
  salary_min: string
  salary_max: string
  salary_currency: string
  show_salary: boolean
  experience_min_years: string
  education_level: string
  responsibilities: string
  benefits: string
  schedule_description: string
  response_sla_days: string
  process_estimate_days: string
  requirements: string
  closes_at: string
}

type SkillRow = { skill: Skill; importance: 'required' | 'preferred'; min_proficiency: number }
type LangRow = { language_code: string; min_level: string; is_required: boolean }

const FIELDS = ['title', 'description', 'location', 'modality', 'salary_min', 'salary_max', 'salary_currency', 'closes_at'] as const

export function JobForm({ job, onDone }: { job?: CompanyJob; onDone: () => void }) {
  const [skills, setSkills] = useState<SkillRow[]>(
    job?.skills.map((s) => ({ skill: s.skill, importance: s.importance, min_proficiency: s.min_proficiency })) ?? [],
  )
  const [languages, setLanguages] = useState<LangRow[]>(job?.languages ?? [])
  const [formError, setFormError] = useState('')
  const save = useAuraMutation({
    mutationFn: (data: JobPayload) => (job ? jobsApi.update(job.id, data) : jobsApi.create(data)),
    invalidate: [jobKeys.company],
    success: job ? 'Vacante actualizada.' : 'Vacante creada como borrador.',
    silentError: true,
  })
  const { register, handleSubmit, setError, watch, formState: { errors } } = useForm<Values>({
    defaultValues: {
      title: job?.title ?? '',
      description: job?.description ?? '',
      location: job?.location ?? '',
      modality: job?.modality ?? 'remote',
      employment_type: job?.employment_type ?? 'full_time',
      salary_min: job?.salary_min ?? '',
      salary_max: job?.salary_max ?? '',
      salary_currency: job?.salary_currency ?? 'MXN',
      show_salary: job?.show_salary ?? false,
      experience_min_years: job?.experience_min_years ?? '0',
      education_level: job?.education_level ?? '',
      responsibilities: job?.responsibilities.join('\n') ?? '',
      benefits: job?.benefits.join('\n') ?? '',
      schedule_description: job?.schedule_description ?? '',
      response_sla_days: job?.response_sla_days?.toString() ?? '',
      process_estimate_days: job?.process_estimate_days?.toString() ?? '',
      requirements: job?.requirements.map((r) => r.description).join('\n') ?? '',
      closes_at: job?.closes_at?.slice(0, 10) ?? '',
    },
  })

  const lines = (v: string) => v.split('\n').map((l) => l.trim()).filter(Boolean)
  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      await save.mutateAsync({
        title: v.title,
        description: v.description,
        location: v.location || null,
        modality: v.modality,
        employment_type: v.employment_type,
        salary_min: v.salary_min === '' ? null : Number(v.salary_min),
        salary_max: v.salary_max === '' ? null : Number(v.salary_max),
        salary_currency: v.salary_currency || null,
        show_salary: v.show_salary,
        experience_min_years: Number(v.experience_min_years || 0),
        education_level: v.education_level || null,
        responsibilities: lines(v.responsibilities),
        benefits: lines(v.benefits),
        schedule_description: v.schedule_description || null,
        response_sla_days: v.response_sla_days ? Number(v.response_sla_days) : null,
        process_estimate_days: v.process_estimate_days ? Number(v.process_estimate_days) : null,
        closes_at: v.closes_at ? new Date(`${v.closes_at}T23:59:59`).toISOString() : null,
        skills: skills.map((s) => ({ skill_id: s.skill.id, importance: s.importance, min_proficiency: s.min_proficiency })),
        languages,
        requirements: lines(v.requirements).map((description) => ({ requirement_type: 'other', description, is_required: true })),
      })
      onDone()
    } catch (err) {
      setFormError(applyServerErrors(err, setError, FIELDS))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <FormAlert message={formError} />
      </div>
      <AuraInput className="md:col-span-2" label="Titulo del puesto" error={errors.title?.message} {...register('title', { required: 'Obligatorio', minLength: { value: 3, message: 'Minimo 3 caracteres' } })} />
      <AuraTextarea
        className="md:col-span-2"
        label="Descripcion"
        rows={5}
        error={errors.description?.message}
        {...register('description', { required: 'Obligatorio', minLength: { value: 20, message: 'Describe la vacante (minimo 20 caracteres)' } })}
      />
      <AuraSelect label="Modalidad" placeholder="Seleccionar" options={opts(MODALITY)} {...register('modality', { required: true })} />
      <AuraSelect label="Tipo de contrato" options={opts(JOB_EMPLOYMENT)} {...register('employment_type', { required: true })} />
      <AuraInput label="Ubicacion" {...register('location')} />
      <AuraSelect label="Educacion minima" placeholder="Sin especificar" options={opts(JOB_EDUCATION)} {...register('education_level')} />
      <AuraInput label="Anos de experiencia minima" type="number" min={0} step={0.5} {...register('experience_min_years')} />
      <AuraInput label="Fecha de cierre (opcional)" type="date" error={errors.closes_at?.message} {...register('closes_at')} />
      <AuraInput label="Salario minimo" type="number" min={0} error={errors.salary_min?.message} {...register('salary_min')} />
      <AuraInput label="Salario maximo" type="number" min={0} error={errors.salary_max?.message} {...register('salary_max')} />
      <AuraInput label="Moneda" maxLength={3} {...register('salary_currency')} />
      <div className="flex items-end pb-2">
        <AuraCheckbox label="Mostrar el salario a los candidatos" {...register('show_salary')} />
      </div>
      <AuraTextarea className="md:col-span-2" label="Responsabilidades (una por linea)" rows={3} {...register('responsibilities')} />
      <AuraTextarea className="md:col-span-2" label="Beneficios (uno por linea)" rows={2} {...register('benefits')} />
      <AuraInput className="md:col-span-2" label="Horario y zona horaria" placeholder="Ej. Lunes a viernes, 9:00-18:00 CST" {...register('schedule_description')} />
      <AuraInput label="Plazo de respuesta esperado (días, 1-30)" type="number" min={1} max={30} {...register('response_sla_days')} />
      <AuraInput label="Duración estimada del proceso (días, 1-180)" type="number" min={1} max={180} {...register('process_estimate_days')} />

      <section className="flex flex-col gap-2 md:col-span-2" aria-label="Habilidades de la vacante">
        <SkillPicker
          label="Habilidades"
          excludeIds={skills.map((s) => s.skill.id)}
          onSelect={(skill) => setSkills((prev) => [...prev, { skill, importance: 'required', min_proficiency: 3 }])}
        />
        {skills.map((row, i) => (
          <div key={row.skill.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
            <span className="flex-1 text-bone">{row.skill.name}</span>
            <select
              aria-label={`Importancia de ${row.skill.name}`}
              value={row.importance}
              onChange={(e) => setSkills(skills.map((s, k) => (k === i ? { ...s, importance: e.target.value as SkillRow['importance'] } : s)))}
              className="neo-inset h-8 rounded-lg bg-transparent px-2 text-xs text-bone [&>option]:bg-graphite-900"
            >
              <option value="required">Requerida</option>
              <option value="preferred">Deseable</option>
            </select>
            <select
              aria-label={`Nivel minimo de ${row.skill.name}`}
              value={row.min_proficiency}
              onChange={(e) => setSkills(skills.map((s, k) => (k === i ? { ...s, min_proficiency: Number(e.target.value) } : s)))}
              className="neo-inset h-8 rounded-lg bg-transparent px-2 text-xs text-bone [&>option]:bg-graphite-900"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  Nivel {n} - {PROFICIENCY[n]}
                </option>
              ))}
            </select>
            <AuraButton variant="ghost" size="icon" aria-label={`Quitar ${row.skill.name}`} onClick={() => setSkills(skills.filter((_, k) => k !== i))}>
              <Trash2 className="h-4 w-4" />
            </AuraButton>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2 md:col-span-2" aria-label="Idiomas de la vacante">
        <span className="hud-label text-graphite-300">Idiomas</span>
        {languages.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
            <AuraSelect label="Idioma" options={options.languages} value={row.language_code} onChange={(e) => setLanguages(languages.map((l, k) => (k === i ? { ...l, language_code: e.target.value } : l)))} />
            <AuraSelect label="Nivel minimo" options={options.languageLevel} value={row.min_level} onChange={(e) => setLanguages(languages.map((l, k) => (k === i ? { ...l, min_level: e.target.value } : l)))} />
            <div className="pt-6">
              <AuraCheckbox label="Requerido" checked={row.is_required} onChange={(e) => setLanguages(languages.map((l, k) => (k === i ? { ...l, is_required: e.target.checked } : l)))} />
            </div>
            <div className="pt-6">
              <AuraButton variant="ghost" size="icon" aria-label="Quitar idioma" onClick={() => setLanguages(languages.filter((_, k) => k !== i))}>
                <Trash2 className="h-4 w-4" />
              </AuraButton>
            </div>
          </div>
        ))}
        <AuraButton variant="ghost" size="sm" icon={Plus} className="self-start" onClick={() => setLanguages([...languages, { language_code: 'en', min_level: 'B1', is_required: true }])}>
          Agregar idioma
        </AuraButton>
      </section>

      <AuraTextarea className="md:col-span-2" label="Otros requisitos (uno por linea)" rows={3} {...register('requirements')} />
      <p className="text-xs text-graphite-400 md:col-span-2">
        La ficha de transparencia muestra a las personas postulantes qué información está publicada. El plazo de respuesta es un compromiso orientativo de tu equipo.
      </p>
      <p className="text-xs text-graphite-400 md:col-span-2">
        Describe requisitos relacionados con el puesto. No incluyas edad, genero, estado civil, fotografia ni otros datos que puedan
        generar discriminacion.
      </p>
      <div className="flex justify-end gap-2 md:col-span-2">
        <AuraButton variant="ghost" onClick={onDone}>
          Cancelar
        </AuraButton>
        <AuraButton type="submit" icon={Save} loading={save.isPending} disabled={!watch('title')}>
          {job ? 'Guardar cambios' : 'Crear borrador'}
        </AuraButton>
      </div>
    </form>
  )
}
