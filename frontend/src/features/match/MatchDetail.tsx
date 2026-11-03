import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleDashed, EyeOff, Lightbulb, TriangleAlert } from 'lucide-react'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraExplain } from '@/components/aura/AuraExplain'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { MatchVisualization } from '@/features/match/MatchVisualization'
import type { MatchResult } from '@/types/match'

const LABEL_TONE = { Alta: 'success', Media: 'aura', Baja: 'neutral' } as const

/** Rango de compatibilidad sobre una pista 0-100: comunica incertidumbre en lugar de una cifra exacta. */
export function MatchRange({ score, low, high, compact = false }: { score: number; low: number; high: number; compact?: boolean }) {
  return (
    <div className={compact ? 'w-28' : 'w-full'} aria-label={`Compatibilidad estimada ${Math.round(score)} por ciento, entre ${Math.round(low)} y ${Math.round(high)}`}>
      <div className="neo-inset relative h-2 rounded-full">
        <div className="absolute inset-y-0 rounded-full bg-aura-500/30" style={{ left: `${low}%`, width: `${Math.max(1, high - low)}%` }} />
        <div className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full bg-aura-400 shadow-[0_0_10px_rgb(255_122_26/0.9)]" style={{ left: `calc(${score}% - 2px)` }} />
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between font-mono text-[0.6rem] text-graphite-400">
          <span>0</span>
          <span>
            rango {Math.round(low)}-{Math.round(high)}
          </span>
          <span>100</span>
        </div>
      )}
    </div>
  )
}

export function MatchDetail({ match, perspective }: { match: MatchResult; perspective: 'candidate' | 'company' }) {
  const own = perspective === 'candidate'
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-5">
        <div className="text-center">
          <p className="font-display text-4xl font-semibold text-aura-400">{Math.round(match.score)}%</p>
          <AuraBadge tone={LABEL_TONE[match.label]}>Compatibilidad {match.label.toLowerCase()}</AuraBadge>
        </div>
        <div className="min-w-48 flex-1">
          <p className="text-sm text-bone">
            {match.job_title} <span className="text-graphite-400">/ {match.company_name}</span>
          </p>
          <MatchRange score={match.score} low={match.score_low} high={match.score_high} />
          {match.data_completeness < 1 && (
            <p className="mt-1 text-[0.7rem] text-graphite-400">
              El rango es amplio porque {own ? 'a tu perfil le faltan' : 'al perfil le faltan'} algunos datos.
            </p>
          )}
        </div>
      </header>

      <MatchVisualization requirements={match.requirements} score={match.score} candidateLabel={own ? 'Tu perfil' : 'Candidato'} jobLabel={match.job_title} />

      <section aria-label="Factores" className="flex flex-col gap-2">
        <h4 className="hud-label text-aura-400">Factores del calculo</h4>
        {match.factors.map((f) => (
          <div key={f.code} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-xs">
            <span className="truncate text-graphite-300" title={f.label}>
              {f.label}
            </span>
            <div className="neo-inset h-1.5 overflow-hidden rounded-full" role="meter" aria-label={f.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f.score * 100)}>
              <div className="h-full rounded-full bg-gradient-to-r from-amber-glow to-aura-600" style={{ width: `${f.score * 100}%` }} />
            </div>
            <span className="w-32 text-right font-mono text-[0.65rem] text-graphite-400" title={f.evidence.join(', ')}>
              peso {Math.round(f.weight * 100)}% / {f.detail}
            </span>
          </div>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <h4 className="hud-label mb-2 text-aura-400">Fortalezas</h4>
          {match.strengths.length ? (
            <ul className="flex flex-col gap-1 text-sm text-graphite-300">
              {match.strengths.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <CircleCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" /> {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-graphite-400">Sin requisitos cumplidos todavia.</p>
          )}
        </section>
        <section>
          <h4 className="hud-label mb-2 text-aura-400">Brechas</h4>
          {match.gaps.length ? (
            <ul className="flex flex-col gap-1 text-sm text-graphite-300">
              {match.gaps.map((g) => (
                <li key={`${g.kind}-${g.name}`} className="flex items-start gap-2">
                  {g.required ? (
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-label="Obligatorio" />
                  ) : (
                    <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-graphite-400" aria-label="Deseable" />
                  )}
                  <span>
                    {g.name} <span className="text-xs text-graphite-400">- {g.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-graphite-400">No se detectaron brechas.</p>
          )}
        </section>
      </div>

      {own && match.recommendations.length > 0 && (
        <section className="rounded-xl border border-aura-500/20 bg-aura-500/[0.04] p-4">
          <h4 className="hud-label mb-2 flex items-center gap-1.5 text-aura-400">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> Como mejorar
          </h4>
          <ul className="list-disc space-y-1 pl-4 text-sm text-graphite-300">
            {match.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <AuraExplain method={match.explanation.method} dataUsed={match.explanation.data_used} limitations={match.explanation.limitations} disclaimer={match.disclaimer} />
      <p className="flex items-start gap-2 text-[0.7rem] text-graphite-400">
        <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        No se utiliza: {match.explanation.not_used.join('; ')}. Modelo {match.model_version}.
      </p>
    </div>
  )
}

export function MatchLoader({ queryKey, queryFn, perspective }: { queryKey: readonly unknown[]; queryFn: () => Promise<MatchResult>; perspective: 'candidate' | 'company' }) {
  const { data, isError } = useQuery({ queryKey, queryFn })
  if (isError) return <p className="text-sm text-graphite-400">No fue posible calcular la compatibilidad.</p>
  return data ? (
    <MatchDetail match={data} perspective={perspective} />
  ) : (
    <div className="flex justify-center py-10">
      <AuraLoader label="Calculando compatibilidad" />
    </div>
  )
}
