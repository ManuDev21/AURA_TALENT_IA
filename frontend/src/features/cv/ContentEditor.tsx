import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraTextarea } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraTagInput } from '@/components/aura/AuraTagInput'
import { emptyItem, type FieldDef, HEADER_FIELDS, ITEM_FIELDS, itemTitle, LINK_FIELDS } from '@/features/cv/sectionSchema'
import type { SectionContent, SectionType } from '@/types/cv'
import { cn } from '@/utils/cn'

type Obj = Record<string, unknown>

interface ContentEditorProps {
  type: SectionType
  content: SectionContent
  onChange: (content: SectionContent) => void
}

export function ContentEditor({ type, content, onChange }: ContentEditorProps) {
  if (type === 'summary' || type === 'custom') {
    return (
      <AuraTextarea
        label="Texto"
        rows={5}
        value={(content.text as string) ?? ''}
        onChange={(e) => onChange({ ...content, text: e.target.value })}
      />
    )
  }
  if (type === 'header') {
    return (
      <div className="flex flex-col gap-4">
        <FieldGrid fields={HEADER_FIELDS} value={content} onChange={onChange} />
        <ItemsEditor
          label="Enlaces del encabezado"
          fields={LINK_FIELDS}
          items={(content.links as Obj[]) ?? []}
          titleOf={(i) => (i.label as string) || 'Enlace'}
          newItem={() => ({ label: '', url: '' })}
          onChange={(links) => onChange({ ...content, links })}
        />
      </div>
    )
  }
  if (type === 'skills') return <SkillsEditor content={content} onChange={onChange} />
  const fields = ITEM_FIELDS[type] ?? []
  return (
    <ItemsEditor
      label="Elementos"
      fields={fields}
      items={(content.items as Obj[]) ?? []}
      titleOf={(i) => itemTitle(type, i)}
      newItem={() => emptyItem(type)}
      onChange={(items) => onChange({ ...content, items })}
    />
  )
}

function FieldGrid({ fields, value, onChange }: { fields: FieldDef[]; value: Obj; onChange: (v: Obj) => void }) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v })
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((f) => {
        const span = f.span === 2 ? 'md:col-span-2' : ''
        const current = value[f.key]
        if (f.kind === 'checkbox') {
          return (
            <div key={f.key} className={cn('flex items-end pb-2', span)}>
              <AuraCheckbox label={f.label} checked={Boolean(current)} onChange={(e) => set(f.key, e.target.checked)} />
            </div>
          )
        }
        if (f.kind === 'textarea' || f.kind === 'lines') {
          const text = f.kind === 'lines' ? ((current as string[]) ?? []).join('\n') : ((current as string) ?? '')
          return (
            <AuraTextarea
              key={f.key}
              className={span}
              label={f.label}
              rows={3}
              value={text}
              onChange={(e) => set(f.key, f.kind === 'lines' ? e.target.value.split('\n') : e.target.value)}
              onBlur={(e) => f.kind === 'lines' && set(f.key, e.target.value.split('\n').map((l) => l.trim()).filter(Boolean))}
            />
          )
        }
        if (f.kind === 'tags') {
          return (
            <div key={f.key} className={span}>
              <AuraTagInput label={f.label} value={(current as string[]) ?? []} onChange={(v) => set(f.key, v)} max={25} />
            </div>
          )
        }
        const disabled = f.key === 'end' && Boolean(value.current)
        return (
          <AuraInput
            key={f.key}
            className={span}
            label={f.label}
            type={f.kind === 'month' ? 'month' : 'text'}
            placeholder={f.placeholder}
            disabled={disabled}
            value={disabled ? '' : ((current as string) ?? '')}
            onChange={(e) => set(f.key, e.target.value)}
          />
        )
      })}
    </div>
  )
}

interface ItemsEditorProps {
  label: string
  fields: FieldDef[]
  items: Obj[]
  titleOf: (item: Obj) => string
  newItem: () => Obj
  onChange: (items: Obj[]) => void
}

function ItemsEditor({ label, fields, items, titleOf, newItem, onChange }: ItemsEditorProps) {
  const [open, setOpen] = useState<number | null>(items.length ? null : -1)
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    if (moved) next.splice(to, 0, moved)
    onChange(next)
    setOpen(to)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="hud-label text-graphite-400">{label}</p>
      {items.map((item, index) => (
        <div key={index} className="rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-1 px-3 py-2">
            <button
              type="button"
              className="flex-1 truncate text-left text-sm text-bone hover:text-aura-400"
              aria-expanded={open === index}
              onClick={() => setOpen(open === index ? null : index)}
            >
              {titleOf(item)}
            </button>
            <AuraButton variant="ghost" size="icon" aria-label="Subir" disabled={index === 0} onClick={() => move(index, index - 1)}>
              <ChevronUp className="h-4 w-4" />
            </AuraButton>
            <AuraButton
              variant="ghost"
              size="icon"
              aria-label="Bajar"
              disabled={index === items.length - 1}
              onClick={() => move(index, index + 1)}
            >
              <ChevronDown className="h-4 w-4" />
            </AuraButton>
            <AuraButton
              variant="ghost"
              size="icon"
              aria-label={`Quitar ${titleOf(item)}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </AuraButton>
          </div>
          {open === index && (
            <div className="border-t border-white/5 p-3">
              <FieldGrid fields={fields} value={item} onChange={(v) => onChange(items.map((it, i) => (i === index ? v : it)))} />
            </div>
          )}
        </div>
      ))}
      <AuraButton
        variant="ghost"
        size="sm"
        icon={Plus}
        className="self-start"
        onClick={() => {
          onChange([...items, newItem()])
          setOpen(items.length)
        }}
      >
        Agregar
      </AuraButton>
    </div>
  )
}

function SkillsEditor({ content, onChange }: { content: SectionContent; onChange: (c: SectionContent) => void }) {
  const groups = (content.groups as { category: string; skills: string[] }[]) ?? []
  const update = (next: typeof groups) => onChange({ ...content, groups: next })
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 md:grid-cols-[200px_1fr_auto]">
          <AuraInput
            label="Categoria"
            value={group.category}
            onChange={(e) => update(groups.map((g, i) => (i === index ? { ...g, category: e.target.value } : g)))}
          />
          <AuraTagInput
            label="Habilidades"
            value={group.skills}
            max={50}
            onChange={(skills) => update(groups.map((g, i) => (i === index ? { ...g, skills } : g)))}
          />
          <div className="flex items-end pb-1">
            <AuraButton variant="ghost" size="icon" aria-label={`Quitar grupo ${group.category}`} onClick={() => update(groups.filter((_, i) => i !== index))}>
              <Trash2 className="h-4 w-4" />
            </AuraButton>
          </div>
        </div>
      ))}
      <AuraButton variant="ghost" size="sm" icon={Plus} className="self-start" onClick={() => update([...groups, { category: '', skills: [] }])}>
        Agregar grupo
      </AuraButton>
    </div>
  )
}
