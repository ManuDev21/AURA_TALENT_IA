import { useQuery } from '@tanstack/react-query'
import { Cpu, FilePlus2, FileSearch, FileText, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cvApi, cvKeys } from '@/api/cv'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraTabs } from '@/components/aura/AuraTabs'
import { OllamaStudioPanel } from '@/features/ai/OllamaStudioPanel'
import { CvAnalyzer } from '@/features/cv/CvAnalyzer'
import { ResumeEditor } from '@/features/cv/ResumeEditor'
import { TARGET_LABELS, TEMPLATE_LABELS } from '@/features/cv/sectionSchema'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import type { ResumeTarget, ResumeTemplate } from '@/types/cv'
import { cn } from '@/utils/cn'

export function CvModule() {
  const [tab, setTab] = useState<'resumes' | 'analyzer' | 'ollama'>('resumes')
  return (
    <AuraPanel eyebrow="CV Workspace" title="Curriculum" className="flex flex-col gap-5">
      <AuraTabs
        label="Herramientas de CV"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'resumes', label: 'Constructor de CV', icon: FileText },
          { id: 'analyzer', label: 'Cargar CV y Diagnostico ATS', icon: FileSearch },
          { id: 'ollama', label: 'Asistente de escritura', icon: Cpu },
        ]}
      />
      {tab === 'resumes' ? <ResumesWorkspace /> : tab === 'analyzer' ? <CvAnalyzer /> : <OllamaStudioPanel />}
    </AuraPanel>
  )
}

function ResumesWorkspace() {
  const { data: resumes, isPending } = useQuery({ queryKey: cvKeys.resumes, queryFn: cvApi.list })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!resumes) return
    if (!selectedId || !resumes.some((r) => r.id === selectedId)) {
      setSelectedId(resumes.find((r) => r.is_default)?.id ?? resumes[0]?.id ?? null)
    }
  }, [resumes, selectedId])

  const { data: resume } = useQuery({
    queryKey: cvKeys.resume(selectedId ?? ''),
    queryFn: () => cvApi.get(selectedId as string),
    enabled: !!selectedId,
  })

  if (isPending) {
    return (
      <div className="flex justify-center py-12">
        <AuraLoader label="Cargando tus CV" />
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <aside aria-label="Tus CV" className="flex flex-col gap-2">
        {resumes?.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              setSelectedId(r.id)
              setCreating(false)
            }}
            aria-current={r.id === selectedId}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition',
              r.id === selectedId && !creating
                ? 'border-aura-500/50 bg-aura-500/10'
                : 'border-white/5 bg-white/[0.02] hover:border-aura-500/25',
            )}
          >
            <span className="flex w-full items-center gap-1.5 text-sm text-bone">
              <span className="truncate">{r.name}</span>
              {r.is_default && <Star className="h-3 w-3 shrink-0 fill-aura-500 text-aura-500" aria-label="Predeterminado" />}
            </span>
            <span className="hud-label text-[0.55rem] text-graphite-400">
              {TARGET_LABELS[r.target]} / v{r.version_no}
            </span>
          </button>
        ))}
        <AuraButton variant="neo" size="sm" icon={FilePlus2} onClick={() => setCreating(true)}>
          Nuevo CV
        </AuraButton>
      </aside>

      <div className="min-w-0">
        {creating || !resumes?.length ? (
          resumes?.length || creating ? (
            <CreateResumeForm
              onCreated={(id) => {
                setSelectedId(id)
                setCreating(false)
              }}
              onCancel={resumes?.length ? () => setCreating(false) : undefined}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <AuraEmptyState icon={FileText} title="Aun no tienes CV">
                AURA arma tu primer CV con los datos de tu perfil. Despues puedes crear versiones por enfoque.
              </AuraEmptyState>
              <CreateResumeForm onCreated={setSelectedId} />
            </div>
          )
        ) : resume ? (
          <ResumeEditor key={`${resume.id}-${resume.version_no}-${resume.updated_at}`} resume={resume} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="flex justify-center py-12">
            <AuraLoader label="Abriendo CV" />
          </div>
        )}
      </div>
    </div>
  )
}

function CreateResumeForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel?: () => void }) {
  const [name, setName] = useState('CV General')
  const [target, setTarget] = useState<ResumeTarget>('general')
  const [template, setTemplate] = useState<ResumeTemplate>('harvard')
  const create = useAuraMutation({
    mutationFn: () => cvApi.create({ name: name.trim() || 'Mi CV', target, template }),
    invalidate: [cvKeys.resumes],
    success: 'CV creado a partir de tu perfil.',
    onSuccess: (r) => onCreated(r.id),
  })

  return (
    <form
      className="neo-inset grid gap-3 rounded-xl p-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate()
      }}
    >
      <AuraInput label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
      <AuraSelect
        label="Enfoque"
        options={Object.entries(TARGET_LABELS).map(([value, label]) => ({ value, label }))}
        value={target}
        onChange={(e) => {
          const next = e.target.value as ResumeTarget
          setTarget(next)
          setName(`CV ${TARGET_LABELS[next]}`)
        }}
      />
      <AuraSelect
        label="Diseno"
        options={Object.entries(TEMPLATE_LABELS).map(([value, label]) => ({ value, label }))}
        value={template}
        onChange={(e) => setTemplate(e.target.value as ResumeTemplate)}
      />
      <p className="text-xs text-graphite-400 md:col-span-2">
        El enfoque ordena las secciones y prioriza las habilidades relevantes. El diseno Harvard es el formato clasico que mejor leen los
        sistemas de las empresas. Solo se usan datos de tu perfil.
      </p>
      <div className="flex justify-end gap-2 md:col-span-2">
        {onCancel && (
          <AuraButton variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </AuraButton>
        )}
        <AuraButton type="submit" size="sm" icon={FilePlus2} loading={create.isPending}>
          Crear CV
        </AuraButton>
      </div>
    </form>
  )
}
