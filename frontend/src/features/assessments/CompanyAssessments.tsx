import { useQuery } from '@tanstack/react-query'
import { Lock, Send } from 'lucide-react'
import { useState } from 'react'
import { assessmentKeys, assessmentsApi } from '@/api/assessments'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { BAND_LABELS, DimensionCard } from '@/features/assessments/AssessmentResultView'
import { TYPE_LABELS } from '@/features/assessments/AssessmentsModule'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { useSessionStore } from '@/store/sessionStore'

const STATUS: Record<string, string> = { pending: 'Pendiente', started: 'En curso', completed: 'Completada', expired: 'Vencida', cancelled: 'Cancelada' }

/** Evaluaciones de una postulacion vistas por la empresa. Solo aparece lo que la persona comparte. */
export function CompanyAssessments({ applicationId, active }: { applicationId: string; active: boolean }) {
  const canAssign = useSessionStore((s) => s.user?.permissions.includes('assessments:assign') ?? false)
  const { data: views = [] } = useQuery({
    queryKey: assessmentKeys.forApplication(applicationId),
    queryFn: () => assessmentsApi.forApplication(applicationId),
  })
  const { data: assignable = [] } = useQuery({ queryKey: assessmentKeys.assignable, queryFn: assessmentsApi.assignable, enabled: canAssign })
  const [versionId, setVersionId] = useState('')
  const [due, setDue] = useState('')
  const assign = useAuraMutation({
    mutationFn: () =>
      assessmentsApi.assign({ version_id: versionId, application_id: applicationId, due_at: due ? new Date(`${due}T23:59:59`).toISOString() : null }),
    invalidate: [assessmentKeys.forApplication(applicationId)],
    success: 'Evaluacion asignada. La persona recibira una notificacion.',
    onSuccess: () => setVersionId(''),
  })
  const selected = assignable.find((a) => a.version_id === versionId)

  return (
    <div className="flex flex-col gap-4">
      {canAssign && active && (
        <div className="neo-inset flex flex-col gap-3 rounded-xl p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <AuraSelect
              label="Asignar evaluacion"
              placeholder="Selecciona un instrumento"
              options={assignable.map((a) => ({ value: a.version_id, label: `${a.title} (${TYPE_LABELS[a.type_code] ?? a.type_code})` }))}
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
            />
            <AuraInput label="Fecha limite" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          {selected?.type_code === 'psychometric' && (
            <p className="text-xs text-warning">
              Instrumento experimental de orientacion: no es una prueba clinica ni debe usarse como criterio unico. La persona
              decide si comparte su resultado.
            </p>
          )}
          <AuraButton size="sm" icon={Send} className="self-end" disabled={!versionId} loading={assign.isPending} onClick={() => assign.mutate()}>
            Asignar
          </AuraButton>
        </div>
      )}

      {!views.length && <p className="text-sm text-graphite-400">No hay evaluaciones asignadas en este proceso.</p>}
      <ul className="flex flex-col gap-3">
        {views.map((v) => (
          <li key={v.assignment_id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-bone">{v.title}</p>
                <p className="text-xs text-graphite-400">
                  {TYPE_LABELS[v.type_code] ?? v.type_code} / asignada {new Date(v.created_at).toLocaleDateString('es')}
                </p>
              </div>
              <AuraBadge tone={v.status === 'completed' ? 'success' : 'neutral'}>{STATUS[v.status] ?? v.status}</AuraBadge>
            </div>
            {v.status === 'completed' && !v.shared && (
              <p className="mt-3 flex items-center gap-2 text-xs text-graphite-400">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" /> La persona no ha compartido este resultado.
              </p>
            )}
            {v.result && (
              <div className="mt-3 flex flex-col gap-3">
                {v.result.overall_score !== null && (
                  <p className="text-sm">
                    Puntaje: <span className="font-mono text-aura-400">{Math.round(Number(v.result.overall_score))}</span>
                    {v.result.overall_band && ` / nivel ${BAND_LABELS[v.result.overall_band as keyof typeof BAND_LABELS].toLowerCase()}`}
                  </p>
                )}
                {v.result.summary && <p className="text-xs text-graphite-300">{v.result.summary}</p>}
                {v.result.dimensions.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {v.result.dimensions.map((d) => (
                      <DimensionCard key={d.code} dimension={d} />
                    ))}
                  </ul>
                )}
                {v.result.quality_notes.map((n) => (
                  <p key={n} className="text-xs text-warning">{n}</p>
                ))}
                <p className="text-[0.7rem] text-graphite-400">{v.result.disclaimer} No es un criterio de decision por si solo.</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
