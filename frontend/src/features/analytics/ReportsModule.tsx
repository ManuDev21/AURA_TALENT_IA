import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { analyticsApi } from '@/api/analytics'
import { jobKeys, jobsApi } from '@/api/jobs'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { JOB_STATUS } from '@/features/jobs/labels'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'

export function ReportsModule() {
  const [params] = useSearchParams()
  const highlight = params.get('job')
  const { data: jobs = [] } = useQuery({ queryKey: jobKeys.company, queryFn: jobsApi.companyJobs })
  const [busy, setBusy] = useState<string | null>(null)

  const download = async (jobId: string, fmt: 'pdf' | 'xlsx') => {
    setBusy(`${jobId}:${fmt}`)
    try {
      await analyticsApi.vacancyReport(jobId, fmt)
      toast.success(fmt === 'pdf' ? 'Reporte PDF descargado.' : 'Reporte Excel descargado.')
    } catch {
      toast.error('No se pudo generar el reporte.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <AuraPanel eyebrow="Reportes" title="Reportes de vacantes" className="flex flex-col gap-4">
      <p className="text-sm text-graphite-300">
        Cada reporte incluye el embudo, el tiempo por etapa, las brechas frecuentes y la lista de postulantes con su compatibilidad estimada.
        El Excel trae una hoja por seccion para que puedas filtrar y ordenar.
      </p>
      {!jobs.length ? (
        <AuraEmptyState icon={FileText} title="Aun no hay vacantes" />
      ) : (
        <ul className="flex flex-col gap-2">
          {jobs.map((j) => (
            <li
              key={j.id}
              className={cn('flex flex-wrap items-center gap-3 rounded-xl border bg-white/[0.02] p-3', highlight === j.id ? 'border-aura-500/60' : 'border-white/5')}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-bone">{j.title}</p>
                <p className="text-xs text-graphite-400">{j.applications_count} postulacion(es)</p>
              </div>
              <AuraBadge tone="neutral">{JOB_STATUS[j.status].label}</AuraBadge>
              <AuraButton size="sm" variant="neo" icon={FileText} loading={busy === `${j.id}:pdf`} onClick={() => void download(j.id, 'pdf')}>
                PDF
              </AuraButton>
              <AuraButton size="sm" variant="ghost" icon={FileSpreadsheet} loading={busy === `${j.id}:xlsx`} onClick={() => void download(j.id, 'xlsx')}>
                Excel
              </AuraButton>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-graphite-400">Los reportes contienen datos personales de postulantes: compartelos solo dentro de tu equipo de seleccion.</p>
    </AuraPanel>
  )
}
