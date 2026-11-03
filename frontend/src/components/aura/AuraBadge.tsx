import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

type Tone = 'aura' | 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const TONES: Record<Tone, string> = {
  aura: 'border-aura-500/40 bg-aura-500/10 text-aura-400',
  success: 'border-success/40 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  danger: 'border-danger/40 bg-danger/10 text-danger',
  neutral: 'border-white/10 bg-white/5 text-graphite-300',
  info: 'border-info/40 bg-info/10 text-info',
}

export function AuraBadge({ tone = 'aura', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('hud-label inline-flex items-center gap-1 rounded-full border px-2.5 py-1', TONES[tone], className)}>
      {children}
    </span>
  )
}
