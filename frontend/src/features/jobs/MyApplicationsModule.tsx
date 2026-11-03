import { useQuery } from '@tanstack/react-query'
import { Building, ClipboardCheck, MessageSquare } from 'lucide-react'
import { Link } from 'react-router'
import { applicationsApi, jobKeys } from '@/api/jobs'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraConfirmButton } from '@/components/aura/AuraConfirmButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { CANDIDATE_STAGE_LABELS } from '@/features/jobs/labels'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import type { MyApplication, Stage } from '@/types/jobs'
import { cn } from '@/utils/cn'

const FLOW: Stage[] = ['APPLIED', 'SCREENING', 'ASSESSMENT', 'INTERVIEW', 'FINAL_REVIEW']
const STATUS: Record<MyApplication['status'], { label: string; tone: 'aura' | 'neutral' | 'success' }> = {
  active: { label: 'En proceso', tone: 'aura' },
  withdrawn: { label: 'Retirada', tone: 'neutral' },
  hired: { label: 'Seleccionado', tone: 'success' },
  closed: { label: 'Concluida', tone: 'neutral' },
}

export function MyApplicationsModule() {
  const { data, isPending } = useQuery({ queryKey: jobKeys.mine, queryFn: applicationsApi.mine })
  const withdraw = useAuraMutation({
    mutationFn: applicationsApi.withdraw,
    invalidate: [jobKeys.mine, ['jobs', 'search']],
    success: 'Postulacion retirada.',
  })

  return (
    <AuraPanel eyebrow="Seguimiento" title="Mis postulaciones" className="flex flex-col gap-4">
      {isPending ? (
        <div className="flex justify-center py-12">
          <AuraLoader label="Cargando postulaciones" />
        </div>
      ) : !data?.length ? (
        <AuraEmptyState icon={ClipboardCheck} title="Aun no te postulas a ninguna vacante">
          <Link to="/candidate/jobs" className="text-aura-400 hover:underline">
            Explorar vacantes
          </Link>
        </AuraEmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((app) => (
            <li key={app.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-bone">{app.job.title}</p>
                  <p className="flex items-center gap-1 text-xs text-graphite-400">
                    <Building className="h-3 w-3" aria-hidden="true" /> {app.job.company.name} / postulada el{' '}
                    {new Date(app.applied_at).toLocaleDateString('es')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AuraBadge tone={STATUS[app.status].tone}>{STATUS[app.status].label}</AuraBadge>
                  {app.status === 'active' && (
                    <AuraConfirmButton
                      label={`Retirar postulacion a ${app.job.title}`}
                      loading={withdraw.isPending && withdraw.variables === app.id}
                      onConfirm={() => withdraw.mutate(app.id)}
                    />
                  )}
                </div>
              </div>
              <StageTrack app={app} />
              {app.last_update_at && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs text-graphite-400">
                  <span>
                    Última actualización humana: {new Date(app.last_update_at).toLocaleDateString('es')}
                    {app.job.response_sla_days && ` · Plazo orientativo de respuesta: ${app.job.response_sla_days} días`}
                  </span>
                  {app.estimated_next_update_at && (
                    <span className={new Date(app.estimated_next_update_at) < new Date() ? 'text-amber-300' : 'text-graphite-300'}>
                      {new Date(app.estimated_next_update_at) < new Date() ? 'La fecha orientativa ya pasó; no implica un cambio automático' : 'Siguiente actualización estimada: '}
                      {new Date(app.estimated_next_update_at).toLocaleDateString('es')}
                    </span>
                  )}
                </div>
              )}
              {app.status === 'active' && (
                <Link
                  to={`/candidate/interview-prep?application=${app.id}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-aura-400 hover:underline"
                >
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Practicar entrevista en privado
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-graphite-400">
        Las decisiones de cada proceso las toma el equipo de la empresa. AURA no descarta ni selecciona candidatos
        automaticamente.
      </p>
    </AuraPanel>
  )
}

function StageTrack({ app }: { app: MyApplication }) {
  const reached = new Set(app.timeline.map((t) => t.to_stage))
  const finished = app.status === 'hired' || app.status === 'closed'
  const final: Stage | null = app.status === 'hired' ? 'HIRED' : app.status === 'closed' ? 'CLOSED' : null
  const steps = final ? [...FLOW.filter((s) => reached.has(s)), final] : FLOW

  return (
    <ol className="mt-4 flex items-center gap-1 overflow-x-auto" aria-label="Etapas del proceso">
      {steps.map((stage, i) => {
        const done = reached.has(stage)
        const current = stage === app.current_stage
        return (
          <li key={stage} className="flex min-w-24 flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span className={cn('h-px flex-1', i === 0 ? 'bg-transparent' : done ? 'bg-aura-500/60' : 'bg-white/10')} />
              <span
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'h-3 w-3 shrink-0 rounded-full border',
                  current && !finished && 'border-aura-400 bg-aura-500 shadow-[0_0_12px_rgb(255_122_26/0.9)]',
                  current && app.status === 'hired' && 'border-success bg-success',
                  current && app.status === 'closed' && 'border-graphite-300 bg-graphite-400',
                  !current && done && 'border-aura-500/60 bg-aura-500/40',
                  !done && 'border-white/20 bg-transparent',
                )}
              />
              <span className={cn('h-px flex-1', i === steps.length - 1 ? 'bg-transparent' : 'bg-white/10')} />
            </div>
            <span className={cn('text-center text-[0.65rem]', current ? 'text-bone' : 'text-graphite-400')}>
              {CANDIDATE_STAGE_LABELS[stage]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
