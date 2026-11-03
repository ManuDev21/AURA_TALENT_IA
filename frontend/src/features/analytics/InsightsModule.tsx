import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { analyticsApi, analyticsKeys } from '@/api/analytics'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraProgressRing } from '@/components/aura/AuraProgressRing'
import { HBars, Kpi } from '@/features/analytics/charts'
import { toast } from '@/store/toastStore'

export function InsightsModule() {
  const { data } = useQuery({ queryKey: analyticsKeys.me, queryFn: analyticsApi.me })
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      await analyticsApi.personalReport()
      toast.success('Reporte descargado.')
    } catch {
      toast.error('No se pudo generar el reporte.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuraPanel
      eyebrow="Mi progreso"
      title="Tu avance profesional"
      className="flex flex-col gap-5"
      actions={
        <AuraButton variant="neo" size="sm" icon={Download} loading={busy} className="mr-10" onClick={() => void download()}>
          Reporte PDF
        </AuraButton>
      }
    >
      {!data ? (
        <div className="flex justify-center py-12">
          <AuraLoader label="Calculando tu progreso" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-5">
            <AuraProgressRing value={data.kpis.completeness} label="Perfil" sublabel="perfil completo" />
            <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-3">
              <Kpi label="Habilidades" value={data.kpis.skills} />
              <Kpi label="Postulaciones activas" value={`${data.kpis.active_applications}/${data.kpis.applications}`} />
              <Kpi label="Mejor compatibilidad" value={data.kpis.best_match !== null ? `${Math.round(data.kpis.best_match)}%` : '-'} />
              <Kpi label="Evaluaciones" value={data.kpis.assessments_completed} />
              <Kpi label="Promedio evaluaciones" value={data.kpis.avg_assessment !== null ? Math.round(data.kpis.avg_assessment) : '-'} />
              <Kpi label="Recomendaciones seguidas" value={data.kpis.recommendations_acted} />
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h3 className="hud-label text-aura-400">Postulaciones activas por etapa</h3>
              <HBars items={data.applications_by_stage.map((a) => ({ label: a.label, value: a.count }))} />
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="hud-label text-aura-400">Rutas profesionales</h3>
              <HBars items={data.career_paths.map((p) => ({ label: p.title, value: p.progress }))} unit="%" max={100} />
            </section>
          </div>
          <p className="text-xs text-graphite-400">Esta vista es solo tuya. Ninguna empresa ve estos indicadores.</p>
        </>
      )}
    </AuraPanel>
  )
}
