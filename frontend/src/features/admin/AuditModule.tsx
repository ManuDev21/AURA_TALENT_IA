import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Bot, ChevronLeft, ChevronRight, Radar, Search, ServerCog, UserRound } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { adminApi } from '@/api/admin'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'

const RESULT_TONE = { success: 'success', denied: 'warning', error: 'danger' } as const
const RESULT_LABEL = { success: 'Exito', denied: 'Denegado', error: 'Error' } as const
const ACTOR_ICON = { human: UserRound, system: ServerCog, ai: Bot } as const

/** Registro de auditoria de solo lectura (quien hizo que, cuando y con que resultado). */
export function AuditModule() {
  const [module, setModule] = useState('')
  const [result, setResult] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const query = useDeferredValue(q.trim())
  const params = Object.fromEntries(
    Object.entries({ module, result, q: query, page: String(page) }).filter(([, v]) => v),
  ) as Record<string, string>
  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: () => adminApi.audit(params),
    placeholderData: keepPreviousData,
  })
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <AuraPanel eyebrow="Seguridad" title="Registro de auditoria" className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-[1fr_12rem_10rem]">
        <AuraInput label="Buscar" icon={Search} placeholder="Accion, correo o id de peticion" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        <AuraSelect
          label="Modulo"
          placeholder="Todos"
          options={[{ value: '', label: 'Todos' }, ...(data?.modules ?? []).map((m) => ({ value: m, label: m }))]}
          value={module}
          onChange={(e) => (setModule(e.target.value), setPage(1))}
        />
        <AuraSelect
          label="Resultado"
          placeholder="Todos"
          options={[{ value: '', label: 'Todos' }, { value: 'success', label: 'Exito' }, { value: 'denied', label: 'Denegado' }, { value: 'error', label: 'Error' }]}
          value={result}
          onChange={(e) => (setResult(e.target.value), setPage(1))}
        />
      </div>

      {!data ? (
        <div className="flex justify-center py-10">
          <AuraLoader label="Cargando registro" />
        </div>
      ) : !data.items.length ? (
        <AuraEmptyState icon={Radar} title="Sin eventos con esos filtros" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Eventos de auditoria</caption>
            <thead className="hud-label text-graphite-400">
              <tr>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Modulo</th>
                <th className="py-2 pr-3">Accion</th>
                <th className="py-2 pr-3">Resultado</th>
                <th className="py-2">IP</th>
              </tr>
            </thead>
            <tbody className={isFetching ? 'opacity-60' : undefined}>
              {data.items.map((i) => {
                const Icon = ACTOR_ICON[i.actor_type]
                return (
                  <tr key={i.id} className="border-t border-white/5 align-top text-graphite-300">
                    <td className="whitespace-nowrap py-2 pr-3 font-mono">{new Date(i.created_at).toLocaleString('es')}</td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-aura-400" aria-label={i.actor_type} />
                        {i.actor ?? 'sistema'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{i.module}</td>
                    <td className="py-2 pr-3 font-mono text-bone" title={i.request_id ?? undefined}>
                      {i.action}
                    </td>
                    <td className="py-2 pr-3">
                      <AuraBadge tone={RESULT_TONE[i.result]}>{RESULT_LABEL[i.result]}</AuraBadge>
                    </td>
                    <td className="py-2 font-mono text-graphite-400">{i.ip ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <div className="flex items-center justify-between text-xs text-graphite-400">
          <span>{data.total} evento(s)</span>
          <div className="flex items-center gap-2">
            <AuraButton variant="ghost" size="icon" aria-label="Pagina anterior" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </AuraButton>
            <span className="font-mono">
              {page}/{pages}
            </span>
            <AuraButton variant="ghost" size="icon" aria-label="Pagina siguiente" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </AuraButton>
          </div>
        </div>
      )}
      <p className="text-xs text-graphite-400">El registro es de solo lectura: nadie, ni siquiera un administrador, puede modificarlo o borrarlo desde la plataforma.</p>
    </AuraPanel>
  )
}
