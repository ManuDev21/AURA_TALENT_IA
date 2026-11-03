import { useQuery } from '@tanstack/react-query'
import { CircleCheck, FileUp, ScanSearch, ShieldCheck, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import { type DragEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { cvApi, cvKeys } from '@/api/cv'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { FormAlert } from '@/features/auth/FormAlert'
import { CvFormatDiagnostics, CvReview } from '@/features/cv/CvReview'
import { useCandidateOverview } from '@/features/talent/useProfileData'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { useAuraStore } from '@/store/auraStore'
import type { ConfirmResult, CvDocument } from '@/types/cv'
import { cn } from '@/utils/cn'

const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function CvAnalyzer() {
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [result, setResult] = useState<ConfirmResult | null>(null)
  const [previewProfileCv, setPreviewProfileCv] = useState(false)
  const { data: history = [] } = useQuery({ queryKey: cvKeys.documents, queryFn: cvApi.documents })
  const { data: profile } = useCandidateOverview()

  const { data: doc } = useQuery({
    queryKey: cvKeys.document(documentId ?? ''),
    queryFn: () => cvApi.document(documentId as string),
    enabled: !!documentId,
    refetchInterval: (query) => {
      const status = query.state.data?.parse_status
      return status === 'pending' || status === 'processing' ? 1200 : false
    },
  })

  const upload = useAuraMutation({
    mutationFn: (file: File) => cvApi.upload(file),
    invalidate: [cvKeys.documents],
    onSuccess: (d) => {
      setResult(null)
      setDocumentId(d.id)
    },
  })

  const analyzing = doc && (doc.parse_status === 'pending' || doc.parse_status === 'processing')
  const status = doc?.parse_status

  useEffect(() => {
    const aura = useAuraStore.getState()
    if (status === 'pending' || status === 'processing') aura.setCoreState('ANALYZING')
    else if (status === 'done' && aura.coreState === 'ANALYZING') aura.pulse('SUCCESS')
    else if (status === 'failed') aura.pulse('ERROR')
  }, [status])

  const syntheticProfileDoc: CvDocument | null = profile
    ? {
        id: 'profile-diagnostic',
        original_filename: `CV-${(profile.profile.headline || 'Candidato-AURA').slice(0, 28).replace(/\s+/g, '-')}.pdf`,
        mime_type: 'application/pdf',
        size_bytes: 184320,
        parse_status: 'done',
        parse_error: null,
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        parsed_data: {
          fields: {
            full_name: { value: 'Candidato AURA', confidence: 0.98, evidence: 'Perfil activo' },
            email: { value: 'contacto@aura.talent', confidence: 0.98, evidence: 'Perfil activo' },
            phone: { value: '+52 55 0000 0000', confidence: 0.9, evidence: 'Perfil activo' },
            ...(profile.profile.headline
              ? { headline: { value: profile.profile.headline, confidence: 0.95, evidence: profile.profile.headline } }
              : {}),
            ...(profile.profile.summary
              ? { summary: { value: profile.profile.summary, confidence: 0.95, evidence: profile.profile.summary } }
              : {}),
          },
          links: profile.links.map((l) => ({
            link_type: l.link_type,
            url: l.url,
            confidence: 0.95,
            evidence: l.url,
          })),
          experiences: profile.experiences.map((e) => ({
            title: e.title,
            company_name: e.company_name,
            start_date: e.start_date,
            end_date: e.end_date,
            is_current: e.is_current,
            description: e.description,
            achievements: e.achievements ?? [],
            confidence: 0.92,
            evidence: e.title,
          })),
          education: profile.education.map((ed) => ({
            institution: ed.institution,
            degree: ed.degree,
            level: ed.level,
            start_date: ed.start_date,
            end_date: ed.end_date,
            is_current: ed.is_current,
            confidence: 0.92,
            evidence: ed.institution,
          })),
          skills: profile.skills.map((s) => ({
            skill_id: s.skill.id,
            name: s.skill.name,
            category: s.skill.category?.name ?? null,
            matched: s.skill.name,
            confidence: 0.95,
            evidence: s.skill.name,
          })),
          languages: profile.languages.map((l) => ({
            language_code: l.language_code,
            level: l.level,
            confidence: 0.92,
            evidence: l.language_code,
          })),
          certifications: profile.certifications.map((c) => ({
            name: c.name,
            issuer: c.issuer,
            confidence: 0.9,
            evidence: c.name,
          })),
          sections_found: [
            'Contacto',
            ...(profile.profile.summary ? ['Resumen'] : []),
            ...(profile.experiences.length ? ['Experiencia'] : []),
            ...(profile.education.length ? ['Educacion'] : []),
            ...(profile.skills.length ? ['Habilidades'] : []),
            ...(profile.languages.length ? ['Idiomas'] : []),
          ],
          warnings: [],
          stats: {
            characters:
              (profile.profile.summary?.length ?? 180) +
              profile.experiences.reduce((acc, e) => acc + (e.description?.length ?? 160), 0) +
              profile.skills.length * 24 +
              420,
            pages: 1,
            lines: Math.max(18, profile.experiences.length * 6 + profile.skills.length + 12),
          },
        },
      }
    : null

  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-start gap-2 rounded-xl border border-aura-500/20 bg-aura-500/[0.05] p-3.5 text-xs leading-relaxed text-graphite-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
        Carga tu CV en PDF o DOCX para obtener un diagnostico completo de formato ATS, estadisticas de legibilidad, densidad de logros y recomendaciones clave para destacar en el proceso de seleccion.
      </p>

      {previewProfileCv && syntheticProfileDoc?.parsed_data ? (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <AuraButton size="sm" variant="neo" onClick={() => setPreviewProfileCv(false)}>
              Subir otro archivo PDF / DOCX
            </AuraButton>
          </div>
          <CvFormatDiagnostics document={syntheticProfileDoc} parsed={syntheticProfileDoc.parsed_data} />
        </div>
      ) : result ? (
        <ConfirmSummary result={result} onReset={() => setDocumentId(null)} />
      ) : doc?.parse_status === 'done' && doc.parsed_data ? (
        <CvReview document={doc} onConfirmed={setResult} onCancel={() => setDocumentId(null)} />
      ) : analyzing ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <AuraLoader label="Analizando formato, estructura ATS y competencias del documento" />
          <p className="text-xs text-graphite-400">{doc.original_filename}</p>
        </div>
      ) : (
        <>
          {doc?.parse_status === 'failed' && <FormAlert message={doc.parse_error ?? 'No fue posible analizar el documento.'} />}
          <Dropzone
            loading={upload.isPending}
            onFile={(f) => upload.mutate(f)}
            onAnalyzeProfile={syntheticProfileDoc ? () => setPreviewProfileCv(true) : undefined}
          />
        </>
      )}

      {history.length > 0 && !analyzing && !previewProfileCv && !(doc?.parse_status === 'done' && !result) && (
        <DocumentHistory documents={history} onOpen={(id) => { setResult(null); setDocumentId(id) }} />
      )}
    </div>
  )
}

function Dropzone({
  loading,
  onFile,
  onAnalyzeProfile,
}: {
  loading: boolean
  onFile: (file: File) => void
  onAnalyzeProfile?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState('')

  const accept = (file: File | undefined) => {
    setError('')
    if (!file) return
    if (!/\.(pdf|docx)$/i.test(file.name)) return setError('Solo se aceptan archivos PDF o DOCX.')
    if (file.size > 5 * 1024 * 1024) return setError('El archivo supera el limite de 5 MB.')
    onFile(file)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    accept(event.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          'card-3d card-shimmer flex flex-col items-center gap-4 border-2 border-dashed px-6 py-10 text-center transition',
          over ? 'border-aura-500 bg-aura-500/10' : 'border-white/10',
        )}
      >
        <div className="icon-orb-3d flex h-14 w-14 items-center justify-center rounded-2xl text-aura-400">
          <ScanSearch className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <p className="font-display text-base font-bold text-bone">
            Arrastra tu CV aqui para Analizar su Formato y Efectividad ATS
          </p>
          <p className="mt-1 text-xs text-graphite-300">
            Acepta archivos PDF con texto seleccionable o Word (.DOCX) de hasta 5 MB
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <AuraButton icon={FileUp} loading={loading} onClick={() => input.current?.click()}>
            Cargar archivo de CV (PDF / DOCX)
          </AuraButton>
          {onAnalyzeProfile && (
            <AuraButton variant="neo" icon={Sparkles} onClick={onAnalyzeProfile}>
              Diagnosticar mi CV / Perfil actual
            </AuraButton>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label="Subir CV"
          onChange={(e) => {
            accept(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      <FormAlert message={error} />
    </div>
  )
}

function DocumentHistory({ documents, onOpen }: { documents: CvDocument[]; onOpen: (id: string) => void }) {
  const remove = useAuraMutation({
    mutationFn: (id: string) => cvApi.removeDocument(id),
    invalidate: [cvKeys.documents],
    success: 'Documento eliminado de AURA.',
  })
  return (
    <section aria-label="Documentos analizados" className="flex flex-col gap-2">
      <h3 className="hud-label text-graphite-300">Documentos analizados</h3>
      <ul className="flex flex-col gap-1.5">
        {documents.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
            <button type="button" className="flex-1 truncate text-left hover:text-aura-400" onClick={() => onOpen(d.id)}>
              {d.original_filename}
            </button>
            {d.confirmed_at ? (
              <AuraBadge tone="success">Guardado</AuraBadge>
            ) : d.parse_status === 'failed' ? (
              <AuraBadge tone="danger">Error</AuraBadge>
            ) : (
              <AuraBadge tone="neutral">Por revisar</AuraBadge>
            )}
            <AuraButton variant="ghost" size="icon" aria-label={`Eliminar ${d.original_filename}`} onClick={() => remove.mutate(d.id)}>
              <Trash2 className="h-4 w-4" />
            </AuraButton>
          </li>
        ))}
      </ul>
      <p className="text-[0.7rem] text-graphite-400">Eliminar un documento borra el archivo y los datos detectados.</p>
    </section>
  )
}

const RESULT_LABELS: Record<string, string> = {
  experiences: 'experiencias',
  education: 'estudios',
  certifications: 'certificaciones',
  languages: 'idiomas',
  links: 'enlaces',
  skills: 'habilidades',
}

function ConfirmSummary({ result, onReset }: { result: ConfirmResult; onReset: () => void }) {
  const created = Object.entries(result.created).filter(([, n]) => n > 0)
  const skipped = Object.entries(result.skipped).filter(([, n]) => n > 0)
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <CircleCheck className="h-10 w-10 text-success" aria-hidden="true" />
      <p className="font-display text-lg">Datos guardados en tu perfil</p>
      <p className="text-sm text-graphite-300">
        {created.length ? created.map(([k, n]) => `${n} ${RESULT_LABELS[k]}`).join(', ') : 'No se agregaron elementos nuevos.'}
      </p>
      {skipped.length > 0 && (
        <p className="flex items-center gap-1 text-xs text-graphite-400">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Omitidos por estar repetidos: {skipped.map(([k, n]) => `${n} ${RESULT_LABELS[k]}`).join(', ')}
        </p>
      )}
      <div className="flex gap-2">
        <Link to="/candidate/profile" className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-aura-400 hover:bg-white/5">
          Ver mi perfil
        </Link>
        <AuraButton size="sm" variant="neo" onClick={onReset}>
          Analizar otro CV
        </AuraButton>
      </div>
    </div>
  )
}
