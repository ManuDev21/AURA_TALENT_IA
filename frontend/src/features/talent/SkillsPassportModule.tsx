import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Download, ExternalLink, FileBadge, FileJson, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { passportApi, passportKeys } from '@/api/passport'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraSelect, AuraTextarea } from '@/components/aura/AuraField'
import { useCandidateOverview } from '@/features/talent/useProfileData'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import type { SkillEvidence } from '@/types/talent'

const TYPES: { value: SkillEvidence['evidence_type']; label: string }[] = [
  { value: 'project', label: 'Proyecto' },
  { value: 'credential', label: 'Credencial' },
  { value: 'certificate', label: 'Certificado' },
  { value: 'work_sample', label: 'Muestra de trabajo' },
  { value: 'other', label: 'Otra evidencia' },
]

export function SkillsPassportModule() {
  const { data: profile } = useCandidateOverview()
  const { data: evidence = [] } = useQuery({ queryKey: passportKeys.evidence, queryFn: passportApi.list })
  const [skillId, setSkillId] = useState('')
  const [type, setType] = useState<SkillEvidence['evidence_type']>('project')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [issuer, setIssuer] = useState('')
  const [share, setShare] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const invalidate = [passportKeys.evidence]
  const add = useAuraMutation({
    mutationFn: passportApi.add,
    invalidate,
    success: 'Evidencia agregada. Se mostrará como aportada por ti, no como verificada.',
    onSuccess: () => { setTitle(''); setDescription(''); setUrl(''); setIssuer(''); setShare(false); setError('') },
  })
  const importBadge = useAuraMutation({
    mutationFn: passportApi.importBadge,
    invalidate,
    success: 'Registro importado. AURA no ha verificado la firma ni la identidad del emisor.',
    onSuccess: () => setError(''),
  })
  const toggleShare = useAuraMutation({ mutationFn: ({ id, value }: { id: string; value: boolean }) => passportApi.share(id, value), invalidate })
  const remove = useAuraMutation({ mutationFn: passportApi.remove, invalidate, success: 'Evidencia eliminada.' })

  const onBadgeFile = async (file?: File) => {
    if (!file) return
    setError('')
    if (!skillId) return setError('Selecciona primero la habilidad a la que corresponde la credencial.')
    if (file.size > 1_000_000) return setError('El archivo supera el límite de 1 MB.')
    try {
      const raw: unknown = JSON.parse(await file.text())
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('El JSON debe contener un objeto de credencial.')
      const badge = raw as Record<string, unknown>
      const subject = (badge.credentialSubject && typeof badge.credentialSubject === 'object' ? badge.credentialSubject : {}) as Record<string, unknown>
      const achievement = (subject.achievement && typeof subject.achievement === 'object' ? subject.achievement : {}) as Record<string, unknown>
      const issuerValue = badge.issuer
      const issuerName = typeof issuerValue === 'string' ? issuerValue : issuerValue && typeof issuerValue === 'object' ? String((issuerValue as Record<string, unknown>).name ?? '') : ''
      const credentialTitle = String(achievement.name ?? badge.name ?? subject.name ?? '').trim()
      if (!credentialTitle) throw new Error('No encontré el nombre de la insignia en el JSON.')
      const credentialUrl = typeof badge.id === 'string' && badge.id.startsWith('https://') ? badge.id : null
      const evidenceUrl = typeof achievement.id === 'string' && achievement.id.startsWith('https://') ? achievement.id : null
      await importBadge.mutateAsync({
        skill_id: skillId,
        credential_title: credentialTitle,
        issuer: issuerName || null,
        credential_ref: typeof badge.id === 'string' ? badge.id.slice(0, 300) : null,
        credential_url: credentialUrl,
        evidence_url: evidenceUrl,
        description: typeof achievement.description === 'string' ? achievement.description.slice(0, 2000) : null,
        share_with_companies: false,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo leer la credencial.')
    }
  }

  return (
    <AuraPanel eyebrow="Evidencia" title="Pasaporte de habilidades" className="flex flex-col gap-4">
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-graphite-300">
        <p className="flex items-center gap-2 font-medium text-warning"><ShieldAlert className="h-4 w-4" aria-hidden="true" />AURA no verifica automáticamente la autenticidad</p>
        <p className="mt-1">Las habilidades son autodeclaradas y los enlaces o insignias importados son evidencia aportada por ti. Nunca se etiquetan como verificados por AURA.</p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4" aria-label="Agregar evidencia de habilidad">
        <h3 className="hud-label text-aura-400">Agregar evidencia</h3>
        <AuraSelect label="Habilidad de tu perfil" placeholder="Selecciona una habilidad" value={skillId} onChange={(e) => setSkillId(e.target.value)} options={(profile?.skills ?? []).map((item) => ({ value: item.skill.id, label: item.skill.name }))} />
        <AuraSelect label="Tipo de evidencia" value={type} onChange={(e) => setType(e.target.value as SkillEvidence['evidence_type'])} options={TYPES} />
        <AuraInput label="Título" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <AuraTextarea label="Qué demuestra (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} />
        <AuraInput label="Enlace a la evidencia (opcional)" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        {(type === 'credential' || type === 'certificate') && <AuraInput label="Emisor declarado" value={issuer} onChange={(e) => setIssuer(e.target.value)} maxLength={200} />}
        <AuraCheckbox label="Compartir esta evidencia con las empresas a las que me postule" checked={share} onChange={(e) => setShare(e.target.checked)} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AuraButton variant="neo" icon={FileBadge} loading={importBadge.isPending} disabled={!skillId} onClick={() => fileRef.current?.click()}>Importar JSON de insignia</AuraButton>
          <input ref={fileRef} className="sr-only" type="file" accept="application/json,.json" onChange={(e) => { void onBadgeFile(e.target.files?.[0]); e.currentTarget.value = '' }} />
          <AuraButton icon={Plus} loading={add.isPending} disabled={!skillId || title.trim().length < 2} onClick={() => add.mutate({
            skill_id: skillId,
            evidence_type: type,
            title: title.trim(),
            description: description.trim() || null,
            evidence_url: url.trim() || null,
            issuer: issuer.trim() || null,
            credential_ref: null,
            share_with_companies: share,
          })}>Guardar evidencia</AuraButton>
        </div>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </section>

      <section className="flex flex-col gap-3" aria-label="Mis evidencias">
        <div className="flex items-center justify-between gap-2">
          <h3 className="hud-label text-aura-400">Mis evidencias ({evidence.length})</h3>
          <AuraButton variant="ghost" size="sm" icon={Download} onClick={() => void passportApi.export()}>Descargar pasaporte JSON</AuraButton>
        </div>
        {!evidence.length ? <AuraEmptyState icon={BadgeCheck} title="Aún no agregas evidencias">Agrega proyectos, muestras, certificados o registros de insignias a las habilidades de tu perfil.</AuraEmptyState> : (
          <ul className="flex flex-col gap-2">
            {evidence.map((item) => <li key={item.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <FileJson className="mt-0.5 h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-bone">{item.title}</p>
                <p className="text-xs text-graphite-400">{item.skill.name} · {TYPES.find((t) => t.value === item.evidence_type)?.label} · {item.source === 'open_badge_import' ? 'JSON de insignia importado' : 'Aportado por ti'}</p>
                {item.issuer && <p className="text-xs text-graphite-400">Emisor declarado: {item.issuer}</p>}
                {item.description && <p className="mt-1 text-xs text-graphite-300">{item.description}</p>}
                <AuraBadge tone="warning">Sin verificación independiente</AuraBadge>
                {item.evidence_url && <a className="ml-2 inline-flex items-center gap-1 text-xs text-aura-400 hover:underline" href={item.evidence_url} target="_blank" rel="noopener noreferrer">Ver evidencia <ExternalLink className="h-3 w-3" aria-hidden="true" /></a>}
                {item.credential_ref && <p className="mt-1 break-all font-mono text-[0.65rem] text-graphite-500">Referencia: {item.credential_ref}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-graphite-300">
                  <input type="checkbox" checked={item.share_with_companies} disabled={toggleShare.isPending} onChange={(e) => toggleShare.mutate({ id: item.id, value: e.target.checked })} className="accent-orange-500" />
                  Compartir con empresas
                </label>
                <AuraButton variant="ghost" size="icon" aria-label={`Eliminar evidencia ${item.title}`} loading={remove.isPending && remove.variables === item.id} onClick={() => remove.mutate(item.id)}><Trash2 className="h-4 w-4" /></AuraButton>
              </div>
            </li>)}
          </ul>
        )}
      </section>
      <p className="text-[0.68rem] text-graphite-500">El archivo exportado es un pasaporte portable de AURA. No constituye una insignia Open Badges firmada ni una certificación oficial.</p>
    </AuraPanel>
  )
}
