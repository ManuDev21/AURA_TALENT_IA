import { Save } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraSelect, AuraTextarea } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraTagInput } from '@/components/aura/AuraTagInput'
import { FormAlert } from '@/features/auth/FormAlert'
import { applyServerErrors } from '@/features/auth/serverErrors'
import { useUpdateProfile } from '@/features/talent/useProfileData'
import type { Profile } from '@/types/talent'
import { options } from '@/utils/labels'

interface Values {
  headline: string
  summary: string
  location_city: string
  location_country: string
  availability: string
  work_modality: string
  desired_roles: string[]
  interests: string[]
  goals: string
  salary_expectation: string
  salary_currency: string
  is_discoverable: boolean
}

const FIELDS = [
  'headline',
  'summary',
  'location_city',
  'location_country',
  'availability',
  'work_modality',
  'desired_roles',
  'interests',
  'goals',
  'salary_expectation',
  'salary_currency',
] as const

export function ProfileSummaryForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const [formError, setFormError] = useState('')
  const { register, control, handleSubmit, setError, reset, formState: { errors, isDirty } } = useForm<Values>({
    defaultValues: {
      headline: profile.headline ?? '',
      summary: profile.summary ?? '',
      location_city: profile.location_city ?? '',
      location_country: profile.location_country ?? '',
      availability: profile.availability ?? '',
      work_modality: profile.work_modality ?? '',
      desired_roles: profile.desired_roles,
      interests: profile.interests,
      goals: profile.goals ?? '',
      salary_expectation: profile.salary_expectation ?? '',
      salary_currency: profile.salary_currency ?? 'MXN',
      is_discoverable: profile.is_discoverable,
    },
  })

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      await update.mutateAsync({
        headline: v.headline || null,
        summary: v.summary || null,
        location_city: v.location_city || null,
        location_country: v.location_country || null,
        availability: v.availability || null,
        work_modality: v.work_modality || null,
        desired_roles: v.desired_roles,
        interests: v.interests,
        goals: v.goals || null,
        salary_expectation: v.salary_expectation === '' ? null : Number(v.salary_expectation),
        salary_currency: v.salary_currency || null,
        is_discoverable: v.is_discoverable,
      })
      reset(v)
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <FormAlert message={formError} />
      </div>
      <AuraInput
        className="md:col-span-2"
        label="Titular profesional"
        placeholder="Ej. Desarrolladora Frontend | React y TypeScript"
        error={errors.headline?.message}
        {...register('headline')}
      />
      <AuraTextarea
        className="md:col-span-2"
        label="Resumen"
        rows={4}
        hint="Minimo 80 caracteres para contar en la completitud del perfil."
        error={errors.summary?.message}
        {...register('summary')}
      />
      <AuraInput label="Ciudad" {...register('location_city')} />
      <AuraInput label="Pais" {...register('location_country')} />
      <AuraSelect label="Disponibilidad" options={options.availability} {...register('availability')} />
      <AuraSelect label="Modalidad preferida" options={options.modality} {...register('work_modality')} />
      <div className="md:col-span-2">
        <Controller
          control={control}
          name="desired_roles"
          render={({ field }) => (
            <AuraTagInput label="Roles objetivo" placeholder="Frontend Developer..." value={field.value} onChange={field.onChange} error={errors.desired_roles?.message} />
          )}
        />
      </div>
      <div className="md:col-span-2">
        <Controller
          control={control}
          name="interests"
          render={({ field }) => <AuraTagInput label="Intereses" placeholder="IA, UX, datos..." value={field.value} onChange={field.onChange} />}
        />
      </div>
      <AuraTextarea className="md:col-span-2" label="Objetivos profesionales" rows={2} {...register('goals')} />
      <AuraInput label="Expectativa salarial mensual" type="number" min={0} error={errors.salary_expectation?.message} {...register('salary_expectation')} />
      <AuraInput label="Moneda" maxLength={3} error={errors.salary_currency?.message} {...register('salary_currency')} />
      <div className="md:col-span-2">
        <AuraCheckbox
          label="Permitir que empresas encuentren mi perfil (puedes desactivarlo en cualquier momento)"
          {...register('is_discoverable')}
        />
      </div>
      <div className="flex justify-end md:col-span-2">
        <AuraButton type="submit" icon={Save} loading={update.isPending} disabled={!isDirty}>
          Guardar perfil
        </AuraButton>
      </div>
    </form>
  )
}
