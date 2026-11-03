import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Briefcase, ExternalLink, FolderKanban, GraduationCap, RefreshCw, Route, Sparkles, Wrench, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { careerKeys, recsApi } from '@/api/career'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraExplain } from '@/components/aura/AuraExplain'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { useReducedMotion } from '@/hooks/useMediaQuery'
import type { Recommendation, RecType } from '@/types/career'
import { cn } from '@/utils/cn'

const TYPES: { type: RecType; label: string; icon: typeof Briefcase }[] = [
  { type: 'job', label: 'Vacantes', icon: Briefcase },
  { type: 'skill', label: 'Habilidades', icon: Wrench },
  { type: 'course', label: 'Cursos', icon: GraduationCap },
  { type: 'project', label: 'Proyectos', icon: FolderKanban },
  { type: 'career_path', label: 'Rutas', icon: Route },
]

/** Orbita de recomendaciones: cada tipo es un satelite alrededor del nucleo; al elegirlo se listan con su razon. */
export function RecommendationsModule() {
  const qc = useQueryClient()
  const reduced = useReducedMotion()
  const { data } = useQuery({ queryKey: careerKeys.recs, queryFn: recsApi.current })
  const [active, setActive] = useState<RecType>('job')
  const refresh = useAuraMutation({
    mutationFn: recsApi.refresh,
    onSuccess: (d) => qc.setQueryData(careerKeys.recs, d),
    success: 'Recomendaciones actualizadas.',
  })

  if (!data) {
    return (
      <AuraPanel eyebrow="AURA" title="Recomendaciones">
        <div className="flex justify-center py-12">
          <AuraLoader label="Preparando recomendaciones" />
        </div>
      </AuraPanel>
    )
  }
  const counts = Object.fromEntries(TYPES.map((t) => [t.type, data.items.filter((i) => i.rec_type === t.type).length]))
  const list = data.items.filter((i) => i.rec_type === active)

  return (
    <AuraPanel
      eyebrow="AURA"
      title="Recomendaciones"
      className="flex flex-col gap-5"
      actions={
        <AuraButton variant="neo" size="sm" icon={RefreshCw} loading={refresh.isPending} className="mr-10" onClick={() => refresh.mutate()}>
          Actualizar
        </AuraButton>
      }
    >
      <div className="relative mx-auto aspect-square w-full max-w-[19rem]" role="tablist" aria-label="Tipos de recomendacion">
        <div className={cn('absolute inset-[18%] rounded-full border border-dashed border-aura-500/25', !reduced && 'animate-[spin_60s_linear_infinite]')} aria-hidden="true" />
        <div className="absolute inset-[36%] flex items-center justify-center rounded-full bg-[radial-gradient(circle,#ffb547_0%,#ff7a1a_45%,#3a1600_100%)] shadow-[0_0_60px_rgb(255_122_26/0.55)]" aria-hidden="true">
          <Sparkles className="h-6 w-6 text-ink" />
        </div>
        {TYPES.map((t, i) => {
          const angle = (i / TYPES.length) * Math.PI * 2 - Math.PI / 2
          const Icon = t.icon
          const selected = active === t.type
          return (
            <button
              key={t.type}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.type)}
              className={cn(
                'absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full text-[0.6rem] transition',
                selected ? 'neo text-aura-400 shadow-[0_0_30px_-4px_rgb(255_122_26/0.8)]' : 'glass text-graphite-300 hover:text-bone',
              )}
              style={{ left: `${50 + Math.cos(angle) * 40}%`, top: `${50 + Math.sin(angle) * 40}%` }}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t.label}
              <span className="font-mono text-[0.55rem] text-graphite-400">{counts[t.type]}</span>
            </button>
          )
        })}
      </div>

      <ul className="flex flex-col gap-2" role="tabpanel" aria-label={TYPES.find((t) => t.type === active)?.label}>
        {list.length === 0 && <li className="text-sm text-graphite-400">No hay recomendaciones de este tipo por ahora.</li>}
        {list.map((r) => (
          <RecCard key={r.id} rec={r} />
        ))}
      </ul>

      <AuraExplain title="Como se generan" method={data.explanation.method} dataUsed={data.explanation.data_used} limitations={data.explanation.limitations} />
    </AuraPanel>
  )
}

function RecCard({ rec }: { rec: Recommendation }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const act = useAuraMutation({
    mutationFn: (action: 'save' | 'dismiss' | 'click') => recsApi.feedback(rec.id, action),
    onSuccess: (_, action) => {
      if (action !== 'click') void qc.invalidateQueries({ queryKey: careerKeys.recs })
    },
  })
  const open = () => {
    act.mutate('click')
    if (rec.rec_type === 'job' && rec.target_id) navigate(`/candidate/match?job=${rec.target_id}`)
    else if (rec.rec_type === 'career_path') navigate('/candidate/career')
    else if (rec.rec_type === 'skill') navigate('/candidate/profile')
    else if (rec.reason.url) window.open(rec.reason.url, '_blank', 'noopener,noreferrer')
  }
  return (
    <li className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-start gap-3">
        <span className="font-mono text-sm text-aura-400">{Math.round(rec.score * 100)}</span>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={open} className="inline-flex items-center gap-1 text-left text-bone hover:text-aura-400">
            {rec.target_label}
            {rec.reason.url && <ExternalLink className="h-3 w-3" aria-hidden="true" />}
          </button>
          {rec.reason.summary && <p className="mt-1 text-xs text-graphite-300">{rec.reason.summary}</p>}
          {!!rec.reason.factors?.length && (
            <ul className="mt-1 list-disc pl-4 text-[0.7rem] text-graphite-400">
              {rec.reason.factors.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          {!!rec.reason.gaps?.length && <p className="mt-1 text-[0.7rem] text-graphite-400">Por reforzar: {rec.reason.gaps.join(', ')}</p>}
        </div>
        <div className="flex gap-1">
          <AuraButton variant="ghost" size="icon" aria-label="Guardar" disabled={act.isPending} onClick={() => act.mutate('save')}>
            <Bookmark className={cn('h-4 w-4', rec.reason.saved && 'fill-aura-500 text-aura-500')} />
          </AuraButton>
          <AuraButton variant="ghost" size="icon" aria-label="Descartar (no volver a sugerir)" disabled={act.isPending} onClick={() => act.mutate('dismiss')}>
            <X className="h-4 w-4" />
          </AuraButton>
        </div>
      </div>
    </li>
  )
}
