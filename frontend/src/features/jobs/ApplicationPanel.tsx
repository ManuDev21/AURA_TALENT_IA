import { useQuery } from '@tanstack/react-query'
import { Brain, ExternalLink, FileText, GitCompareArrows, Mail, MessageSquare, UserRound } from 'lucide-react'
import { useState } from 'react'
import { applicationsApi, jobKeys } from '@/api/jobs'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraSegmented } from '@/components/aura/AuraSegmented'
import { AuraTabs } from '@/components/aura/AuraTabs'
import { matchApi, matchKeys } from '@/api/match'
import { CompanyAssessments } from '@/features/assessments/CompanyAssessments'
import { MatchLoader } from '@/features/match/MatchDetail'
import { CvPreview } from '@/features/cv/CvPreview'
import { STAGE_LABELS } from '@/features/jobs/labels'
import { TransitionDialog } from '@/features/jobs/TransitionDialog'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { useSessionStore } from '@/store/sessionStore'
import type { ApplicationDetail, Stage } from '@/types/jobs'
import { formatRange } from '@/utils/dates'
import { LANGUAGE_LEVEL, LANGUAGES, PROFICIENCY } from '@/utils/labels'

type Tab = 'profile' | 'match' | 'cv' | 'assessments' | 'history'

export function ApplicationPanel({ applicationId }: { applicationId: string }) {
  const { data, isPending } = useQuery({ queryKey: jobKeys.application(applicationId), queryFn: () => applicationsApi.detail(applicationId) })
  const [tab, setTab] = useState<Tab>('profile')
  const [moving, setMoving] = useState<Stage | null>(null)
  const canAdvance = useSessionStore((s) => s.user?.permissions.includes('applications:advance') ?? false)

  if (isPending || !data) {
    return (
      <div className="flex justify-center py-10">
        <AuraLoader label="Cargando postulacion" />
      </div>
    )
  }
  const c = data.candidate

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold">{c.full_name}</h3>
          <p className="text-sm text-graphite-300">{c.headline ?? 'Sin titular'}</p>
          <a href={`mailto:${c.email}`} className="mt-1 inline-flex items-center gap-1 text-xs text-aura-400 hover:underline">
            <Mail className="h-3 w-3" aria-hidden="true" /> {c.email}
          </a>
        </div>
        <AuraBadge tone={data.status === 'active' ? 'aura' : 'neutral'}>{STAGE_LABELS[data.current_stage]}</AuraBadge>
      </header>

      {canAdvance && data.allowed_transitions.length > 0 && (
        <div className="neo-inset flex flex-wrap items-center gap-2 rounded-xl p-3" role="group" aria-label="Mover de etapa">
          <span className="hud-label mr-1 text-graphite-400">Mover a:</span>
          {data.allowed_transitions.map((stage) => (
            <AuraButton key={stage} size="sm" variant={stage === 'CLOSED' ? 'ghost' : 'neo'} onClick={() => setMoving(stage)}>
              {STAGE_LABELS[stage]}
            </AuraButton>
          ))}
        </div>
      )}
      {data.status !== 'active' && (
        <p className="text-xs text-graphite-400">
          Proceso {data.status === 'withdrawn' ? 'retirado por la persona candidata' : 'concluido'}.
        </p>
      )}

      <AuraTabs
        label="Informacion de la postulacion"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'profile', label: 'Perfil', icon: UserRound },
          { id: 'match', label: 'Match', icon: GitCompareArrows },
          { id: 'cv', label: 'CV enviado', icon: FileText },
          { id: 'assessments', label: 'Evaluaciones', icon: Brain },
          { id: 'history', label: 'Historial y notas', icon: MessageSquare, badge: data.notes.length },
        ]}
      />
      {tab === 'profile' && <ProfileView data={data} />}
      {tab === 'cv' &&
        (data.resume_sections.length ? (
          <div className="neo-inset overflow-x-auto rounded-2xl p-3">
            <CvPreview sections={data.resume_sections} template="aura-classic" />
          </div>
        ) : (
          <p className="text-sm text-graphite-400">La persona se postulo solo con su perfil.</p>
        ))}
      {tab === 'match' && (
        <MatchLoader queryKey={matchKeys.application(data.id)} queryFn={() => matchApi.forApplication(data.id)} perspective="company" />
      )}
      {tab === 'assessments' && <CompanyAssessments applicationId={data.id} active={data.status === 'active'} />}
      {tab === 'history' && <HistoryView data={data} />}

      {moving && (
        <TransitionDialog
          applicationId={data.id}
          jobId={data.job_id}
          candidateName={c.full_name}
          from={data.current_stage}
          to={moving}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  )
}

function ProfileView({ data }: { data: ApplicationDetail }) {
  const c = data.candidate
  return (
    <div className="flex flex-col gap-4 text-sm">
      {data.cover_letter && (
        <blockquote className="rounded-xl border-l-2 border-aura-500/60 bg-white/[0.02] p-3 text-graphite-300">{data.cover_letter}</blockquote>
      )}
      {c.summary && <p className="whitespace-pre-line text-graphite-300">{c.summary}</p>}
      {c.skills.length > 0 && (
        <section>
          <h4 className="hud-label mb-2 text-aura-400">Habilidades declaradas</h4>
          <ul className="flex flex-wrap gap-1.5">
            {c.skills.map((s) => (
              <li key={s.skill.id} title={PROFICIENCY[s.proficiency]} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-graphite-300">
                {s.skill.name} <span className="text-aura-400">{s.proficiency}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {c.shared_skill_evidence.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="hud-label text-aura-400">Evidencias compartidas por la persona candidata</h4>
          <ul className="flex flex-col gap-2">
            {c.shared_skill_evidence.map((evidence) => (
              <li key={evidence.id} className="rounded-lg border border-white/5 p-3 text-xs">
                <p className="font-medium text-bone">{evidence.title} <span className="text-aura-400">· {evidence.skill.name}</span></p>
                {evidence.description && <p className="mt-1 text-graphite-300">{evidence.description}</p>}
                {evidence.issuer && <p className="mt-1 text-graphite-400">Emisor declarado: {evidence.issuer}</p>}
                {evidence.evidence_url && <a href={evidence.evidence_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex text-aura-400 hover:underline">Abrir evidencia</a>}
                <p className="mt-1 text-warning">Aportada por la persona; no verificada independientemente por AURA.</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {c.experiences.length > 0 && (
        <section>
          <h4 className="hud-label mb-2 text-aura-400">Experiencia</h4>
          <ul className="flex flex-col gap-2">
            {c.experiences.map((e) => (
              <li key={e.id}>
                <p className="text-bone">
                  {e.title} / {e.company_name}
                </p>
                <p className="text-xs text-graphite-400">{formatRange(e.start_date, e.end_date, e.is_current)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {c.education.length > 0 && (
        <section>
          <h4 className="hud-label mb-2 text-aura-400">Educacion</h4>
          <ul className="flex flex-col gap-1">
            {c.education.map((e) => (
              <li key={e.id} className="text-graphite-300">
                {e.degree ? `${e.degree} - ` : ''}
                {e.institution}
              </li>
            ))}
          </ul>
        </section>
      )}
      {c.languages.length > 0 && (
        <p className="text-graphite-300">
          <span className="hud-label mr-2 text-aura-400">Idiomas</span>
          {c.languages.map((l) => `${LANGUAGES[l.language_code] ?? l.language_code} (${LANGUAGE_LEVEL[l.level]?.split(' ')[0]})`).join(', ')}
        </p>
      )}
      {c.links.length > 0 && (
        <p className="flex flex-wrap gap-3">
          {c.links.map((l) => (
            <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-aura-400 hover:underline">
              {l.label ?? l.link_type} <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ))}
        </p>
      )}
    </div>
  )
}

function HistoryView({ data }: { data: ApplicationDetail }) {
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<'team' | 'private'>('team')
  const canNote = useSessionStore((s) => s.user?.permissions.includes('applications:notes') ?? false)
  const add = useAuraMutation({
    mutationFn: () => applicationsApi.addNote(data.id, { body, visibility }),
    invalidate: [jobKeys.application(data.id)],
    success: 'Nota agregada.',
    onSuccess: () => setBody(''),
  })

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-3 border-l border-white/10 pl-4" aria-label="Historial de etapas">
        {data.history.map((h) => (
          <li key={h.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-aura-500" aria-hidden="true" />
            <p className="text-sm text-bone">
              {h.from_stage && h.from_stage !== h.to_stage ? `${STAGE_LABELS[h.from_stage]} → ` : ''}
              {STAGE_LABELS[h.to_stage]}
            </p>
            <p className="text-[0.7rem] text-graphite-400">
              {new Date(h.created_at).toLocaleString('es')} / decision humana
            </p>
            {h.comment && <p className="mt-1 text-xs text-graphite-300">{h.comment}</p>}
          </li>
        ))}
      </ol>
      <section aria-label="Notas del equipo" className="flex flex-col gap-2">
        <h4 className="hud-label text-aura-400">Notas</h4>
        {data.notes.map((n) => (
          <div key={n.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm">
            <p className="text-graphite-300">{n.body}</p>
            <p className="mt-1 text-[0.7rem] text-graphite-400">
              {n.author_name} / {new Date(n.created_at).toLocaleDateString('es')}
              {n.visibility === 'private' && ' / privada'}
            </p>
          </div>
        ))}
        {canNote && (
          <div className="flex flex-col gap-2">
            <textarea
              aria-label="Nueva nota"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder="Escribe una nota sobre el proceso..."
              className="neo-inset rounded-xl bg-transparent p-3 text-sm text-bone placeholder:text-graphite-400 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2">
              <AuraSegmented
                label="Visibilidad de la nota"
                value={visibility}
                onChange={setVisibility}
                options={[
                  { value: 'team', label: 'Equipo' },
                  { value: 'private', label: 'Solo yo' },
                ]}
              />
              <AuraButton size="sm" loading={add.isPending} disabled={!body.trim()} onClick={() => add.mutate()}>
                Agregar nota
              </AuraButton>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
