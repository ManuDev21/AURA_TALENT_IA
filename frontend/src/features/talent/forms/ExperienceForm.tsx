import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraSelect, AuraTextarea } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { FormAlert } from '@/features/auth/FormAlert'
import { type FormRenderProps, FormActions } from '@/features/talent/CrudSection'
import { useItemForm } from '@/features/talent/useItemForm'
import type { Experience } from '@/types/talent'
import { fromMonthInput, toMonthInput } from '@/utils/dates'
import { options } from '@/utils/labels'

interface Values {
  company_name: string
  title: string
  employment_type: string
  location: string
  start_date: string
  end_date: string
  is_current: boolean
  description: string
  achievements: string
}

export function ExperienceForm({ item, onDone }: FormRenderProps<Experience>) {
  const { form, onSubmit, formError, saving } = useItemForm<'experiences', Values>({
    kind: 'experiences',
    itemId: item?.id,
    onDone,
    defaults: {
      company_name: item?.company_name ?? '',
      title: item?.title ?? '',
      employment_type: item?.employment_type ?? '',
      location: item?.location ?? '',
      start_date: toMonthInput(item?.start_date),
      end_date: toMonthInput(item?.end_date),
      is_current: item?.is_current ?? false,
      description: item?.description ?? '',
      achievements: item?.achievements.join('\n') ?? '',
    },
    toPayload: (v) => ({
      company_name: v.company_name,
      title: v.title,
      employment_type: v.employment_type || null,
      location: v.location || null,
      start_date: fromMonthInput(v.start_date) ?? '',
      end_date: v.is_current ? null : fromMonthInput(v.end_date),
      is_current: v.is_current,
      description: v.description || null,
      achievements: v.achievements.split('\n').map((a) => a.trim()).filter(Boolean),
    }),
  })
  const { register, watch, formState: { errors } } = form
  const current = watch('is_current')

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <FormAlert message={formError} />
      </div>
      <AuraInput label="Puesto" error={errors.title?.message} {...register('title', { required: 'Obligatorio' })} />
      <AuraInput label="Empresa" error={errors.company_name?.message} {...register('company_name', { required: 'Obligatorio' })} />
      <AuraSelect label="Tipo" options={options.employmentType} {...register('employment_type')} />
      <AuraInput label="Ubicacion" {...register('location')} />
      <AuraInput label="Inicio" type="month" error={errors.start_date?.message} {...register('start_date', { required: 'Obligatorio' })} />
      <AuraInput label="Fin" type="month" disabled={current} error={errors.end_date?.message} {...register('end_date')} />
      <div className="md:col-span-2">
        <AuraCheckbox label="Trabajo aqui actualmente" {...register('is_current')} />
      </div>
      <AuraTextarea className="md:col-span-2" label="Descripcion" rows={3} {...register('description')} />
      <AuraTextarea
        className="md:col-span-2"
        label="Logros"
        rows={3}
        hint="Un logro por linea. Describe lo que realmente hiciste; AURA no inventara informacion."
        {...register('achievements')}
      />
      <div className="md:col-span-2">
        <FormActions onCancel={onDone} loading={saving} />
      </div>
    </form>
  )
}
