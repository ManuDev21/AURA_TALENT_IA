import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Brain, Building, Clock, FlaskConical, History, ListChecks } from 'lucide-react'
import { useState } from 'react'
import { assessmentKeys, assessmentsApi } from '@/api/assessments'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraTabs } from '@/components/aura/AuraTabs'
import { AssessmentResultView } from '@/features/assessments/AssessmentResultView'
import { AssessmentRunner } from '@/features/assessments/AssessmentRunner'
import type { CatalogItem } from '@/types/assessments'

export const TYPE_LABELS: Record<string, string> = {
  technical: 'Tecnica',
  situational: 'Situacional',
  psychometric: 'Orientacion (experimental)',
  logical: 'Razonamiento logico',
  verbal: 'Razonamiento verbal',
  numerical: 'Razonamiento numerico',
  cognitive: 'Cognitiva',
  language: 'Idioma',
  orientation: 'Orientacion profesional',
}

type View = { kind: 'home' } | { kind: 'run'; versionId: string; assignmentId: string | null } | { kind: 'result'; attemptId: string }

export function AssessmentsModule() {
  const [view, setView] = useState<View>({ kind: 'home' })
  const [tab, setTab] = useState<'catalog' | 'history'>('catalog')
  const home = () => setView({ kind: 'home' })

  return (
    <AuraPanel eyebrow="Assessment Center" title="Evaluaciones" className="flex flex-col gap-4">
      {view.kind === 'run' && (
        <AssessmentRunner
          versionId={view.versionId}
          assignmentId={view.assignmentId}
          onExit={home}
          onFinished={(r) => setView({ kind: 'result', attemptId: r.attempt_id })}
        />
      )}
      {view.kind === 'result' && (
        <>
          <AuraButton variant="ghost" size="sm" icon={ArrowLeft} className="self-start" onClick={home}>
            Volver
          </AuraButton>
          <ResultLoader attemptId={view.attemptId} />
        </>
      )}
      {view.kind === 'home' && (
        <>
          <AuraTabs
            label="Evaluaciones"
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'catalog', label: 'Disponibles', icon: ListChecks },
              { id: 'history', label: 'Mis resultados', icon: History },
            ]}
          />
          {tab === 'catalog' ? (
            <Catalog onStart={(versionId, assignmentId) => setView({ kind: 'run', versionId, assignmentId })} onResult={(attemptId) => setView({ kind: 'result', attemptId })} />
          ) : (
            <HistoryList onOpen={(attemptId) => setView({ kind: 'result', attemptId })} />
          )}
          <p className="text-xs text-graphite-400">
            Las evaluaciones de orientacion son experimentales: describen tendencias en tus respuestas, no diagnostican ni
            deciden por ti. Tus resultados psicometricos solo se comparten si tu lo eliges.
          </p>
        </>
      )}
    </AuraPanel>
  )
}

function Catalog({ onStart, onResult }: { onStart: (versionId: string, assignmentId: string | null) => void; onResult: (id: string) => void }) {
  const { data, isPending } = useQuery({ queryKey: assessmentKeys.catalog, queryFn: assessmentsApi.catalog })
  if (isPending) {
    return (
      <div className="flex justify-center py-10">
        <AuraLoader label="Cargando evaluaciones" />
      </div>
    )
  }
  if (!data?.length) return <AuraEmptyState icon={Brain} title="No hay evaluaciones disponibles" />
  const assigned = data.filter((i) => i.pending_assignments.length)

  return (
    <div className="flex flex-col gap-4">
      {assigned.length > 0 && (
        <section aria-label="Solicitadas por empresas" className="flex flex-col gap-2">
          <h3 className="hud-label text-aura-400">Solicitadas por empresas</h3>
          {assigned.flatMap((item) =>
            item.pending_assignments.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-aura-500/40 bg-aura-500/[0.06] p-3">
                <Building className="h-4 w-4 text-aura-400" aria-hidden="true" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-bone">{item.title}</p>
                  <p className="text-xs text-graphite-400">
                    {a.company_name}
                    {a.job_title && ` / ${a.job_title}`}
                    {a.due_at && ` / antes del ${new Date(a.due_at).toLocaleDateString('es')}`}
                  </p>
                </div>
                <AuraButton size="sm" onClick={() => onStart(item.version_id, a.id)}>
                  Responder
                </AuraButton>
              </div>
            )),
          )}
        </section>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {data.map((item) => (
          <CatalogCard key={item.version_id} item={item} onStart={() => onStart(item.version_id, null)} onResult={onResult} />
        ))}
      </ul>
    </div>
  )
}

function CatalogCard({ item, onStart, onResult }: { item: CatalogItem; onStart: () => void; onResult: (id: string) => void }) {
  const last = item.last_attempt
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AuraBadge tone="neutral">{TYPE_LABELS[item.type_code] ?? item.type_name}</AuraBadge>
        {item.is_experimental && (
          <AuraBadge tone="warning">
            <FlaskConical className="h-3 w-3" aria-hidden="true" /> Experimental
          </AuraBadge>
        )}
      </div>
      <div>
        <p className="font-medium text-bone">{item.title}</p>
        {item.description && <p className="mt-1 line-clamp-3 text-xs text-graphite-400">{item.description}</p>}
      </div>
      <p className="flex items-center gap-3 text-xs text-graphite-400">
        <span>{item.question_count} preguntas</span>
        {item.time_limit_seconds && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" /> {Math.round(item.time_limit_seconds / 60)} min
          </span>
        )}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2">
        {last?.status === 'scored' ? (
          <button type="button" className="text-xs text-aura-400 hover:underline" onClick={() => onResult(last.id)}>
            Ver ultimo resultado{last.overall_score !== null && ` (${Math.round(Number(last.overall_score))})`}
          </button>
        ) : (
          <span className="text-xs text-graphite-400">{last?.status === 'in_progress' ? 'En curso' : 'Sin intentos'}</span>
        )}
        <AuraButton size="sm" variant="neo" onClick={onStart}>
          {last?.status === 'in_progress' ? 'Continuar' : last ? 'Repetir' : 'Comenzar'}
        </AuraButton>
      </div>
    </li>
  )
}

function HistoryList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data = [] } = useQuery({ queryKey: assessmentKeys.history, queryFn: assessmentsApi.history })
  const scored = data.filter((a) => a.status === 'scored')
  if (!scored.length) return <AuraEmptyState icon={History} title="Aun no tienes resultados" />
  return (
    <ul className="flex flex-col gap-2">
      {scored.map((a) => (
        <li key={a.id}>
          <button type="button" onClick={() => onOpen(a.id)} className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left hover:border-aura-500/40">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-bone">{a.title}</p>
              <p className="text-xs text-graphite-400">
                {a.submitted_at && new Date(a.submitted_at).toLocaleDateString('es')}
                {a.assignment_company && ` / ${a.assignment_company}${a.share_with_company ? ' (compartido)' : ' (no compartido)'}`}
              </p>
            </div>
            {a.overall_score !== null && <span className="font-mono text-aura-400">{Math.round(Number(a.overall_score))}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

function ResultLoader({ attemptId }: { attemptId: string }) {
  const { data } = useQuery({ queryKey: assessmentKeys.result(attemptId), queryFn: () => assessmentsApi.result(attemptId) })
  return data ? (
    <AssessmentResultView result={data} />
  ) : (
    <div className="flex justify-center py-10">
      <AuraLoader label="Cargando resultado" />
    </div>
  )
}
