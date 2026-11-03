import { type AuraCoreState, useAuraStore } from '@/store/auraStore'
import { cn } from '@/utils/cn'

const LABELS: Record<AuraCoreState, string> = {
  IDLE: 'En espera',
  LISTENING: 'Escuchando',
  THINKING: 'Pensando',
  ANALYZING: 'Analizando',
  SPEAKING: 'Hablando',
  SUCCESS: 'Listo',
  WARNING: 'Atencion',
  ERROR: 'Error',
  VISION: 'Vision',
  GESTURE: 'Gestos',
}

const DOT_COLOR: Record<string, string> = {
  SUCCESS: 'bg-success',
  WARNING: 'bg-warning',
  ERROR: 'bg-danger',
}

/** Indicador holografico del estado actual del AURA Core. */
export function CoreStatus() {
  const coreState = useAuraStore((s) => s.coreState)
  return (
    <span className="hud-label flex items-center gap-2 text-graphite-300" aria-live="polite">
      <span className={cn('h-1.5 w-1.5 animate-pulse rounded-full', DOT_COLOR[coreState] ?? 'bg-aura-500')} />
      <span className="sr-only">Estado de AURA:</span>
      {LABELS[coreState]}
    </span>
  )
}
