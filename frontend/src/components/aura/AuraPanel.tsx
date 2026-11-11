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
    <Tag className={cn('glass relative rounded-2xl p-4 sm:p-6', className)} {...props}>
      <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 h-3 w-3 border-l border-t border-aura-500/60 sm:left-3 sm:top-3" />
      <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 h-3 w-3 border-r border-t border-aura-500/60 sm:right-3 sm:top-3" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-2.5 left-2.5 h-3 w-3 border-b border-l border-aura-500/60 sm:bottom-3 sm:left-3" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-2.5 right-2.5 h-3 w-3 border-b border-r border-aura-500/60 sm:bottom-3 sm:right-3" />
      {(eyebrow || title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-5 sm:gap-4">
          <div className="min-w-0 flex-1 pr-8 sm:pr-0">
            {eyebrow && <p className="hud-label text-aura-400">{eyebrow}</p>}
            {title && <h2 className="mt-1 font-display text-lg font-semibold leading-snug text-bone sm:text-xl">{title}</h2>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  )
}
