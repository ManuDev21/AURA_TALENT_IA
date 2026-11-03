import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Briefcase, Building, GitCompareArrows, Search, Send, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { cvApi, cvKeys } from '@/api/cv'
import { applicationsApi, jobKeys, jobsApi } from '@/api/jobs'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraEmptyState } from '@/components/aura/AuraEmptyState'
import { AuraSelect, AuraTextarea } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraSegmented } from '@/components/aura/AuraSegmented'
import { JobDetail } from '@/features/jobs/JobDetail'
import { CANDIDATE_STAGE_LABELS, MODALITY } from '@/features/jobs/labels'
import { SkillPicker } from '@/features/talent/SkillPicker'
import { useCandidateOverview } from '@/features/talent/useProfileData'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import type { PublicJob } from '@/types/jobs'
import type { Skill } from '@/types/talent'
import { cn } from '@/utils/cn'

type ModalityFilter = 'all' | 'remote' | 'hybrid' | 'onsite'

export function JobSearchModule() {
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState(() => searchParams.get('q') ?? '')
  const [modality, setModality] = useState<ModalityFilter>('all')
  const [skill, setSkill] = useState<Skill | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const deferred = useDeferredValue(q.trim())
  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '30' }
    if (deferred) p.q = deferred
    if (modality !== 'all') p.modality = modality
    if (skill) p.skill_id = skill.id
    return p
  }, [deferred, modality, skill])

  const { data, isFetching } = useQuery({ queryKey: jobKeys.search(params), queryFn: () => jobsApi.search(params) })
  const { data: overview } = useCandidateOverview()
  const owned = useMemo(() => new Set(overview?.skills.map((s) => s.skill.id) ?? []), [overview])
  const selected = data?.items.find((j) => j.id === selectedId) ?? null
  const navigate = useNavigate()

  return (
    <AuraPanel eyebrow="Oportunidades" title="Vacantes" className="flex flex-col gap-4">
      {selected ? (
        <>
          <AuraButton variant="ghost" size="sm" icon={ArrowLeft} className="self-start" onClick={() => setSelectedId(null)}>
            Volver a resultados
          </AuraButton>
          <JobDetail
            job={selected}
            ownedSkillIds={owned}
            footer={
              <>
                <AuraButton variant="neo" size="sm" icon={GitCompareArrows} className="self-start" onClick={() => navigate(`/candidate/match?job=${selected.id}`)}>
                  Ver mi compatibilidad explicada
                </AuraButton>
                <ApplyBox job={selected} />
              </>
            }
          />
        </>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <AuraInput label="Buscar" icon={Search} placeholder="Puesto, tecnologia o empresa" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <span className="hud-label text-graphite-300">Modalidad</span>
              <AuraSegmented
                label="Modalidad"
                value={modality}
                onChange={setModality}
                options={[
                  { value: 'all', label: 'Todas' },
                  { value: 'remote', label: 'Remoto' },
                  { value: 'hybrid', label: 'Hibrido' },
                  { value: 'onsite', label: 'Presencial' },
                ]}
              />
            </div>
          </div>
          {skill ? (
            <p className="flex items-center gap-2 text-sm">
              <span className="text-graphite-400">Filtrando por habilidad:</span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-aura-500/15 py-1 pl-2.5 pr-1 text-xs text-ember-300">
                {skill.name}
                <button type="button" aria-label="Quitar filtro de habilidad" onClick={() => setSkill(null)} className="rounded p-0.5 hover:bg-white/10">
                  <X className="h-3 w-3" />
                </button>
              </span>
            </p>
          ) : (
            <SkillPicker label="Filtrar por habilidad" onSelect={setSkill} />
          )}

          <p className="hud-label text-graphite-400" aria-live="polite">
            {isFetching ? 'Buscando...' : `${data?.total ?? 0} vacantes`}
          </p>
          {!data ? (
            <div className="flex justify-center py-10">
              <AuraLoader label="Buscando vacantes" />
            </div>
          ) : data.items.length === 0 ? (
            <AuraEmptyState icon={Briefcase} title="No hay vacantes con esos criterios">
              Prueba con otra palabra o quita filtros.
            </AuraEmptyState>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {data.items.map((job) => (
                <JobCard key={job.id} job={job} owned={owned} onOpen={() => setSelectedId(job.id)} />
              ))}
            </ul>
          )}
        </>
      )}
    </AuraPanel>
  )
}

function JobCard({ job, owned, onOpen }: { job: PublicJob; owned: Set<string>; onOpen: () => void }) {
  const required = job.skills.filter((s) => s.importance === 'required')
  const matched = required.filter((s) => owned.has(s.skill.id)).length
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-full w-full flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-left transition hover:border-aura-500/40 hover:bg-aura-500/[0.04]"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-bone group-hover:text-aura-400">{job.title}</span>
          <AuraBadge tone="aura" className="shrink-0">
            {MODALITY[job.modality]}
          </AuraBadge>
        </div>
        <span className="flex items-center gap-1 text-xs text-graphite-400">
          <Building className="h-3 w-3" aria-hidden="true" /> {job.company.name}
          {job.location && ` / ${job.location}`}
        </span>
        <span className="flex flex-wrap gap-1">
          {job.skills.slice(0, 5).map((s) => (
            <span
              key={s.skill.id}
              className={cn('rounded px-1.5 py-0.5 font-mono text-[0.62rem]', owned.has(s.skill.id) ? 'bg-success/10 text-success' : 'bg-white/5 text-graphite-300')}
            >
              {s.skill.name}
            </span>
          ))}
        </span>
        <span className="mt-auto flex items-center justify-between text-[0.7rem] text-graphite-400">
          {required.length > 0 ? `${matched}/${required.length} requeridas en tu perfil` : 'Sin habilidades requeridas'}
          {job.my_application && <AuraBadge tone="success">{CANDIDATE_STAGE_LABELS[job.my_application.current_stage]}</AuraBadge>}
        </span>
        <span className="text-[0.65rem] text-amber-300">Transparencia {job.transparency_score}%</span>
      </button>
    </li>
  )
}

function ApplyBox({ job }: { job: PublicJob }) {
  const { data: resumes = [] } = useQuery({ queryKey: cvKeys.resumes, queryFn: cvApi.list })
  const [resumeId, setResumeId] = useState('')
  const [letter, setLetter] = useState('')
  const apply = useAuraMutation({
    mutationFn: () =>
      applicationsApi.apply({
        job_id: job.id,
        resume_id: resumeId || resumes.find((r) => r.is_default)?.id || null,
        cover_letter: letter.trim() || null,
      }),
    invalidate: [['jobs', 'search'], jobKeys.mine],
    success: `Postulacion enviada a ${job.company.name}.`,
  })

  if (job.my_application) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
        Ya te postulaste. Estado: <strong>{CANDIDATE_STAGE_LABELS[job.my_application.current_stage]}</strong>
      </div>
    )
  }
  return (
    <section aria-label="Postularme" className="neo-inset flex flex-col gap-3 rounded-xl p-4">
      <h4 className="hud-label text-aura-400">Postularme</h4>
      <AuraSelect
        label="CV a enviar"
        placeholder={resumes.length ? 'CV predeterminado' : 'Sin CV (solo perfil)'}
        options={resumes.map((r) => ({ value: r.id, label: `${r.name}${r.is_default ? ' (predeterminado)' : ''}` }))}
        value={resumeId}
        onChange={(e) => setResumeId(e.target.value)}
      />
      <AuraTextarea label="Mensaje para la empresa (opcional)" rows={3} value={letter} onChange={(e) => setLetter(e.target.value)} />
      <p className="text-xs text-graphite-400">
        Se enviara una copia fija del CV elegido; si lo editas despues, la empresa seguira viendo la version enviada. La empresa
        podra ver tu perfil profesional y tu correo.
      </p>
      <AuraButton icon={Send} loading={apply.isPending} className="self-end" onClick={() => apply.mutate()}>
        Enviar postulacion
      </AuraButton>
    </section>
  )
}
