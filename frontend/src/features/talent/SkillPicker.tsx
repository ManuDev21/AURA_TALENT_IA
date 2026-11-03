import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { type KeyboardEvent, useDeferredValue, useId, useState } from 'react'
import { queryKeys, skillsApi } from '@/api/talent'
import type { Skill } from '@/types/talent'
import { cn } from '@/utils/cn'

interface SkillPickerProps {
  label?: string
  excludeIds?: string[]
  onSelect: (skill: Skill) => void
}

/** Buscador del catalogo de habilidades (incluye sinonimos: "JS" encuentra JavaScript). */
export function SkillPicker({ label = 'Agregar habilidad', excludeIds = [], onSelect }: SkillPickerProps) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const deferred = useDeferredValue(query.trim())

  const { data = [], isFetching } = useQuery({
    queryKey: queryKeys.skills(deferred),
    queryFn: () => skillsApi.search(deferred, undefined, 12),
    enabled: open && deferred.length > 0,
    staleTime: 60_000,
  })
  const results = data.filter((s) => !excludeIds.includes(s.id))

  const choose = (skill: Skill | undefined) => {
    if (!skill) return
    onSelect(skill)
    setQuery('')
    setActive(0)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(results[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && deferred.length > 0

  return (
    <div className="relative">
      <label htmlFor={id} className="hud-label text-graphite-300">
        {label}
      </label>
      <div className="neo-inset mt-1.5 flex items-center gap-2 rounded-xl px-3 focus-within:shadow-[0_0_0_1px_rgb(255_122_26/0.6)]">
        <Search className="h-4 w-4 text-graphite-400" aria-hidden="true" />
        <input
          id={id}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={showList && results[active] ? `${id}-${results[active].id}` : undefined}
          placeholder="Busca: React, Python, SQL, comunicacion..."
          className="h-11 w-full bg-transparent text-sm text-bone placeholder:text-graphite-400 focus:outline-none focus-visible:shadow-none focus-visible:outline-none"
        />
      </div>
      {showList && (
        <ul id={`${id}-list`} role="listbox" className="glass absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl py-1">
          {results.length === 0 && (
            <li className="px-4 py-3 text-xs text-graphite-400">{isFetching ? 'Buscando...' : 'Sin resultados en el catalogo.'}</li>
          )}
          {results.map((skill, i) => (
            <li
              key={skill.id}
              id={`${id}-${skill.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(skill)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm',
                i === active ? 'bg-aura-500/10 text-bone' : 'text-graphite-300',
              )}
            >
              <span className="flex items-center gap-2">
                <Plus className="h-3.5 w-3.5 text-aura-400" aria-hidden="true" />
                {skill.name}
              </span>
              <span className="hud-label text-[0.6rem] text-graphite-400">{skill.category?.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
