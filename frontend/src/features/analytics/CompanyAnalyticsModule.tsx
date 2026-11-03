import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { analyticsApi, analyticsKeys } from '@/api/analytics'
import { AuraExplain } from '@/components/aura/AuraExplain'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { Columns, Funnel, HBars, Kpi } from '@/features/analytics/charts'

export function CompanyAnalyticsModule() {
  const [params, setParams] = useSearchParams()
  const jobId = params.get('job') ?? ''
  const { data } = useQuery({ queryKey: analyticsKeys.company(jobId), queryFn: () => analyticsApi.company(jobId || undefined) })

  return (
    <AuraPanel eyebrow="Analytics" title="Analitica de reclutamiento" className="flex flex-col gap-5">
      {!data ? (
        <div className="flex justify-center py-12">
          <AuraLoader label="Calculando indicadores" />
        </div>
      ) : (
        <>
          <AuraSelect
            label="Alcance"
            placeholder="Todas las vacantes"
            options={[{ value: '', label: 'Todas las vacantes' }, ...data.jobs.map((j) => ({ value: j.id, label: `${j.title} (${j.applications})` }))]}
            value={jobId}
            onChange={(e) => setParams(e.target.value ? { job: e.target.value } : {})}
          />
          {data.small_sample && (
            <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Hay pocas postulaciones: las proporciones todavia no son representativas.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Postulaciones" value={data.kpis.applications} />
            <Kpi label="En proceso" value={data.kpis.active} />
            <Kpi label="Seleccionadas" value={data.kpis.hired} />
            <Kpi label="Match promedio" value={data.kpis.avg_match !== null ? `${Math.round(data.kpis.avg_match)}%` : '-'} hint="estimacion explicable" />
            <Kpi label="Vacantes publicadas" value={data.kpis.jobs_published} />
            <Kpi label="Procesos concluidos" value={data.kpis.closed} />
            <Kpi label="Retiradas" value={data.kpis.withdrawn} />
            <Kpi label="Evaluaciones" value={`${data.kpis.assessments_completed}/${data.kpis.assessments_assigned}`} hint="completadas / asignadas" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h3 className="hud-label text-aura-400">Embudo de seleccion</h3>
              <Funnel steps={data.funnel} />
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="hud-label text-aura-400">Postulaciones por semana</h3>
              <Columns items={data.weekly.map((w) => ({ label: w.week_start.slice(5), value: w.count }))} />
              <h3 className="hud-label mt-3 text-aura-400">Dias promedio por etapa</h3>
              <HBars items={data.stage_durations.map((d) => ({ label: d.label, value: d.avg_days, extra: `(${d.samples})` }))} unit=" d" />
            </section>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h3 className="hud-label text-aura-400">Habilidades mas frecuentes entre postulantes</h3>
              <HBars items={data.top_skills.map((s) => ({ label: s.name, value: s.count }))} />
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="hud-label text-aura-400">Brechas mas frecuentes</h3>
              <HBars items={data.top_gaps.map((s) => ({ label: s.name, value: s.count }))} />
              <p className="text-[0.7rem] text-graphite-400">Habilidades requeridas que los postulantes no declaran: util para ajustar requisitos o formar talento.</p>
            </section>
          </div>
          <AuraExplain method={data.explanation.method} dataUsed={data.explanation.data_used} limitations={data.explanation.limitations} />
        </>
      )}
    </AuraPanel>
  )
}
