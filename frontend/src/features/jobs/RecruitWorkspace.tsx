import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Users } from 'lucide-react'
import { type DragEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { jobKeys, jobsApi } from '@/api/jobs'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { matchApi, matchKeys } from '@/api/match'
import { ApplicationPanel } from '@/features/jobs/ApplicationPanel'
import { MatchRange } from '@/features/match/MatchDetail'
import { JOB_STATUS, PIPELINE, STAGE_LABELS, STAGE_TRANSITIONS } from '@/features/jobs/labels'
import { TransitionDialog } from '@/features/jobs/TransitionDialog'
import { useReducedMotion } from '@/hooks/useMediaQuery'
import { useAuraStore } from '@/store/auraStore'
import { useSessionStore } from '@/store/sessionStore'
import { toast } from '@/store/toastStore'
import type { Applicant, Stage } from '@/types/jobs'
import { cn } from '@/utils/cn'

export function RecruitWorkspace({ mode }: { mode: 'list' | 'board' }) {
  const [params, setParams] = useSearchParams()
  const { data: jobs, isPending } = useQuery({ queryKey: jobKeys.company, queryFn: jobsApi.companyJobs })
  const jobId = params.get('job') ?? ''
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId && jobs?.length) {
      const first = jobs.find((j) => j.applications_count > 0) ?? jobs[0]
      if (first) setParams({ job: first.id }, { replace: true })
    }
  }, [jobId, jobs, setParams])

  const { data: applicants = [], isFetching } = useQuery({
    queryKey: jobKeys.applicants(jobId),
    queryFn: () => jobsApi.applicants(jobId),
    enabled: !!jobId,
  })

  const title = mode === 'board' ? 'Pipeline de seleccion' : 'Candidatos'
  if (isPending) {
    return (
      <AuraPanel eyebrow="Recruit" title={title}>
        <div className="flex justify-center py-12">
          <AuraLoader label="Cargando vacantes" />
        </div>
      </AuraPanel>
    )
  }

  return (
    <AuraPanel eyebrow="Recruit" title={title} className="flex flex-col gap-4">
      {!jobs?.length ? (
        <AuraEmptyState icon={Users} title="Aun no hay vacantes">
          Crea y publica una vacante para recibir postulaciones.
        </AuraEmptyState>
      ) : openId ? (
        <>
          <AuraButton variant="ghost" size="sm" icon={ArrowLeft} className="self-start" onClick={() => setOpenId(null)}>
            Volver
          </AuraButton>
          <ApplicationPanel applicationId={openId} />
        </>
      ) : (
        <>
          <AuraSelect
            label="Vacante"
            placeholder="Selecciona una vacante"
            options={jobs.map((j) => ({ value: j.id, label: `${j.title} (${JOB_STATUS[j.status].label}, ${j.applications_count})` }))}
            value={jobId}
            onChange={(e) => setParams({ job: e.target.value })}
          />
          {isFetching && !applicants.length ? (
            <div className="flex justify-center py-8">
              <AuraLoader label="Cargando postulaciones" />
            </div>
          ) : !applicants.length ? (
            <AuraEmptyState icon={Users} title="Esta vacante aun no tiene postulaciones" />
          ) : mode === 'board' ? (
            <PipelineBoard jobId={jobId} applicants={applicants} onOpen={setOpenId} />
          ) : (
            <ApplicantList jobId={jobId} applicants={applicants} onOpen={setOpenId} />
          )}
          <p className="text-xs text-graphite-400">
            AURA organiza la informacion; cada cambio de etapa lo decide y confirma una persona del equipo y queda registrado.
          </p>
        </>
      )}
    </AuraPanel>
  )
}

function ApplicantList({ jobId, applicants, onOpen }: { jobId: string; applicants: Applicant[]; onOpen: (id: string) => void }) {
  const canMatch = useSessionStore((s) => s.user?.permissions.includes('match:read_company') ?? false)
  const { data: matches = [] } = useQuery({
    queryKey: matchKeys.applicants(jobId),
    queryFn: () => matchApi.applicants(jobId),
    enabled: canMatch && !!jobId,
  })
  const byApp = new Map(matches.map((m) => [m.application_id, m]))
  return (
    <ul className="flex flex-col gap-2" aria-label="Postulaciones (orden de llegada)">
      {applicants.map((a) => (
        <li key={a.application_id}>
          <button
            type="button"
            onClick={() => onOpen(a.application_id)}
            className="flex w-full items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition hover:border-aura-500/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-bone">{a.full_name}</p>
              <p className="truncate text-xs text-graphite-400">{[a.headline, a.location].filter(Boolean).join(' / ')}</p>
              <p className="mt-1 flex flex-wrap gap-1">
                {a.top_skills.map((s) => (
                  <span key={s} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.6rem] text-graphite-300">
                    {s}
                  </span>
                ))}
              </p>
            </div>
            {byApp.has(a.application_id) && (
              <span className="hidden flex-col items-end gap-1 sm:flex" title="Compatibilidad estimada (rango). Apoyo, no decision.">
                <span className="font-mono text-xs text-aura-400">
                  {Math.round(byApp.get(a.application_id)!.score)}% match
                </span>
                <MatchRange score={byApp.get(a.application_id)!.score} low={byApp.get(a.application_id)!.score_low} high={byApp.get(a.application_id)!.score_high} compact />
              </span>
            )}
            <span className="hidden text-xs text-graphite-400 sm:block">Perfil {a.completeness}%</span>
            <AuraBadge tone={a.status === 'active' ? 'aura' : 'neutral'}>
              {a.status === 'withdrawn' ? 'Retirada' : STAGE_LABELS[a.current_stage]}
            </AuraBadge>
          </button>
        </li>
      ))}
    </ul>
  )
}

interface PendingMove {
  applicant: Applicant
  to: Stage
}

/** Tablero espacial: las etapas forman un arco alrededor del nucleo. Arrastrar abre una confirmacion humana. */
function PipelineBoard({ jobId, applicants, onOpen }: { jobId: string; applicants: Applicant[]; onOpen: (id: string) => void }) {
  const reduced = useReducedMotion()
  const canAdvance = useSessionStore((s) => s.user?.permissions.includes('applications:advance') ?? false)
  const [dragging, setDragging] = useState<Applicant | null>(null)
  const [pending, setPending] = useState<PendingMove | null>(null)
  const active = applicants.filter((a) => a.status !== 'withdrawn')
  const allowed = dragging ? STAGE_TRANSITIONS[dragging.current_stage] : []
  const mid = (PIPELINE.length - 1) / 2

  const drop = (event: DragEvent, stage: Stage) => {
    event.preventDefault()
    const applicant = dragging
    setDragging(null)
    if (!applicant || applicant.current_stage === stage) return
    if (!STAGE_TRANSITIONS[applicant.current_stage].includes(stage)) {
      useAuraStore.getState().pulse('WARNING')
      toast.info(`No se puede pasar de ${STAGE_LABELS[applicant.current_stage]} a ${STAGE_LABELS[stage]}.`)
      return
    }
    setPending({ applicant, to: stage })
  }

  return (
    <>
      <div className="overflow-x-auto pb-2" style={{ perspective: reduced ? undefined : '1400px' }}>
        <ol className="flex min-w-max gap-3" aria-label="Etapas del pipeline">
          {PIPELINE.map((stage, i) => {
            const items = active.filter((a) => a.current_stage === stage)
            const isTarget = allowed.includes(stage)
            const offset = i - mid
            return (
              <li
                key={stage}
                onDragOver={(e) => isTarget && e.preventDefault()}
                onDrop={(e) => drop(e, stage)}
                aria-label={`${STAGE_LABELS[stage]}: ${items.length}`}
                className={cn(
                  'flex w-44 flex-col gap-2 rounded-2xl border p-2 transition-[border-color,box-shadow,background-color] duration-300',
                  isTarget ? 'border-aura-500/70 bg-aura-500/[0.08] shadow-[0_0_30px_-8px_rgb(255_122_26/0.8)]' : 'border-white/5 bg-white/[0.02]',
                  dragging && !isTarget && dragging.current_stage !== stage && 'opacity-40',
                )}
                style={reduced ? undefined : { transform: `rotateY(${offset * -5}deg) translateZ(${-Math.abs(offset) * 18}px)` }}
              >
                <p className="hud-label flex items-center justify-between px-1 pt-1 text-graphite-300">
                  {STAGE_LABELS[stage]}
                  <span className="font-mono text-aura-400">{items.length}</span>
                </p>
                <ul className="flex min-h-24 flex-col gap-2">
                  {items.map((a) => (
                    <li
                      key={a.application_id}
                      draggable={canAdvance && STAGE_TRANSITIONS[a.current_stage].length > 0}
                      onDragStart={() => setDragging(a)}
                      onDragEnd={() => setDragging(null)}
                      className="glass cursor-grab rounded-xl p-2.5 active:cursor-grabbing"
                    >
                      <button type="button" onClick={() => onOpen(a.application_id)} className="w-full text-left">
                        <span className="block truncate text-sm text-bone">{a.full_name}</span>
                        <span className="block truncate text-[0.65rem] text-graphite-400">{a.headline ?? 'Sin titular'}</span>
                      </button>
                      {canAdvance && STAGE_TRANSITIONS[a.current_stage].length > 0 && (
                        <select
                          aria-label={`Mover a ${a.full_name}`}
                          value=""
                          onChange={(e) => e.target.value && setPending({ applicant: a, to: e.target.value as Stage })}
                          className="mt-2 h-7 w-full rounded-lg bg-white/5 px-1 text-[0.65rem] text-graphite-300 [&>option]:bg-graphite-900"
                        >
                          <option value="">Mover a...</option>
                          {STAGE_TRANSITIONS[a.current_stage].map((s) => (
                            <option key={s} value={s}>
                              {STAGE_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ol>
      </div>
      {pending && (
        <TransitionDialog
          applicationId={pending.applicant.application_id}
          jobId={jobId}
          candidateName={pending.applicant.full_name}
          from={pending.applicant.current_stage}
          to={pending.to}
          onClose={() => setPending(null)}
        />
      )}
    </>
  )
}
