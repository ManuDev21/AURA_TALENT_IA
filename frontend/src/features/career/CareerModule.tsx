import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, Map as MapIcon, Plus, Route, Trash2, Waypoints } from 'lucide-react'
import { lazy, Suspense, useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import { careerApi, careerKeys } from '@/api/career'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraExplain } from '@/components/aura/AuraExplain'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { STATUS_COLOR, STATUS_LABEL } from '@/features/career/careerStatus'
import { CareerSearchPanel } from '@/features/career/CareerSearchPanel'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { useSessionStore } from '@/store/sessionStore'
import type { CareerNode, CareerPath, NodeStatus } from '@/types/career'
import { cn } from '@/utils/cn'

const CareerMap3D = lazy(() => import('@/features/career/CareerMap3D').then((m) => ({ default: m.CareerMap3D })))

const TYPE_LABEL: Record<CareerNode['node_type'], string> = {
  profile: 'Punto de partida',
  skill: 'Habilidad',
  course: 'Recurso de aprendizaje',
  project: 'Proyecto',
  role: 'Rol objetivo',
  milestone: 'Siguiente paso posible',
}

export function CareerModule() {
  const [params, setParams] = useSearchParams()
  const pathId = params.get('path')
  return (
    <AuraPanel eyebrow="Career Map" title="Mapa profesional" className="flex flex-col gap-4">
      {pathId ? (
        <>
          <AuraButton variant="ghost" size="sm" icon={ArrowLeft} className="self-start" onClick={() => setParams({})}>
            Mis rutas
          </AuraButton>
          <PathView pathId={pathId} onDeleted={() => setParams({})} />
        </>
      ) : (
        <Home onOpen={(id) => setParams({ path: id })} />
      )}
    </AuraPanel>
  )
}

function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: roles } = useQuery({ queryKey: careerKeys.roles, queryFn: careerApi.roles })
  const { data: paths = [] } = useQuery({ queryKey: careerKeys.paths, queryFn: careerApi.paths })
  const create = useAuraMutation({
    mutationFn: (code: string) => careerApi.createPath(code),
    invalidate: [careerKeys.paths],
    success: 'Ruta generada. Puedes marcar tus avances en cada paso.',
    onSuccess: (p) => onOpen(p.id),
  })

  return (
    <div className="flex flex-col gap-5">
      {paths.length > 0 && (
        <section aria-label="Mis rutas" className="flex flex-col gap-2">
          <h3 className="hud-label text-aura-400">Mis rutas</h3>
          {paths.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpen(p.id)}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left transition hover:border-aura-500/40"
            >
              <Route className="h-4 w-4 text-aura-400" aria-hidden="true" />
              <span className="flex-1 text-sm text-bone">{p.title}</span>
              <span className="neo-inset h-1.5 w-24 overflow-hidden rounded-full">
                <span className="block h-full rounded-full bg-aura-500" style={{ width: `${p.progress}%` }} />
              </span>
              <span className="w-10 text-right font-mono text-xs text-graphite-400">{Math.round(p.progress)}%</span>
            </button>
          ))}
        </section>
      )}

      <section aria-label="Roles" className="flex flex-col gap-2">
        <h3 className="hud-label text-aura-400">Roles posibles segun tu perfil</h3>
        {!roles ? (
          <div className="flex justify-center py-8">
            <AuraLoader label="Comparando tu perfil con los roles" />
          </div>
        ) : (
          <>
            <ul className="grid gap-2 md:grid-cols-2">
              {roles.roles.map((r) => (
                <li key={r.code} className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-bone">{r.title}</span>
                    <span className="font-mono text-sm text-aura-400">{Math.round(r.coverage)}%</span>
                  </div>
                  <div className="neo-inset h-1.5 overflow-hidden rounded-full" role="meter" aria-label={`Cobertura ${r.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.coverage)}>
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-glow to-aura-600" style={{ width: `${r.coverage}%` }} />
                  </div>
                  <p className="text-xs text-graphite-400">{r.description}</p>
                  {r.missing.length > 0 && <p className="text-[0.7rem] text-graphite-400">Te falta: {r.missing.slice(0, 4).join(', ')}</p>}
                  <AuraButton size="sm" variant="neo" icon={Plus} className="self-end" loading={create.isPending && create.variables === r.code} onClick={() => create.mutate(r.code)}>
                    Generar ruta
                  </AuraButton>
                </li>
              ))}
            </ul>
            <p className="text-xs text-graphite-400">{roles.note}</p>
          </>
        )}
      </section>
    </div>
  )
}

function PathView({ pathId, onDeleted }: { pathId: string; onDeleted: () => void }) {
  const user = useSessionStore((s) => s.user)
  const isCompanyOrAdmin =
    user?.roles.some((r) => r.code === 'ROLE_RECRUITER' || r.code === 'ROLE_COMPANY_ADMIN' || r.code === 'ROLE_SYSTEM_ADMIN') ??
    false
  const { data: path } = useQuery({ queryKey: careerKeys.path(pathId), queryFn: () => careerApi.path(pathId) })
  const [selected, setSelected] = useState<string | null>(null)
  const [searchTrace, setSearchTrace] = useState<{
    path: string[]
    active: string | null
    visited: string[]
  }>({ path: [], active: null, visited: [] })
  const updateTrace = useCallback((ids: string[], active: string | null, visited: string[]) => {
    setSearchTrace({ path: ids, active, visited })
  }, [])
  const remove = useAuraMutation({
    mutationFn: () => careerApi.deletePath(pathId),
    invalidate: [careerKeys.paths],
    success: 'Ruta archivada.',
    onSuccess: onDeleted,
  })
  if (!path) {
    return (
      <div className="flex justify-center py-10">
        <AuraLoader label="Cargando mapa" />
      </div>
    )
  }
  const node = path.nodes.find((n) => n.id === selected) ?? null
  const steps = path.nodes.filter((n) => ['skill', 'course', 'project'].includes(n.node_type)).sort((a, b) => a.position[0] - b.position[0])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
        <Waypoints className="h-5 w-5 text-aura-400" aria-hidden="true" />
        <h3 className="flex-1 font-display text-lg">{path.title}</h3>
        <span className="font-mono text-sm text-aura-400">{Math.round(path.progress)}% completado</span>
        <AuraButton variant="ghost" size="sm" icon={Trash2} loading={remove.isPending} onClick={() => remove.mutate()}>
          Archivar
        </AuraButton>
      </header>
      {isCompanyOrAdmin && (
        <CareerSearchPanel
          path={path}
          onTrace={updateTrace}
          selectedNodeId={selected}
          onSelectNode={setSelected}
        />
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <Suspense
          fallback={
            <div className="flex h-[28rem] items-center justify-center">
              <AuraLoader label="Construyendo mapa 3D" />
            </div>
          }
        >
          <CareerMap3D
            path={path}
            selectedId={selected}
            onSelect={setSelected}
            searchPath={searchTrace.path}
            visitedOrder={searchTrace.visited}
            activeSearchNode={searchTrace.active}
          />
        </Suspense>
        <NodeInspector path={path} node={node} />
      </div>

      <section aria-label="Pasos de la ruta" className="flex flex-col gap-1.5">
        <h4 className="hud-label flex items-center gap-1.5 text-aura-400">
          <MapIcon className="h-3.5 w-3.5" aria-hidden="true" /> Pasos (vista de lista)
        </h4>
        <ol className="flex flex-col gap-1.5">
          {steps.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setSelected(n.id)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition', n.id === selected ? 'bg-aura-500/10 text-bone' : 'text-graphite-300 hover:bg-white/5')}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[n.status] }} aria-hidden="true" />
                <span className="flex-1 truncate">{n.label}</span>
                <span className="text-[0.65rem] text-graphite-400">
                  {TYPE_LABEL[n.node_type]} / {STATUS_LABEL[n.status]}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      <AuraExplain method={path.explanation.method} dataUsed={path.explanation.data_used} limitations={path.explanation.limitations} />
    </div>
  )
}

function NodeInspector({ path, node }: { path: CareerPath; node: CareerNode | null }) {
  const update = useAuraMutation({
    mutationFn: (status: NodeStatus) => careerApi.setNode(path.id, node!.id, status),
    invalidate: [careerKeys.path(path.id), careerKeys.paths],
  })
  if (!node) {
    return (
      <aside className="neo-inset flex flex-col justify-center rounded-2xl p-4 text-sm text-graphite-400">
        Selecciona un nodo del mapa o un paso de la lista para ver el detalle y registrar tu avance.
      </aside>
    )
  }
  const editable = ['skill', 'course', 'project'].includes(node.node_type)
  return (
    <aside className="neo-inset flex flex-col gap-3 rounded-2xl p-4" aria-live="polite">
      <p className="hud-label text-graphite-400">{TYPE_LABEL[node.node_type]}</p>
      <p className="font-medium text-bone">{node.label}</p>
      <AuraBadge tone={node.status === 'acquired' ? 'success' : node.status === 'gap' ? 'warning' : 'neutral'}>{STATUS_LABEL[node.status]}</AuraBadge>
      {node.node_type === 'skill' && (
        <p className="text-xs text-graphite-300">
          Nivel actual {node.meta.current_level ?? 0} de {node.meta.required_level} recomendado{node.meta.core ? ' (nucleo del rol)' : ' (complementaria)'}.
        </p>
      )}
      {node.meta.url && (
        <a href={node.meta.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-aura-400 hover:underline">
          Abrir recurso <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
      {node.meta.hours && <p className="text-xs text-graphite-400">Duracion aproximada: {node.meta.hours} h</p>}
      {node.meta.hint && <p className="text-xs text-graphite-300">{node.meta.hint}</p>}
      {editable && (
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[0.7rem] text-graphite-400">Registrar avance</span>
          {(['in_progress', 'acquired', 'gap'] as NodeStatus[]).map((s) => (
            <AuraButton key={s} size="sm" variant={node.status === s ? 'primary' : 'ghost'} disabled={update.isPending} onClick={() => update.mutate(s)}>
              {STATUS_LABEL[s]}
            </AuraButton>
          ))}
        </div>
      )}
    </aside>
  )
}
