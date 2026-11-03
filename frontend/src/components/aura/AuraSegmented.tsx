import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface Option<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

interface AuraSegmentedProps<T extends string> {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
}

export function AuraSegmented<T extends string>({ label, value, options, onChange }: AuraSegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="neo-inset grid auto-cols-fr grid-flow-col gap-1 rounded-xl p-1">
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
        const active = optionValue === value
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(optionValue)}
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-lg text-sm transition-all duration-200 ease-aura',
              active ? 'neo text-aura-400' : 'text-graphite-400 hover:text-bone',
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {optionLabel}
          </button>
        )
      })}
    </div>
  )
}
