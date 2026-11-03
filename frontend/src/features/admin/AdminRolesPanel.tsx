import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { adminApi } from '@/api/auth'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { FormAlert } from '@/features/auth/FormAlert'
import { ROLE_LABELS } from '@/utils/roles'

export function AdminRolesPanel() {
  const { data, isPending, error } = useQuery({ queryKey: ['admin', 'roles'], queryFn: adminApi.roles })

  return (
    <AuraPanel eyebrow="RBAC" title="Roles y permisos">
      {isPending && (
        <div className="flex justify-center py-10">
          <AuraLoader label="Consultando roles" />
        </div>
      )}
      {error && <FormAlert message={error.message} />}
      <ul className="flex flex-col gap-4">
        {data?.map((role) => (
          <li key={role.code} className="neo-inset rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-aura-400" aria-hidden="true" />
                <h3 className="font-display font-semibold">{ROLE_LABELS[role.code] ?? role.name}</h3>
              </div>
              <AuraBadge tone="neutral">{role.permissions.length} permisos</AuraBadge>
            </div>
            {role.description && <p className="mt-2 text-sm text-graphite-400">{role.description}</p>}
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`Permisos de ${role.name}`}>
              {role.permissions.map((p) => (
                <li key={p.code} title={p.description ?? undefined} className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[0.68rem] text-graphite-300">
                  {p.code}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </AuraPanel>
  )
}
