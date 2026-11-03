import { X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { portfolioApi, queryKeys } from '@/api/talent'
import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraTextarea } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { FormAlert } from '@/features/auth/FormAlert'
import { applyServerErrors } from '@/features/auth/serverErrors'
import { type FormRenderProps, FormActions } from '@/features/talent/CrudSection'
import { SkillPicker } from '@/features/talent/SkillPicker'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import type { Project, ProjectPayload, Skill } from '@/types/talent'
import { fromMonthInput, toMonthInput } from '@/utils/dates'

interface Values {
  title: string
  role: string
  description: string
  repo_url: string
  demo_url: string
  docs_url: string
  started_at: string
  ended_at: string
  is_featured: boolean
}

const FIELDS = ['title', 'role', 'description', 'repo_url', 'demo_url', 'docs_url', 'started_at', 'ended_at'] as const

export function ProjectForm({ item, onDone }: FormRenderProps<Project>) {
  const [skills, setSkills] = useState<Skill[]>(item?.skills ?? [])
  const [formError, setFormError] = useState('')
  const save = useAuraMutation({
    mutationFn: (data: ProjectPayload) => (item ? portfolioApi.updateProject(item.id, data) : portfolioApi.createProject(data)),
    invalidate: [queryKeys.portfolio, queryKeys.candidate],
    success: 'Proyecto guardado.',
    silentError: true,
  })
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    defaultValues: {
      title: item?.title ?? '',
      role: item?.role ?? '',
      description: item?.description ?? '',
      repo_url: item?.repo_url ?? '',
      demo_url: item?.demo_url ?? '',
      docs_url: item?.docs_url ?? '',
      started_at: toMonthInput(item?.started_at),
      ended_at: toMonthInput(item?.ended_at),
      is_featured: item?.is_featured ?? false,
    },
  })

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      await save.mutateAsync({
        title: v.title,
        role: v.role || null,
        description: v.description || null,
        repo_url: v.repo_url || null,
        demo_url: v.demo_url || null,
        docs_url: v.docs_url || null,
        started_at: fromMonthInput(v.started_at),
        ended_at: fromMonthInput(v.ended_at),
        is_featured: v.is_featured,
        display_order: item?.display_order ?? 0,
        skill_ids: skills.map((s) => s.id),
      })
      onDone()
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <FormAlert message={formError} />
      </div>
      <AuraInput label="Proyecto" error={errors.title?.message} {...register('title', { required: 'Obligatorio' })} />
      <AuraInput label="Tu rol" {...register('role')} />
      <AuraTextarea className="md:col-span-2" label="Descripcion" rows={3} {...register('description')} />
      <AuraInput label="Repositorio" type="url" placeholder="https://github.com/..." error={errors.repo_url?.message} {...register('repo_url')} />
      <AuraInput label="Demo" type="url" error={errors.demo_url?.message} {...register('demo_url')} />
      <AuraInput label="Documentacion" type="url" error={errors.docs_url?.message} {...register('docs_url')} />
      <div className="flex items-end pb-2">
        <AuraCheckbox label="Destacar en mi portfolio" {...register('is_featured')} />
      </div>
      <AuraInput label="Inicio" type="month" {...register('started_at')} />
      <AuraInput label="Fin" type="month" error={errors.ended_at?.message} {...register('ended_at')} />
      <div className="md:col-span-2">
        <SkillPicker label="Tecnologias utilizadas" excludeIds={skills.map((s) => s.id)} onSelect={(s) => setSkills((prev) => [...prev, s])} />
        {skills.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tecnologias seleccionadas">
            {skills.map((s) => (
              <li key={s.id} className="flex items-center gap-1 rounded-lg bg-aura-500/15 py-1 pl-2.5 pr-1 text-xs text-ember-300">
                {s.name}
                <button
                  type="button"
                  aria-label={`Quitar ${s.name}`}
                  onClick={() => setSkills((prev) => prev.filter((x) => x.id !== s.id))}
                  className="rounded p-0.5 hover:bg-white/10"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="md:col-span-2">
        <FormActions onCancel={onDone} loading={save.isPending} />
      </div>
    </form>
  )
}
