import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraSelect, AuraTextarea } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { FormAlert } from '@/features/auth/FormAlert'
import { type FormRenderProps, FormActions } from '@/features/talent/CrudSection'
import { useItemForm } from '@/features/talent/useItemForm'
import type { Education } from '@/types/talent'
import { fromMonthInput, toMonthInput } from '@/utils/dates'
import { options } from '@/utils/labels'

interface Values {
  institution: string
  degree: string
  field_of_study: string
  level: string
  start_date: string
  end_date: string
  is_current: boolean
  description: string
}

export function EducationForm({ item, onDone }: FormRenderProps<Education>) {
  const { form, onSubmit, formError, saving } = useItemForm<'education', Values>({
    kind: 'education',
    itemId: item?.id,
    onDone,
    defaults: {
      institution: item?.institution ?? '',
      degree: item?.degree ?? '',
      field_of_study: item?.field_of_study ?? '',
      level: item?.level ?? '',
      start_date: toMonthInput(item?.start_date),
      end_date: toMonthInput(item?.end_date),
      is_current: item?.is_current ?? false,
      description: item?.description ?? '',
    },
    toPayload: (v) => ({
      institution: v.institution,
      degree: v.degree || null,
      field_of_study: v.field_of_study || null,
      level: v.level || null,
      start_date: fromMonthInput(v.start_date),
      end_date: v.is_current ? null : fromMonthInput(v.end_date),
      is_current: v.is_current,
      description: v.description || null,
    }),
  })
  const { register, watch, formState: { errors } } = form

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <FormAlert message={formError} />
      </div>
      <AuraInput
        className="md:col-span-2"
        label="Institucion"
        error={errors.institution?.message}
        {...register('institution', { required: 'Obligatorio' })}
      />
      <AuraInput label="Titulo o grado" {...register('degree')} />
      <AuraInput label="Area de estudio" {...register('field_of_study')} />
      <AuraSelect label="Nivel" options={options.educationLevel} {...register('level')} />
      <div className="flex items-end pb-2">
        <AuraCheckbox label="Estudio aqui actualmente" {...register('is_current')} />
      </div>
      <AuraInput label="Inicio" type="month" {...register('start_date')} />
      <AuraInput label="Fin" type="month" disabled={watch('is_current')} error={errors.end_date?.message} {...register('end_date')} />
      <AuraTextarea className="md:col-span-2" label="Descripcion" rows={2} {...register('description')} />
      <div className="md:col-span-2">
        <FormActions onCancel={onDone} loading={saving} />
      </div>
    </form>
  )
}
