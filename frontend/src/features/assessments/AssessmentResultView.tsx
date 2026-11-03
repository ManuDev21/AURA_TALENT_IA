import { CircleCheck, CircleX, FlaskConical, Quote, Share2, TriangleAlert } from 'lucide-react'
import { assessmentKeys, assessmentsApi } from '@/api/assessments'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraExplain } from '@/components/aura/AuraExplain'
import { AuraProgressRing } from '@/components/aura/AuraProgressRing'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import type { AttemptResult, DimensionResult } from '@/types/assessments'

export const BAND_LABELS = { low: 'Baja', moderate: 'Moderada', high: 'Elevada' } as const

/** Resultado: DIMENSION / SCORE / RANGO / INTERPRETACION / EVIDENCIA / RECOMENDACIONES / LIMITACIONES. */
export function AssessmentResultView({ result }: { result: AttemptResult }) {
  const psychometric = result.type_code === 'psychometric'
  const share = useAuraMutation({
    mutationFn: (value: boolean) => assessmentsApi.share(result.attempt_id, value),
    invalidate: [assessmentKeys.result(result.attempt_id), assessmentKeys.history],
    success: (r) => (r.share_with_company ? 'Resultado compartido con la empresa.' : 'Dejaste de compartir el resultado.'),
  })

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-4">
        {result.overall_score !== null && <AuraProgressRing value={Math.round(Number(result.overall_score))} label="Puntaje" sublabel="puntaje" />}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-semibold">{result.title}</h3>
          <p className="text-xs text-graphite-400">
            Version {result.version_no}
            {result.duration_seconds != null && ` / ${Math.max(1, Math.round(result.duration_seconds / 60))} min`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.is_experimental && (
              <AuraBadge tone="warning">
                <FlaskConical className="h-3 w-3" aria-hidden="true" /> Instrumento experimental
              </AuraBadge>
            )}
            {result.overall_band && <AuraBadge tone="aura">Nivel {BAND_LABELS[result.overall_band]}</AuraBadge>}
          </div>
        </div>
      </header>

      <p className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">{result.disclaimer}</p>
      {result.quality_notes.map((n) => (
        <p key={n} className="flex items-start gap-2 text-xs text-graphite-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" /> {n}
        </p>
      ))}
      {result.summary && <p className="text-sm text-graphite-300">{result.summary}</p>}

      {result.dimensions.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Dimensiones">
          {result.dimensions.map((d) => (
            <DimensionCard key={d.code} dimension={d} />
          ))}
        </ul>
      )}

      {result.review.length > 0 && (
        <section aria-label="Revision de respuestas" className="flex flex-col gap-2">
          <h4 className="hud-label text-aura-400">Revision</h4>
          {result.review.map((r) => (
            <div key={r.question_id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm">
              <p className="flex items-start gap-2 text-bone">
                {r.is_correct === true && <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Correcta" />}
                {r.is_correct === false && <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Incorrecta" />}
                {r.stem}
              </p>
              <p className="mt-1 pl-6 text-xs text-graphite-400">Tu respuesta: {r.selected ?? 'Sin responder'}</p>
              {r.is_correct === false && r.correct && <p className="pl-6 text-xs text-success">Respuesta correcta: {r.correct}</p>}
              {r.rubric_score !== null && (
                <p className="pl-6 text-xs text-graphite-300">
                  Rubrica: {r.rubric_score} pts{r.rationale && ` - ${r.rationale}`}
                </p>
              )}
              {r.explanation && <p className="mt-1 pl-6 text-xs text-graphite-300">{r.explanation}</p>}
            </div>
          ))}
        </section>
      )}

      {result.recommendations.length > 0 && (
        <section>
          <h4 className="hud-label mb-1 text-aura-400">Recomendaciones</h4>
          <ul className="list-disc space-y-1 pl-4 text-sm text-graphite-300">
            {result.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <AuraExplain method={result.explanation.method} dataUsed={result.explanation.data_used} limitations={result.explanation.limitations} />

      {result.assignment_company && (
        <div className="neo-inset flex items-start gap-3 rounded-xl p-4">
          <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
          <div className="flex-1 text-sm">
            <p className="text-bone">Solicitada por {result.assignment_company}</p>
            {psychometric ? (
              <AuraCheckbox
                label="Compartir este resultado con la empresa (puedes retirarlo cuando quieras)"
                checked={result.share_with_company}
                disabled={share.isPending}
                onChange={(e) => share.mutate(e.target.checked)}
              />
            ) : (
              <p className="text-xs text-graphite-400">El resultado se comparte con la empresa que lo solicito.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function DimensionCard({ dimension: d }: { dimension: DimensionResult }) {
  const score = Math.round(Number(d.score))
  return (
    <li className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-bone">{d.name}</span>
        <span className="flex items-center gap-2">
          <AuraBadge tone="neutral">Tendencia {BAND_LABELS[d.band].toLowerCase()}</AuraBadge>
          <span className="font-mono text-sm text-aura-400">{score}</span>
        </span>
      </div>
      <div className="neo-inset relative h-2 overflow-hidden rounded-full" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={d.name}>
        <span className="absolute inset-y-0 left-[40%] w-px bg-white/20" aria-hidden="true" />
        <span className="absolute inset-y-0 left-[70%] w-px bg-white/20" aria-hidden="true" />
        <div className="h-full rounded-full bg-gradient-to-r from-amber-glow to-aura-600" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-2 text-sm text-graphite-300">{d.interpretation}</p>
      {d.evidence.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="inline-flex cursor-pointer items-center gap-1 text-graphite-400 hover:text-aura-400">
            <Quote className="h-3 w-3" aria-hidden="true" /> Evidencia en tus respuestas
          </summary>
          <ul className="mt-1 flex flex-col gap-1 border-l-2 border-aura-500/40 pl-2 text-graphite-300">
            {d.evidence.map((e) => (
              <li key={e.stem}>
                "{e.stem}" <span className="text-graphite-400">- respondiste: {e.answer}</span>
                {e.reverse_keyed && <span className="text-graphite-400"> (item inverso)</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
      {d.recommendations.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-graphite-400">
          {d.recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </li>
  )
}
