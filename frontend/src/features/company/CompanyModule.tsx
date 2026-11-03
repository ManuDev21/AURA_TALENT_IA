import { useQuery } from '@tanstack/react-query'
import { Save, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { companyApi, queryKeys } from '@/api/talent'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraConfirmButton } from '@/components/aura/AuraConfirmButton'
import { AuraSelect, AuraTextarea } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraTagInput } from '@/components/aura/AuraTagInput'
import { FormAlert } from '@/features/auth/FormAlert'
import { applyServerErrors } from '@/features/auth/serverErrors'
import { FormActions } from '@/features/talent/CrudSection'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { useSessionStore } from '@/store/sessionStore'
import type { Company, MemberInvite } from '@/types/talent'
import type { RoleCode } from '@/types/auth'
import { COMPANY_SIZE, options } from '@/utils/labels'
import { ROLE_LABELS } from '@/utils/roles'

export function CompanyModule() {
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.company, queryFn: companyApi.current })
  if (isPending) {
    return (
      <AuraPanel eyebrow="Empresa" title="Empresa">
        <div className="flex justify-center py-12">
          <AuraLoader label="Cargando empresa" />
        </div>
      </AuraPanel>
    )
  }
  if (error || !data) return <AuraPanel title="Empresa"><FormAlert message={error?.message ?? 'Error'} /></AuraPanel>

  return (
    <div className="flex flex-col gap-4">
      <AuraPanel eyebrow="Perfil de empresa" title={data.company.name}>
        {data.can_edit ? <CompanyForm key={data.company.id} company={data.company} /> : <CompanyReadOnly company={data.company} />}
      </AuraPanel>
      <MembersPanel canManage={data.can_manage_members} />
    </div>
  )
}

interface Values {
  name: string
  description: string
  sector: string
  location: string
  website: string
  size_range: string
  culture: string
  benefits: string[]
  contact_email: string
}

const FIELDS = ['name', 'description', 'sector', 'location', 'website', 'size_range', 'culture', 'benefits', 'contact_email'] as const

function CompanyForm({ company }: { company: Company }) {
  const [formError, setFormError] = useState('')
  const update = useAuraMutation({
    mutationFn: companyApi.update,
    invalidate: [queryKeys.company],
    success: 'Perfil de empresa actualizado.',
    silentError: true,
  })
  const { register, control, handleSubmit, setError, reset, formState: { errors, isDirty } } = useForm<Values>({
    defaultValues: {
      name: company.name,
      description: company.description ?? '',
      sector: company.sector ?? '',
      location: company.location ?? '',
      website: company.website ?? '',
      size_range: company.size_range ?? '',
      culture: company.culture ?? '',
      benefits: company.benefits,
      contact_email: company.contact_email ?? '',
    },
  })

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      await update.mutateAsync({
        name: v.name,
        description: v.description || null,
        sector: v.sector || null,
        location: v.location || null,
        website: v.website || null,
        size_range: v.size_range || null,
        culture: v.culture || null,
        benefits: v.benefits,
        contact_email: v.contact_email || null,
      })
      reset(v)
    } catch (err) {
      setFormError(applyServerErrors(err, setError, FIELDS))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <FormAlert message={formError} />
      </div>
      <AuraInput label="Nombre" error={errors.name?.message} {...register('name', { required: 'Obligatorio' })} />
      <AuraInput label="Sector" {...register('sector')} />
      <AuraInput label="Ubicacion" {...register('location')} />
      <AuraSelect label="Tamano" options={options.companySize} {...register('size_range')} />
      <AuraInput label="Sitio web" type="url" error={errors.website?.message} {...register('website')} />
      <AuraInput label="Correo de contacto" type="email" error={errors.contact_email?.message} {...register('contact_email')} />
      <AuraTextarea className="md:col-span-2" label="Descripcion" rows={3} {...register('description')} />
      <AuraTextarea className="md:col-span-2" label="Cultura" rows={3} {...register('culture')} />
      <div className="md:col-span-2">
        <Controller
          control={control}
          name="benefits"
          render={({ field }) => <AuraTagInput label="Beneficios" placeholder="Trabajo remoto, seguro medico..." value={field.value} onChange={field.onChange} />}
        />
      </div>
      <div className="flex justify-end md:col-span-2">
        <AuraButton type="submit" icon={Save} loading={update.isPending} disabled={!isDirty}>
          Guardar
        </AuraButton>
      </div>
    </form>
  )
}

function CompanyReadOnly({ company }: { company: Company }) {
  const rows: [string, string | null][] = [
    ['Sector', company.sector],
    ['Ubicacion', company.location],
    ['Tamano', company.size_range ? (COMPANY_SIZE[company.size_range] ?? company.size_range) : null],
    ['Sitio web', company.website],
  ]
  return (
    <div className="flex flex-col gap-4 text-sm">
      <dl className="grid grid-cols-2 gap-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="hud-label text-graphite-400">{label}</dt>
            <dd className="text-bone">{value ?? '-'}</dd>
          </div>
        ))}
      </dl>
      {company.description && <p className="text-graphite-300">{company.description}</p>}
      <p className="text-xs text-graphite-400">Solo los administradores de la empresa pueden editar este perfil.</p>
    </div>
  )
}

function MembersPanel({ canManage }: { canManage: boolean }) {
  const me = useSessionStore((s) => s.user)
  const [inviting, setInviting] = useState(false)
  const { data = [] } = useQuery({ queryKey: queryKeys.members, queryFn: companyApi.members })
  const remove = useAuraMutation({
    mutationFn: companyApi.removeMember,
    invalidate: [queryKeys.members],
    success: 'Miembro retirado de la empresa.',
  })

  return (
    <AuraPanel
      eyebrow="Equipo"
      title="Miembros"
      actions={
        canManage && !inviting ? (
          <AuraButton variant="neo" size="sm" icon={UserPlus} onClick={() => setInviting(true)} className="mr-10">
            Invitar
          </AuraButton>
        ) : undefined
      }
    >
      {inviting && <InviteForm onDone={() => setInviting(false)} />}
      <ul className="mt-2 flex flex-col gap-2">
        {data.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <span className="neo flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-aura-400">
              <Users className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-bone">
                {m.full_name}
                {m.user_id === me?.id && <span className="text-graphite-400"> (tu)</span>}
              </p>
              <p className="truncate text-xs text-graphite-400">
                {m.email}
                {m.position && ` / ${m.position}`}
              </p>
            </div>
            <div className="hidden gap-1 sm:flex">
              {m.roles.map((r) => (
                <AuraBadge key={r} tone="neutral">
                  {ROLE_LABELS[r as RoleCode] ?? r}
                </AuraBadge>
              ))}
            </div>
            {canManage && m.user_id !== me?.id && (
              <AuraConfirmButton label={`Retirar a ${m.full_name}`} loading={remove.isPending} onConfirm={() => remove.mutate(m.user_id)} />
            )}
          </li>
        ))}
      </ul>
    </AuraPanel>
  )
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [formError, setFormError] = useState('')
  const invite = useAuraMutation({
    mutationFn: companyApi.invite,
    invalidate: [queryKeys.members],
    success: (m) => `Invitacion enviada a ${m.email}.`,
    silentError: true,
  })
  const { register, handleSubmit, setError, formState: { errors } } = useForm<MemberInvite>({
    defaultValues: { email: '', full_name: '', role: 'ROLE_RECRUITER', position: '' },
  })

  const onSubmit = handleSubmit(async (v) => {
    setFormError('')
    try {
      await invite.mutateAsync({ ...v, position: v.position || null })
      onDone()
    } catch (err) {
      setFormError(applyServerErrors(err, setError, ['email', 'full_name', 'role', 'position']))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="neo-inset mb-3 grid gap-3 rounded-xl p-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <FormAlert message={formError} />
      </div>
      <AuraInput label="Nombre" error={errors.full_name?.message} {...register('full_name', { required: 'Obligatorio' })} />
      <AuraInput label="Correo" type="email" error={errors.email?.message} {...register('email', { required: 'Obligatorio' })} />
      <AuraSelect
        label="Rol"
        placeholder="Seleccionar rol"
        options={[
          { value: 'ROLE_RECRUITER', label: 'Reclutador' },
          { value: 'ROLE_COMPANY_ADMIN', label: 'Administrador de empresa' },
        ]}
        {...register('role', { required: true })}
      />
      <AuraInput label="Puesto (opcional)" {...register('position')} />
      <p className="text-xs text-graphite-400 md:col-span-2">
        La persona recibira un enlace para definir su contrasena. Si ya tiene cuenta, solo se le dara acceso a la empresa.
      </p>
      <div className="md:col-span-2">
        <FormActions onCancel={onDone} loading={invite.isPending} />
      </div>
    </form>
  )
}
