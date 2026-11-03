import { X } from 'lucide-react'
import { type KeyboardEvent, useId, useState } from 'react'
import { describedBy, FieldShell } from '@/components/aura/AuraField'

interface AuraTagInputProps {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  hint?: string
  error?: string
  max?: number
}

/** Lista de etiquetas: Enter o coma para agregar, Retroceso para quitar la ultima. */
export function AuraTagInput({ label, value, onChange, placeholder, hint, error, max = 15 }: AuraTagInputProps) {
  const id = useId()
  const [draft, setDraft] = useState('')

  const add = () => {
    const tag = draft.trim().replace(/,$/, '')
    if (tag && value.length < max && !value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      onChange([...value, tag])
    }
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add()
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <FieldShell id={id} label={label} error={error} hint={hint ?? 'Presiona Enter para agregar'}>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 py-2">
        {value.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded-lg bg-aura-500/15 py-1 pl-2.5 pr-1 text-xs text-ember-300">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="rounded p-0.5 hover:bg-white/10 hover:text-bone"
              aria-label={`Quitar ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
          placeholder={value.length < max ? placeholder : undefined}
          disabled={value.length >= max}
          aria-describedby={describedBy(id, error, hint ?? 'hint')}
          className="h-7 min-w-32 flex-1 bg-transparent text-sm text-bone placeholder:text-graphite-400 focus:outline-none focus-visible:shadow-none focus-visible:outline-none"
        />
      </div>
    </FieldShell>
  )
}
