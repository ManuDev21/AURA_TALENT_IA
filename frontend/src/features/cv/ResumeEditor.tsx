import { useQuery } from '@tanstack/react-query'
import { Copy, Download, Eye, History, PenLine, Plus, Save, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cvApi, cvKeys } from '@/api/cv'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraConfirmButton } from '@/components/aura/AuraConfirmButton'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraSegmented } from '@/components/aura/AuraSegmented'
import { CvPreview } from '@/features/cv/CvPreview'
import { SectionCard } from '@/features/cv/SectionCard'
import {
  cleanContent,
  DEFAULT_TITLES,
  emptyContent,
  SECTION_LABELS,
  TARGET_LABELS,
  TEMPLATE_LABELS,
} from '@/features/cv/sectionSchema'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { toast } from '@/store/toastStore'
import type { ResumeDetail, ResumeSection, ResumeTarget, SectionType } from '@/types/cv'

const ADDABLE: SectionType[] = ['summary', 'experience', 'education', 'projects', 'skills', 'certifications', 'languages', 'links', 'custom']
const targetOptions = Object.entries(TARGET_LABELS).map(([value, label]) => ({ value, label }))

const toPayload = (sections: ResumeSection[]) =>
  sections.map((s) => ({
    section_type: s.section_type,
    title: s.title,
    is_visible: s.is_visible,
    content: cleanContent(s.section_type, s.content),
  }))

export function ResumeEditor({ resume, onDeleted }: { resume: ResumeDetail; onDeleted: () => void }) {
  const [draft, setDraft] = useState<ResumeSection[]>(resume.sections)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [versionNote, setVersionNote] = useState('')
  const [name, setName] = useState(resume.name)
  const dirty = useMemo(() => JSON.stringify(toPayload(draft)) !== JSON.stringify(toPayload(resume.sections)), [draft, resume.sections])
  const invalidate = [cvKeys.resumes, cvKeys.resume(resume.id), cvKeys.versions(resume.id)]

  const save = useAuraMutation({ mutationFn: () => cvApi.saveSections(resume.id, toPayload(draft)), invalidate, success: 'CV guardado.' })
  const meta = useAuraMutation({
    mutationFn: (data: Parameters<typeof cvApi.update>[1]) => cvApi.update(resume.id, data),
    invalidate,
    success: 'CV actualizado.',
  })
  const sync = useAuraMutation({
    mutationFn: (sectionId: string) => cvApi.syncSection(resume.id, sectionId),
    invalidate,
    success: 'Seccion actualizada con los datos de tu perfil.',
  })
  const version = useAuraMutation({
    mutationFn: () => cvApi.saveVersion(resume.id, versionNote || null),
    invalidate,
    success: (r) => `Version guardada. Ahora editas la v${r.version_no}.`,
    onSuccess: () => setVersionNote(''),
  })
  const duplicate = useAuraMutation({ mutationFn: () => cvApi.duplicate(resume.id, {}), invalidate: [cvKeys.resumes], success: 'CV duplicado.' })
  const remove = useAuraMutation({ mutationFn: () => cvApi.remove(resume.id), invalidate: [cvKeys.resumes], success: 'CV eliminado.', onSuccess: onDeleted })
  const [exporting, setExporting] = useState(false)

  const exportPdf = async () => {
    setExporting(true)
    try {
      if (dirty) await save.mutateAsync()
      await cvApi.exportPdf(resume.id, resume.name)
      toast.success('PDF generado.')
    } catch {
      toast.error('No fue posible generar el PDF.')
    } finally {
      setExporting(false)
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.length || from === to) return
    const next = [...draft]
    const [moved] = next.splice(from, 1)
    if (moved) next.splice(to, 0, moved)
    setDraft(next)
  }

  const missing = ADDABLE.filter((t) => t === 'custom' || !draft.some((s) => s.section_type === t))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <AuraInput
          label="Nombre del CV"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== resume.name && meta.mutate({ name: name.trim() })}
        />
        <AuraSelect label="Enfoque" options={targetOptions} value={resume.target} onChange={(e) => meta.mutate({ target: e.target.value as ResumeTarget })} />
        <div className="flex flex-col gap-1.5">
          <span className="hud-label text-graphite-300">Plantilla</span>
          <AuraSegmented
            label="Plantilla"
            value={resume.template}
            onChange={(template) => meta.mutate({ template })}
            options={[
              { value: 'aura-classic', label: TEMPLATE_LABELS['aura-classic'] },
              { value: 'aura-modern', label: TEMPLATE_LABELS['aura-modern'] },
              { value: 'harvard', label: TEMPLATE_LABELS.harvard },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AuraBadge tone="neutral">v{resume.version_no}</AuraBadge>
        {dirty && <AuraBadge tone="warning">Cambios sin guardar</AuraBadge>}
        <div className="ml-auto flex flex-wrap gap-2">
          <AuraButton size="sm" icon={Save} loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
            Guardar
          </AuraButton>
          <AuraButton size="sm" variant="neo" icon={Download} loading={exporting} onClick={() => void exportPdf()}>
            PDF
          </AuraButton>
          <AuraButton size="sm" variant="neo" icon={History} aria-expanded={showVersions} onClick={() => setShowVersions((v) => !v)}>
            Versiones
          </AuraButton>
          <AuraButton size="sm" variant="ghost" icon={Copy} loading={duplicate.isPending} onClick={() => duplicate.mutate()}>
            Duplicar
          </AuraButton>
          {!resume.is_default && (
            <AuraButton size="sm" variant="ghost" icon={Star} onClick={() => meta.mutate({ is_default: true })}>
              Predeterminado
            </AuraButton>
          )}
          <AuraConfirmButton label={`Eliminar ${resume.name}`} loading={remove.isPending} onConfirm={() => remove.mutate()} />
        </div>
      </div>

      {showVersions && (
        <VersionsPanel
          resumeId={resume.id}
          note={versionNote}
          onNote={setVersionNote}
          saving={version.isPending}
          disabled={dirty}
          onSave={() => version.mutate()}
        />
      )}

      <AuraSegmented
        label="Modo"
        value={view}
        onChange={setView}
        options={[
          { value: 'edit', label: 'Editor', icon: PenLine },
          { value: 'preview', label: 'Vista previa', icon: Eye },
        ]}
      />

      {view === 'preview' ? (
        <div className="neo-inset overflow-x-auto rounded-2xl p-4">
          <CvPreview sections={draft} template={resume.template} />
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label="Secciones del CV">
            {draft.map((section, index) => (
              <SectionCard
                key={section.id ?? `new-${index}`}
                section={section}
                index={index}
                total={draft.length}
                dragging={dragIndex === index}
                syncing={sync.isPending && sync.variables === section.id}
                onChange={(next) => setDraft(draft.map((s, i) => (i === index ? next : s)))}
                onMove={(to) => move(index, to)}
                onRemove={() => setDraft(draft.filter((_, i) => i !== index))}
                onSync={
                  section.id && section.section_type !== 'custom' && !dirty ? () => sync.mutate(section.id as string) : null
                }
                dragHandlers={{
                  onDragStart: () => setDragIndex(index),
                  onDragOver: (e) => e.preventDefault(),
                  onDrop: () => {
                    if (dragIndex !== null) move(dragIndex, index)
                    setDragIndex(null)
                  },
                  onDragEnd: () => setDragIndex(null),
                }}
              />
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hud-label text-graphite-400">Agregar seccion:</span>
            {missing.map((type) => (
              <AuraButton
                key={type}
                size="sm"
                variant="ghost"
                icon={Plus}
                onClick={() =>
                  setDraft([...draft, { section_type: type, title: DEFAULT_TITLES[type], is_visible: true, content: emptyContent(type) }])
                }
              >
                {SECTION_LABELS[type]}
              </AuraButton>
            ))}
          </div>
        </>
      )}
      <p className="text-xs text-graphite-400">
        Cada CV guarda su propio contenido. Usa el boton de sincronizar de una seccion para traer los datos actuales de tu perfil; AURA
        nunca agrega informacion que no hayas registrado.
      </p>
    </div>
  )
}

interface VersionsPanelProps {
  resumeId: string
  note: string
  onNote: (v: string) => void
  saving: boolean
  disabled: boolean
  onSave: () => void
}

function VersionsPanel({ resumeId, note, onNote, saving, disabled, onSave }: VersionsPanelProps) {
  const { data = [] } = useQuery({ queryKey: cvKeys.versions(resumeId), queryFn: () => cvApi.versions(resumeId) })
  const restore = useAuraMutation({
    mutationFn: (versionId: string) => cvApi.restore(resumeId, versionId),
    invalidate: [cvKeys.resumes, cvKeys.resume(resumeId), cvKeys.versions(resumeId)],
    success: (r) => `Version restaurada como v${r.version_no}.`,
  })

  return (
    <section aria-label="Versiones" className="neo-inset flex flex-col gap-3 rounded-xl p-4">
      <div className="flex items-end gap-2">
        <AuraInput className="flex-1" label="Nota de la version" placeholder="Ej. Enviado a Acme" value={note} onChange={(e) => onNote(e.target.value)} />
        <AuraButton size="md" icon={Save} loading={saving} disabled={disabled} onClick={onSave} title={disabled ? 'Guarda los cambios primero' : undefined}>
          Guardar version
        </AuraButton>
      </div>
      <ul className="flex flex-col gap-1.5">
        {data.map((v) => (
          <li key={v.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
            <span className="font-mono text-aura-400">v{v.version_no}</span>
            <span className="flex-1 truncate text-graphite-300">{v.note ?? 'Sin nota'}</span>
            <span className="text-xs text-graphite-400">{new Date(v.created_at).toLocaleDateString('es')}</span>
            {v.is_current ? (
              <AuraBadge tone="aura">Actual</AuraBadge>
            ) : (
              <AuraButton size="sm" variant="ghost" loading={restore.isPending && restore.variables === v.id} onClick={() => restore.mutate(v.id)}>
                Restaurar
              </AuraButton>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
