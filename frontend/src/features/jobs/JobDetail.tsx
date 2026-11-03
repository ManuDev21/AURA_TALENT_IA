import { Building, CircleCheck, Clock3, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { JOB_EDUCATION, JOB_EMPLOYMENT, MODALITY, salaryText } from '@/features/jobs/labels'
import type { Job } from '@/types/jobs'
import { cn } from '@/utils/cn'
import { LANGUAGE_LEVEL, LANGUAGES, PROFICIENCY } from '@/utils/labels'

interface JobDetailProps {
  job: Job
  ownedSkillIds?: Set<string>
  footer?: ReactNode
}

/** Ficha de vacante compartida por candidato y empresa. */
export function JobDetail({ job, ownedSkillIds, footer }: JobDetailProps) {
  const salary = salaryText(job)
  const confirmationAge = job.last_confirmed_at
    ? Math.floor((Date.now() - new Date(job.last_confirmed_at).getTime()) / 86_400_000)
    : null
  const required = job.skills.filter((s) => s.importance === 'required')
  const preferred = job.skills.filter((s) => s.importance === 'preferred')
  const ownedRequired = ownedSkillIds ? required.filter((s) => ownedSkillIds.has(s.skill.id)).length : null

  return (
    <article className="flex flex-col gap-5">
      <header>
        <h3 className="font-display text-xl font-semibold text-bone">{job.title}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-graphite-300">
          <span className="inline-flex items-center gap-1">
            <Building className="h-3.5 w-3.5" aria-hidden="true" /> {job.company.name}
          </span>
          {job.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {job.location}
            </span>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <AuraBadge tone="aura">{MODALITY[job.modality]}</AuraBadge>
          <AuraBadge tone="neutral">{JOB_EMPLOYMENT[job.employment_type] ?? job.employment_type}</AuraBadge>
          {Number(job.experience_min_years) > 0 && <AuraBadge tone="neutral">{Number(job.experience_min_years)}+ anos</AuraBadge>}
          {job.education_level && job.education_level !== 'none' && (
            <AuraBadge tone="neutral">{JOB_EDUCATION[job.education_level]}</AuraBadge>
          )}
          {salary && <AuraBadge tone="success">{salary}</AuraBadge>}
        </div>
      </header>

      {ownedRequired !== null && required.length > 0 && (
        <p className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-graphite-300">
          Declaras <strong className="text-aura-400">{ownedRequired}</strong> de {required.length} habilidades requeridas. Es una
          coincidencia simple entre tu perfil y la vacante; el analisis de compatibilidad con explicacion llega en la Fase 6.
        </p>
      )}

      <section className="neo-inset flex flex-col gap-2 rounded-xl p-3" aria-label="Transparencia de la vacante">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="hud-label text-graphite-300">Información transparente</span>
          <span className="font-mono text-aura-400">{job.transparency_score}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5" role="meter" aria-label="Completitud de información de vacante" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.transparency_score}>
          <div className="h-full rounded-full bg-gradient-to-r from-aura-600 to-amber-300" style={{ width: `${job.transparency_score}%` }} />
        </div>
        {job.transparent_fields.length > 0 && <p className="text-xs text-graphite-300">Publicado: {job.transparent_fields.join(' · ')}</p>}
        {job.missing_transparency_fields.length > 0 && <p className="text-xs text-graphite-500">No especificado: {job.missing_transparency_fields.join(' · ')}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-graphite-400">
          {job.response_sla_days && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" aria-hidden="true" />Respuesta estimada en {job.response_sla_days} días</span>}
          {job.process_estimate_days && <span>Proceso estimado: {job.process_estimate_days} días</span>}
          <span className={confirmationAge === null || confirmationAge > 30 ? 'text-amber-300' : undefined}>
            {confirmationAge === null ? 'Vigencia sin confirmar' : confirmationAge > 30 ? `Confirmada hace ${confirmationAge} días; conviene volver a revisarla` : `Vigencia confirmada: ${new Date(job.last_confirmed_at!).toLocaleDateString('es')}`}
          </span>
        </div>
      </section>

      <p className="whitespace-pre-line text-sm leading-relaxed text-graphite-300">{job.description}</p>
      {job.schedule_description && <p className="text-sm text-graphite-300"><span className="hud-label mr-2 text-aura-400">Horario</span>{job.schedule_description}</p>}
      {job.benefits.length > 0 && <Block title="Beneficios"><ul className="list-disc space-y-1 pl-4 text-sm text-graphite-300">{job.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul></Block>}

      {job.responsibilities.length > 0 && (
        <Block title="Responsabilidades">
          <ul className="list-disc space-y-1 pl-4 text-sm text-graphite-300">
            {job.responsibilities.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Block>
      )}

      {job.skills.length > 0 && (
        <Block title="Habilidades">
          <SkillChips title="Requeridas" skills={required} owned={ownedSkillIds} />
          <SkillChips title="Deseables" skills={preferred} owned={ownedSkillIds} />
        </Block>
      )}

      {job.languages.length > 0 && (
        <Block title="Idiomas">
          <ul className="flex flex-wrap gap-2 text-sm">
            {job.languages.map((l) => (
              <li key={l.language_code} className="rounded-lg bg-white/5 px-2.5 py-1 text-graphite-300">
                {LANGUAGES[l.language_code] ?? l.language_code} {LANGUAGE_LEVEL[l.min_level]?.split(' ')[0]}
                {!l.is_required && <span className="text-graphite-400"> (deseable)</span>}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {job.requirements.length > 0 && (
        <Block title="Otros requisitos">
          <ul className="list-disc space-y-1 pl-4 text-sm text-graphite-300">
            {job.requirements.map((r) => (
              <li key={r.id}>
                {r.description}
                {!r.is_required && <span className="text-graphite-400"> (deseable)</span>}
              </li>
            ))}
          </ul>
        </Block>
      )}
      {footer}
    </article>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="hud-label text-aura-400">{title}</h4>
      {children}
    </section>
  )
}

function SkillChips({ title, skills, owned }: { title: string; skills: Job['skills']; owned?: Set<string> }) {
  if (!skills.length) return null
  return (
    <div>
      <p className="mb-1 text-[0.7rem] text-graphite-400">{title}</p>
      <ul className="flex flex-wrap gap-1.5">
        {skills.map((s) => {
          const has = owned?.has(s.skill.id)
          return (
            <li
              key={s.skill.id}
              title={`Nivel minimo: ${PROFICIENCY[s.min_proficiency]}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs',
                has ? 'bg-success/10 text-success' : 'bg-white/5 text-graphite-300',
              )}
            >
              {has && <CircleCheck className="h-3 w-3" aria-label="La declaras en tu perfil" />}
              {s.skill.name}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
