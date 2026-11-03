import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { FormAlert } from '@/features/auth/FormAlert'
import { type FormRenderProps, FormActions } from '@/features/talent/CrudSection'
import { useItemForm } from '@/features/talent/useItemForm'
import type { Certification, Language, ProfileLink } from '@/types/talent'
import { fromMonthInput, toMonthInput } from '@/utils/dates'
import { options } from '@/utils/labels'

export function CertificationForm({ item, onDone }: FormRenderProps<Certification>) {
  const { form, onSubmit, formError, saving } = useItemForm({
    kind: 'certifications',
    itemId: item?.id,
    onDone,
    defaults: {
      name: item?.name ?? '',
      issuer: item?.issuer ?? '',
      issued_at: toMonthInput(item?.issued_at),
      expires_at: toMonthInput(item?.expires_at),
      credential_id: item?.credential_id ?? '',
      credential_url: item?.credential_url ?? '',
    },
    toPayload: (v) => ({
      name: v.name,
      issuer: v.issuer || null,
      issued_at: fromMonthInput(v.issued_at),
      expires_at: fromMonthInput(v.expires_at),
      credential_id: v.credential_id || null,
      credential_url: v.credential_url || null,
    }),
  })
  const { register, formState: { errors } } = form
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <FormAlert message={formError} />
      </div>
      <AuraInput label="Certificacion" error={errors.name?.message} {...register('name', { required: 'Obligatorio' })} />
      <AuraInput label="Emisor" {...register('issuer')} />
      <AuraInput label="Emitida" type="month" {...register('issued_at')} />
      <AuraInput label="Expira" type="month" error={errors.expires_at?.message} {...register('expires_at')} />
      <AuraInput label="ID de credencial" {...register('credential_id')} />
      <AuraInput label="URL de verificacion" type="url" error={errors.credential_url?.message} {...register('credential_url')} />
      <div className="md:col-span-2">
        <FormActions onCancel={onDone} loading={saving} />
      </div>
    </form>
  )
}

export function LanguageForm({ item, onDone }: FormRenderProps<Language>) {
  const { form, onSubmit, formError, saving } = useItemForm({
    kind: 'languages',
    itemId: item?.id,
    onDone,
    defaults: {
      language_code: item?.language_code ?? '',
      level: item?.level ?? '',
      is_certified: item?.is_certified ?? false,
      certificate_name: item?.certificate_name ?? '',
    },
    toPayload: (v) => ({
      language_code: v.language_code,
      level: v.level,
      is_certified: v.is_certified,
      certificate_name: v.is_certified ? v.certificate_name || null : null,
    }),
  })
  const { register, watch, formState: { errors } } = form
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <FormAlert message={formError} />
      </div>
      <AuraSelect
        label="Idioma"
        options={options.languages}
        error={errors.language_code?.message}
        {...register('language_code', { required: 'Obligatorio' })}
      />
      <AuraSelect
        label="Nivel (MCER)"
        options={options.languageLevel}
        error={errors.level?.message}
        {...register('level', { required: 'Obligatorio' })}
      />
      <AuraCheckbox label="Tengo una certificacion de este idioma" {...register('is_certified')} />
      {watch('is_certified') && <AuraInput label="Certificacion" placeholder="TOEFL, IELTS, DELF..." {...register('certificate_name')} />}
      <div className="md:col-span-2">
        <FormActions onCancel={onDone} loading={saving} />
      </div>
    </form>
  )
}

export function LinkForm({ item, onDone }: FormRenderProps<ProfileLink>) {
  const { form, onSubmit, formError, saving } = useItemForm({
    kind: 'links',
    itemId: item?.id,
    onDone,
    defaults: { link_type: item?.link_type ?? 'github', url: item?.url ?? '', label: item?.label ?? '' },
    toPayload: (v) => ({ link_type: v.link_type, url: v.url, label: v.label || null, display_order: item?.display_order ?? 0 }),
  })
  const { register, formState: { errors } } = form
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 md:grid-cols-3">
      <div className="md:col-span-3">
        <FormAlert message={formError} />
      </div>
      <AuraSelect label="Tipo" options={options.linkType} {...register('link_type', { required: true })} />
      <AuraInput
        className="md:col-span-2"
        label="URL"
        type="url"
        placeholder="https://"
        error={errors.url?.message}
        {...register('url', { required: 'Obligatorio' })}
      />
      <AuraInput className="md:col-span-3" label="Etiqueta (opcional)" {...register('label')} />
      <div className="md:col-span-3">
        <FormActions onCancel={onDone} loading={saving} />
      </div>
    </form>
  )
}
