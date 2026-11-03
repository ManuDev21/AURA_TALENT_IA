import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AuraButton } from '@/components/aura/AuraButton'
import { ContentEditor } from '@/features/cv/ContentEditor'
import { SECTION_LABELS } from '@/features/cv/sectionSchema'
import type { ResumeSection } from '@/types/cv'
import { cn } from '@/utils/cn'

interface SectionCardProps {
  section: ResumeSection
  index: number
  total: number
  syncing: boolean
  dragging: boolean
  onChange: (section: ResumeSection) => void
  onMove: (to: number) => void
  onRemove: () => void
  onSync: (() => void) | null
  dragHandlers: {
    onDragStart: () => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: () => void
    onDragEnd: () => void
  }
}

export function SectionCard({
  section,
  index,
  total,
  syncing,
  dragging,
  onChange,
  onMove,
  onRemove,
  onSync,
  dragHandlers,
}: SectionCardProps) {
  const [open, setOpen] = useState(false)
  const label = SECTION_LABELS[section.section_type]
  const isHeader = section.section_type === 'header'

  return (
    <li
      onDragOver={dragHandlers.onDragOver}
      onDrop={dragHandlers.onDrop}
      className={cn(
        'rounded-xl border bg-white/[0.02] transition',
        dragging ? 'border-aura-500/60 opacity-60' : 'border-white/5',
        !section.is_visible && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-1 px-2 py-2">
        <span
          draggable
          onDragStart={dragHandlers.onDragStart}
          onDragEnd={dragHandlers.onDragEnd}
          className="cursor-grab rounded p-1 text-graphite-400 hover:text-aura-400 active:cursor-grabbing"
          title="Arrastra para reordenar"
          aria-hidden="true"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 flex-col text-left"
        >
          <span className="truncate text-sm text-bone">{section.title || label}</span>
          <span className="hud-label text-[0.55rem] text-graphite-400">{label}</span>
        </button>
        {onSync && (
          <AuraButton variant="ghost" size="icon" aria-label={`Sincronizar ${label} con tu perfil`} title="Actualizar con los datos de tu perfil" onClick={onSync} loading={syncing}>
            <RefreshCw className="h-4 w-4" />
          </AuraButton>
        )}
        <AuraButton
          variant="ghost"
          size="icon"
          aria-label={section.is_visible ? `Ocultar ${label}` : `Mostrar ${label}`}
          aria-pressed={!section.is_visible}
          onClick={() => onChange({ ...section, is_visible: !section.is_visible })}
        >
          {section.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </AuraButton>
        <AuraButton variant="ghost" size="icon" aria-label={`Subir ${label}`} disabled={index === 0} onClick={() => onMove(index - 1)}>
          <ChevronUp className="h-4 w-4" />
        </AuraButton>
        <AuraButton variant="ghost" size="icon" aria-label={`Bajar ${label}`} disabled={index === total - 1} onClick={() => onMove(index + 1)}>
          <ChevronDown className="h-4 w-4" />
        </AuraButton>
        {!isHeader && (
          <AuraButton variant="ghost" size="icon" aria-label={`Eliminar ${label}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </AuraButton>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-4 border-t border-white/5 p-4">
          {!isHeader && (
            <label className="flex flex-col gap-1.5">
              <span className="hud-label text-graphite-300">Titulo en el CV</span>
              <input
                value={section.title ?? ''}
                onChange={(e) => onChange({ ...section, title: e.target.value })}
                className="neo-inset h-10 rounded-xl bg-transparent px-3 text-sm text-bone focus:outline-none"
              />
            </label>
          )}
          <ContentEditor type={section.section_type} content={section.content} onChange={(content) => onChange({ ...section, content })} />
        </div>
      )}
    </li>
  )
}
