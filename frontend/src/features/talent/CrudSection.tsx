import { type LucideIcon, Pencil, Plus } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraConfirmButton } from '@/components/aura/AuraConfirmButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'

export interface FormRenderProps<T> {
  item?: T
  onDone: () => void
}

interface CrudSectionProps<T extends { id: string }> {
  title: string
  icon: LucideIcon
  items: T[]
  addLabel: string
  emptyTitle: string
  emptyHint?: string
  itemLabel: (item: T) => string
  renderItem: (item: T) => ReactNode
  renderForm: (props: FormRenderProps<T>) => ReactNode
  onDelete: (item: T) => Promise<unknown>
}

/** Lista editable en linea: agregar, editar y eliminar sin salir del workspace. */
export function CrudSection<T extends { id: string }>({
  title,
  icon,
  items,
  addLabel,
  emptyTitle,
  emptyHint,
  itemLabel,
  renderItem,
  renderForm,
  onDelete,
}: CrudSectionProps<T>) {
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const done = () => setEditing(null)

  const remove = async (item: T) => {
    setDeleting(item.id)
    try {
      await onDelete(item)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="hud-label text-graphite-300">{title}</h3>
        {editing !== 'new' && (
          <AuraButton variant="neo" size="sm" icon={Plus} onClick={() => setEditing('new')}>
            {addLabel}
          </AuraButton>
        )}
      </div>

      {editing === 'new' && <div className="neo-inset rounded-xl p-4">{renderForm({ onDone: done })}</div>}

      {items.length === 0 && editing !== 'new' && (
        <AuraEmptyState icon={icon} title={emptyTitle}>
          {emptyHint}
        </AuraEmptyState>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((item) =>
          editing === item.id ? (
            <li key={item.id} className="neo-inset rounded-xl p-4">
              {renderForm({ item, onDone: done })}
            </li>
          ) : (
            <li key={item.id} className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-aura-500/25">
              <div className="min-w-0 flex-1">{renderItem(item)}</div>
              <div className="flex shrink-0 items-center gap-1 opacity-100 transition md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                <AuraButton
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${itemLabel(item)}`}
                  onClick={() => setEditing(item.id)}
                >
                  <Pencil className="h-4 w-4" />
                </AuraButton>
                <AuraConfirmButton
                  label={`Eliminar ${itemLabel(item)}`}
                  loading={deleting === item.id}
                  onConfirm={() => void remove(item)}
                />
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}

export function FormActions({ onCancel, loading }: { onCancel: () => void; loading: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <AuraButton variant="ghost" size="sm" onClick={onCancel}>
        Cancelar
      </AuraButton>
      <AuraButton type="submit" size="sm" loading={loading}>
        Guardar
      </AuraButton>
    </div>
  )
}
