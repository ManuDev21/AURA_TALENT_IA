import type { LucideIcon } from 'lucide-react'
import { type KeyboardEvent, useId, useRef } from 'react'
import { cn } from '@/utils/cn'

export interface AuraTab<T extends string> {
  id: T
  label: string
  icon?: LucideIcon
  badge?: string | number
}

interface AuraTabsProps<T extends string> {
  label: string
  tabs: AuraTab<T>[]
  active: T
  onChange: (id: T) => void
}

/** Pestanas accesibles (patron WAI-ARIA con flechas, Inicio y Fin). */
export function AuraTabs<T extends string>({ label, tabs, active, onChange }: AuraTabsProps<T>) {
  const baseId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }
    const next = keys[event.key]
    if (next === undefined) return
    event.preventDefault()
    const tab = tabs[next]
    if (tab) {
      onChange(tab.id)
      refs.current[next]?.focus()
    }
  }

  return (
    <div role="tablist" aria-label={label} className="neo-inset flex gap-1 overflow-x-auto rounded-xl p-1">
      {tabs.map(({ id, label: tabLabel, icon: Icon, badge }, index) => {
        const selected = id === active
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[index] = el
            }}
            id={`${baseId}-${id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all duration-200 ease-aura',
              selected ? 'neo text-aura-400' : 'text-graphite-400 hover:text-bone',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {tabLabel}
            {badge !== undefined && badge !== 0 && (
              <span className="rounded-full bg-white/10 px-1.5 font-mono text-[0.6rem] text-graphite-300">{badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
