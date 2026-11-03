import { useQuery } from '@tanstack/react-query'
import { Copy, Eye, FileJson, FlaskConical, Rocket, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { ApiError } from '@/api/client'
import { assessmentKeys, instrumentsApi } from '@/api/assessments'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraTextarea } from '@/components/aura/AuraField'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { FormAlert } from '@/features/auth/FormAlert'
import { TYPE_LABELS } from '@/features/assessments/AssessmentsModule'
import { useAuraMutation } from '@/hooks/useAuraMutation'

const STATUS_TONE = { draft: 'neutral', published: 'success', retired: 'warning' } as const
const STATUS_LABEL = { draft: 'Borrador', published: 'Publicada', retired: 'Retirada' } as const

/** Instrumentos y versiones. Una version publicada es inmutable: para cambiarla se clona. */
export function InstrumentsPanel() {
  const { data, isPending } = useQuery({ queryKey: assessmentKeys.instruments, queryFn: instrumentsApi.list })
  const [viewing, setViewing] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const action = useAuraMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'retire' | 'clone' }) => instrumentsApi.action(id, action),
    invalidate: [assessmentKeys.instruments, assessmentKeys.catalog],
    success: 'Instrumento actualizado.',
  })

  return (
    <AuraPanel
      eyebrow="Psychometric Center"
      title="Instrumentos"
      actions={
        !importing ? (
          <AuraButton variant="neo" size="sm" icon={Upload} className="mr-10" onClick={() => setImporting(true)}>
            Importar
          </AuraButton>
        ) : undefined
      }
    >
      <p className="mb-4 text-xs text-graphite-400">
        Solo se admiten instrumentos originales marcados como experimentales o instrumentos con licencia vigente. Ninguno se
        presenta como prueba clinica.
      </p>
      {importing && <ImportForm onDone={() => setImporting(false)} />}
      {viewing && <VersionViewer versionId={viewing} onClose={() => setViewing(null)} />}
      {isPending ? (
        <div className="flex justify-center py-10">
          <AuraLoader label="Cargando instrumentos" />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data?.map((inst) => (
            <li key={inst.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 font-medium text-bone">{inst.title}</p>
                <AuraBadge tone="neutral">{TYPE_LABELS[inst.type_code] ?? inst.type_code}</AuraBadge>
                {inst.is_experimental && (
                  <AuraBadge tone="warning">
                    <FlaskConical className="h-3 w-3" aria-hidden="true" /> Experimental
                  </AuraBadge>
                )}
              </div>
              <p className="font-mono text-[0.65rem] text-graphite-400">{inst.code} / licencia: {inst.license_type}</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {inst.versions.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="font-mono text-aura-400">v{v.version_no}</span>
                    <AuraBadge tone={STATUS_TONE[v.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                      {STATUS_LABEL[v.status as keyof typeof STATUS_LABEL] ?? v.status}
                    </AuraBadge>
                    <span className="flex-1 text-xs text-graphite-400">
                      {v.question_count} preguntas / {v.attempts} intentos
                    </span>
                    <AuraButton size="sm" variant="ghost" icon={Eye} onClick={() => setViewing(v.id)}>
                      Ver
                    </AuraButton>
                    {v.status === 'draft' && (
                      <AuraButton size="sm" variant="neo" icon={Rocket} onClick={() => action.mutate({ id: v.id, action: 'publish' })}>
                        Publicar
                      </AuraButton>
                    )}
                    {v.status === 'published' && (
                      <>
                        <AuraButton size="sm" variant="ghost" icon={Copy} onClick={() => action.mutate({ id: v.id, action: 'clone' })}>
                          Nueva version
                        </AuraButton>
                        <AuraButton size="sm" variant="ghost" onClick={() => action.mutate({ id: v.id, action: 'retire' })}>
                          Retirar
                        </AuraButton>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </AuraPanel>
  )
}

function VersionViewer({ versionId, onClose }: { versionId: string; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ['psychometrics', 'version', versionId], queryFn: () => instrumentsApi.detail(versionId) })
  return (
    <section aria-label="Definicion de la version" className="neo-inset mb-4 rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="hud-label flex items-center gap-1.5 text-aura-400">
          <FileJson className="h-3.5 w-3.5" aria-hidden="true" /> Definicion
        </span>
        <AuraButton variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}>
          <X className="h-4 w-4" />
        </AuraButton>
      </div>
      <pre className="max-h-80 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[0.65rem] leading-relaxed text-graphite-300">
        {data ? JSON.stringify(data, null, 2) : 'Cargando...'}
      </pre>
    </section>
  )
}

const TEMPLATE = JSON.stringify(
  {
    code: 'MI-INSTRUMENTO-01',
    title: 'Nombre del instrumento',
    type_code: 'logical',
    is_experimental: true,
    version: {
      instructions: 'Instrucciones para la persona.',
      questions: [{ question_type: 'multiple_choice', stem: 'Pregunta', options: [{ label: 'Correcta', is_correct: true }, { label: 'Incorrecta', is_correct: false }] }],
      scoring: [{ method: 'correct_count' }],
      interpretation: [{ min_score: 0, max_score: 100, band: 'moderate', text_template: 'Interpretacion' }],
    },
  },
  null,
  2,
)

function ImportForm({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState(TEMPLATE)
  const [error, setError] = useState('')
  const save = useAuraMutation({
    mutationFn: (definition: unknown) => instrumentsApi.importDefinition(definition),
    invalidate: [assessmentKeys.instruments],
    success: 'Instrumento importado como borrador.',
    silentError: true,
    onSuccess: onDone,
  })
  const submit = async () => {
    setError('')
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setError('El JSON no es valido.')
      return
    }
    try {
      await save.mutateAsync(parsed)
    } catch (err) {
      if (err instanceof ApiError) {
        setError([err.message, ...err.fieldErrors.map((f) => `${f.field}: ${f.message}`)].join(' / '))
      }
    }
  }
  return (
    <div className="neo-inset mb-4 flex flex-col gap-3 rounded-xl p-4">
      <AuraTextarea label="Definicion (JSON)" rows={14} value={text} onChange={(e) => setText(e.target.value)} className="font-mono" />
      <FormAlert message={error} />
      <div className="flex justify-end gap-2">
        <AuraButton variant="ghost" size="sm" onClick={onDone}>
          Cancelar
        </AuraButton>
        <AuraButton size="sm" icon={Upload} loading={save.isPending} onClick={() => void submit()}>
          Importar como borrador
        </AuraButton>
      </div>
    </div>
  )
}
