import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Cpu, GitCompareArrows, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { jobKeys, jobsApi } from '@/api/jobs'
import { matchApi, matchKeys } from '@/api/match'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { ApplicationPanel } from '@/features/jobs/ApplicationPanel'
import { STAGE_LABELS } from '@/features/jobs/labels'
import { MatchRange } from '@/features/match/MatchDetail'

export function CompanyMatchModule() {
  const { data: jobs = [] } = useQuery({ queryKey: jobKeys.company, queryFn: jobsApi.companyJobs })
  const [jobId, setJobId] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const current = jobId || jobs.find((j) => j.applications_count > 0)?.id || ''
  const { data: applicants = [] } = useQuery({ queryKey: jobKeys.applicants(current), queryFn: () => jobsApi.applicants(current), enabled: !!current })
  const { data: matches = [] } = useQuery({ queryKey: matchKeys.applicants(current), queryFn: () => matchApi.applicants(current), enabled: !!current })
  const byId = new Map(applicants.map((a) => [a.application_id, a]))
  const rows = [...matches].sort((a, b) => b.score - a.score)

  return (
    <AuraPanel eyebrow="AURA Match" title="Compatibilidad por vacante" className="flex flex-col gap-4">
      {openId ? (
        <>
          <AuraButton variant="ghost" size="sm" icon={ArrowLeft} className="self-start" onClick={() => setOpenId(null)}>
            Volver
          </AuraButton>
          <ApplicationPanel applicationId={openId} />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            <span className="flex flex-1 items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                La compatibilidad es una estimacion sobre datos registrados. Sirve para revisar con criterio, no para descartar: ningun candidato se mueve ni se rechaza por este valor.
              </span>
            </span>
            <Link
              to="/company/m/algorithms"
              className="btn-jelly inline-flex items-center gap-1.5 rounded-xl border border-aura-500/45 bg-aura-500/15 px-3 py-1.5 font-semibold text-aura-400 hover:bg-aura-500/25 hover:text-bone"
            >
              <Cpu className="h-3.5 w-3.5" />
              Abrir Laboratorio de Algoritmos IA
            </Link>
          </div>
          <AuraSelect
            label="Vacante"
            placeholder="Selecciona una vacante"
            options={jobs.map((j) => ({ value: j.id, label: `${j.title} (${j.applications_count})` }))}
            value={current}
            onChange={(e) => setJobId(e.target.value)}
          />
          {!rows.length ? (
            <AuraEmptyState icon={GitCompareArrows} title="Sin postulaciones para comparar" />
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((m) => {
                const a = byId.get(m.application_id)
                return (
                  <li key={m.application_id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(m.application_id)}
                      className="flex w-full flex-wrap items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition hover:border-aura-500/40"
                    >
                      <span className="w-12 text-center font-display text-xl text-aura-400">{Math.round(m.score)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-bone">{a?.full_name ?? 'Candidato'}</p>
                        <p className="text-xs text-graphite-400">
                          {m.required_met}/{m.required_total} requisitos obligatorios / rango {Math.round(m.score_low)}-{Math.round(m.score_high)}
                        </p>
                      </div>
                      <MatchRange score={m.score} low={m.score_low} high={m.score_high} compact />
                      {a && <AuraBadge tone="neutral">{STAGE_LABELS[a.current_stage]}</AuraBadge>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </AuraPanel>
  )
}
