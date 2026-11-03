import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface AuraPanelProps extends HTMLAttributes<HTMLElement> {
  eyebrow?: string
  title?: string
  actions?: ReactNode
  as?: 'section' | 'div' | 'aside'
}

/** Panel glass con marco holografico en las esquinas. */
export function AuraPanel({ eyebrow, title, actions, as: Tag = 'section', className, children, ...props }: AuraPanelProps) {
  return (
    <Tag className={cn('glass relative rounded-2xl p-6', className)} {...props}>
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-3 w-3 border-l border-t border-aura-500/60" />
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-3 w-3 border-r border-t border-aura-500/60" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 border-b border-l border-aura-500/60" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-b border-r border-aura-500/60" />
      {(eyebrow || title || actions) && (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            {eyebrow && <p className="hud-label text-aura-400">{eyebrow}</p>}
            {title && <h2 className="mt-1 font-display text-xl font-semibold text-bone">{title}</h2>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </Tag>
  )
}
