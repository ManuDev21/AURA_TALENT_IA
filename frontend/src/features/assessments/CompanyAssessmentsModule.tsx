import { useQuery } from '@tanstack/react-query'
import { Brain, FlaskConical } from 'lucide-react'
import { Link } from 'react-router'
import { assessmentKeys, assessmentsApi } from '@/api/assessments'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { TYPE_LABELS } from '@/features/assessments/AssessmentsModule'

export function CompanyAssessmentsModule() {
  const { data = [] } = useQuery({ queryKey: assessmentKeys.assignable, queryFn: assessmentsApi.assignable })
  return (
    <AuraPanel eyebrow="Assessment Center" title="Evaluaciones disponibles" className="flex flex-col gap-4">
      <p className="text-sm text-graphite-300">
        Asigna evaluaciones desde la ficha de cada candidato en{' '}
        <Link to="/company/candidates" className="text-aura-400 hover:underline">
          Candidatos
        </Link>{' '}
        (pestana Evaluaciones). Veras los resultados tecnicos y situacionales; los de orientacion solo si la persona decide
        compartirlos.
      </p>
      {!data.length ? (
        <AuraEmptyState icon={Brain} title="No hay instrumentos publicados" />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {data.map((v) => (
            <li key={v.version_id} className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-sm text-bone">{v.title}</p>
              <p className="flex flex-wrap gap-2">
                <AuraBadge tone="neutral">{TYPE_LABELS[v.type_code] ?? v.type_code}</AuraBadge>
                {v.is_experimental && (
                  <AuraBadge tone="warning">
                    <FlaskConical className="h-3 w-3" aria-hidden="true" /> Experimental
                  </AuraBadge>
                )}
                <span className="text-xs text-graphite-400">{v.question_count} preguntas</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-graphite-400">
        Ninguna evaluacion decide por si sola: los resultados son un insumo mas para una decision humana informada.
      </p>
    </AuraPanel>
  )
}
