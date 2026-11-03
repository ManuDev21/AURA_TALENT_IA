import { useQuery } from '@tanstack/react-query'
import { Layers, Plus, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { queryKeys, skillsApi } from '@/api/talent'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraTagInput } from '@/components/aura/AuraTagInput'
import { FormAlert } from '@/features/auth/FormAlert'
import { applyServerErrors } from '@/features/auth/serverErrors'
import { FormActions } from '@/features/talent/CrudSection'
import { useAuraMutation } from '@/hooks/useAuraMutation'

const SKILL_TYPES = [
  { value: 'technical', label: 'Tecnica' },
  { value: 'programming_language', label: 'Lenguaje de programacion' },
  { value: 'framework', label: 'Framework / libreria' },
  { value: 'tool', label: 'Herramienta' },
  { value: 'platform', label: 'Plataforma' },
  { value: 'methodology', label: 'Metodologia' },
  { value: 'soft', label: 'Transversal' },
]

export function CatalogsPanel() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [creating, setCreating] = useState(false)
  const deferred = useDeferredValue(query.trim())
  const { data: categories = [] } = useQuery({ queryKey: queryKeys.skillCategories, queryFn: skillsApi.categories })
  const { data: skills = [], isFetching } = useQuery({
    queryKey: queryKeys.skills(deferred, category),
    queryFn: () => skillsApi.search(deferred, category || undefined, 100),
  })
  const categoryOptions = categories.map((c) => ({ value: c.code, label: c.name }))

  return (
    <AuraPanel
      eyebrow="Catalogos"
      title="Catalogo de habilidades"
      actions={
        !creating ? (
          <AuraButton variant="neo" size="sm" icon={Plus} onClick={() => setCreating(true)} className="mr-10">
            Nueva habilidad
          </AuraButton>
        ) : undefined
      }
    >
      {creating && <SkillCreateForm categoryOptions={categoryOptions} onDone={() => setCreating(false)} />}
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <AuraInput label="Buscar" icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre o sinonimo" />
        <AuraSelect label="Categoria" placeholder="Todas" options={categoryOptions} value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <p className="hud-label mt-4 text-graphite-400" aria-live="polite">
        {isFetching ? 'Buscando...' : `${skills.length} habilidades`}
      </p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {skills.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <span className="flex items-center gap-2 text-sm">
              <Layers className="h-3.5 w-3.5 text-aura-400" aria-hidden="true" />
              {s.name}
            </span>
            <span className="hud-label text-[0.6rem] text-graphite-400">{s.category?.name}</span>
          </li>
        ))}
      </ul>
    </AuraPanel>
  )
}

interface Values {
  name: string
  category_code: string
  skill_type: string
  aliases: string[]
}

function SkillCreateForm({ categoryOptions, onDone }: { categoryOptions: { value: string; label: string }[]; onDone: () => void }) {
  const [formError, setFormError] = useState('')
  const create = useAuraMutation({
    mutationFn: skillsApi.create,
    invalidate: [['skills']],
    success: (s) => `${s.name} agregada al catalogo.`,
    silentError: true,
  })
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    defaultValues: { name: '', category_code: '', skill_type: 'technical', aliases: [] },
  })
  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      await create.mutateAsync(v)
      onDone()
    } catch (err) {
      setFormError(applyServerErrors(err, setError, ['name', 'category_code', 'skill_type', 'aliases']))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="neo-inset mb-4 grid gap-3 rounded-xl p-4 md:grid-cols-3">
      <div className="md:col-span-3">
        <FormAlert message={formError} />
      </div>
      <AuraInput label="Nombre" error={errors.name?.message} {...register('name', { required: 'Obligatorio' })} />
      <AuraSelect label="Categoria" options={categoryOptions} error={errors.category_code?.message} {...register('category_code', { required: 'Obligatorio' })} />
      <AuraSelect label="Tipo" options={SKILL_TYPES} {...register('skill_type', { required: true })} />
      <div className="md:col-span-3">
        <Controller
          control={control}
          name="aliases"
          render={({ field }) => (
            <AuraTagInput label="Sinonimos" placeholder="Ej. JS, ECMAScript" value={field.value} onChange={field.onChange} max={10} />
          )}
        />
      </div>
      <div className="md:col-span-3">
        <FormActions onCancel={onDone} loading={create.isPending} />
      </div>
    </form>
  )
}
