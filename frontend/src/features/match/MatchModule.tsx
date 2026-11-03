import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Building, GitCompareArrows, Target, TrendingUp } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { matchApi, matchKeys } from '@/api/match'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraTabs } from '@/components/aura/AuraTabs'
import { MODALITY } from '@/features/jobs/labels'
import { MatchLoader, MatchRange } from '@/features/match/MatchDetail'

export function MatchModule() {
  const [params, setParams] = useSearchParams()
  const jobId = params.get('job')
  const tab = params.get('tab') === 'gaps' ? 'gaps' : 'top'

  return (
    <AuraPanel eyebrow="AURA Match" title="Compatibilidad" className="flex flex-col gap-4">
      {jobId ? (
        <>
          <AuraButton variant="ghost" size="sm" icon={ArrowLeft} className="self-start" onClick={() => setParams({})}>
            Volver
          </AuraButton>
          <MatchLoader queryKey={matchKeys.job(jobId)} queryFn={() => matchApi.forJob(jobId)} perspective="candidate" />
        </>
      ) : (
        <>
          <AuraTabs
            label="Match"
            active={tab}
            onChange={(t) => setParams(t === 'gaps' ? { tab: 'gaps' } : {})}
            tabs={[
              { id: 'top', label: 'Vacantes compatibles', icon: Target },
              { id: 'gaps', label: 'Mis brechas', icon: TrendingUp },
            ]}
          />
          {tab === 'top' ? <TopMatches onOpen={(id) => setParams({ job: id })} /> : <Gaps />}
        </>
      )}
    </AuraPanel>
  )
}

function TopMatches({ onOpen }: { onOpen: (id: string) => void }) {
  const { data } = useQuery({ queryKey: matchKeys.top, queryFn: () => matchApi.top(12) })
  if (!data) {
    return (
      <div className="flex justify-center py-10">
        <AuraLoader label="Comparando tu perfil con las vacantes" />
      </div>
    )
  }
  if (!data.length) return <AuraEmptyState icon={GitCompareArrows} title="No hay vacantes publicadas para comparar" />
  return (
    <>
      <ul className="flex flex-col gap-2">
        {data.map((m) => (
          <li key={m.job_id}>
            <button
              type="button"
              onClick={() => onOpen(m.job_id)}
              className="flex w-full flex-wrap items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition hover:border-aura-500/40"
            >
              <span className="w-14 text-center font-display text-2xl text-aura-400">{Math.round(m.score)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-bone">{m.job_title}</p>
                <p className="flex items-center gap-1 text-xs text-graphite-400">
                  <Building className="h-3 w-3" aria-hidden="true" /> {m.company_name} / {MODALITY[m.modality]}
                </p>
                <p className="mt-1 text-[0.7rem] text-graphite-400">
                  {m.required_met}/{m.required_total} requisitos obligatorios
                  {m.top_gap && ` / principal brecha: ${m.top_gap}`}
                </p>
              </div>
              <MatchRange score={m.score} low={m.score_low} high={m.score_high} compact />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-graphite-400">
        La compatibilidad es una estimacion con rango, calculada con reglas transparentes sobre tu perfil. Abre una vacante para ver por
        que.
      </p>
    </>
  )
}

function Gaps() {
  const { data } = useQuery({ queryKey: matchKeys.gaps, queryFn: matchApi.gaps })
  if (!data) {
    return (
      <div className="flex justify-center py-10">
        <AuraLoader label="Analizando brechas" />
      </div>
    )
  }
  const max = Math.max(1, ...data.gaps.map((g) => g.jobs_count))
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-graphite-300">
        Comparamos tu perfil con {data.analyzed_jobs} vacante(s) publicadas. Estas son las habilidades y requisitos que mas se repiten y aun
        no cubres:
      </p>
      {!data.gaps.length ? (
        <AuraEmptyState icon={TrendingUp} title="Sin brechas detectadas" />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.gaps.map((g) => (
            <li key={`${g.kind}-${g.name}`} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-3">
                <span className="w-36 truncate text-sm text-bone">{g.name}</span>
                <div className="neo-inset h-1.5 flex-1 overflow-hidden rounded-full">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-glow to-aura-600" style={{ width: `${(g.jobs_count / max) * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-graphite-400">
                  {g.jobs_count} vacante(s){g.required_in > 0 && `, ${g.required_in} obligatoria(s)`}
                </span>
              </div>
              <p className="mt-1 text-xs text-graphite-400">{g.suggestion}</p>
              <p className="mt-0.5 text-[0.65rem] text-graphite-500">{g.jobs.join(' / ')}</p>
            </li>
          ))}
        </ul>
      )}
      {data.strengths.length > 0 && (
        <p className="text-xs text-graphite-300">
          <span className="text-aura-400">Lo que mas te favorece: </span>
          {data.strengths.join(', ')}
        </p>
      )}
      <p className="text-xs text-graphite-400">{data.note}</p>
    </div>
  )
}
