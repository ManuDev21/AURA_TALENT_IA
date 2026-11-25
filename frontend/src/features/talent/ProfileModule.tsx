import { Award, Briefcase, ExternalLink, GraduationCap, Languages, Link2, Orbit, UserRound } from 'lucide-react'
import { useState } from 'react'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraProgressRing } from '@/components/aura/AuraProgressRing'
import { type AuraTab, AuraTabs } from '@/components/aura/AuraTabs'
import { FormAlert } from '@/features/auth/FormAlert'
import { CrudSection } from '@/features/talent/CrudSection'
import { EducationForm } from '@/features/talent/forms/EducationForm'
import { ExperienceForm } from '@/features/talent/forms/ExperienceForm'
import { CertificationForm, LanguageForm, LinkForm } from '@/features/talent/forms/SmallForms'
import { ProfileSummaryForm } from '@/features/talent/ProfileSummaryForm'
import { SkillsWorkspace } from '@/features/talent/SkillsWorkspace'
import { useCandidateOverview, useProfileItems } from '@/features/talent/useProfileData'
import { formatMonth, formatRange } from '@/utils/dates'
import { EDUCATION_LEVEL, EMPLOYMENT_TYPE, LANGUAGE_LEVEL, LANGUAGES, LINK_TYPE } from '@/utils/labels'

type TabId = 'summary' | 'experience' | 'education' | 'skills' | 'languages' | 'links'

export function ProfileModule() {
  const { data, isPending, error } = useCandidateOverview()
  const [tab, setTab] = useState<TabId>('summary')
  const experiences = useProfileItems('experiences')
  const education = useProfileItems('education')
  const certifications = useProfileItems('certifications')
  const languages = useProfileItems('languages')
  const links = useProfileItems('links')

  if (isPending) {
    return (
      <AuraPanel eyebrow="Talent Profile" title="Perfil">
        <div className="flex justify-center py-12">
          <AuraLoader label="Leyendo tu perfil" />
        </div>
      </AuraPanel>
    )
  }
  if (error || !data) {
    return (
      <AuraPanel eyebrow="Talent Profile" title="Perfil">
        <FormAlert message={error?.message ?? 'No fue posible cargar el perfil.'} />
      </AuraPanel>
    )
  }

  const tabs: AuraTab<TabId>[] = [
    { id: 'summary', label: 'Resumen', icon: UserRound },
    { id: 'experience', label: 'Experiencia', icon: Briefcase, badge: data.experiences.length },
    { id: 'education', label: 'Educacion', icon: GraduationCap, badge: data.education.length },
    { id: 'skills', label: 'Habilidades', icon: Orbit, badge: data.skills.length },
    { id: 'languages', label: 'Idiomas y certificaciones', icon: Languages, badge: data.languages.length + data.certifications.length },
    { id: 'links', label: 'Enlaces', icon: Link2, badge: data.links.length },
  ]

  return (
    <AuraPanel eyebrow="Talent Profile" className="flex flex-col gap-5">
      <header className="flex items-center gap-4 pr-10 sm:gap-5">
        <AuraProgressRing value={data.profile.completeness} label="Completitud del perfil" sublabel="perfil" />
        <div className="min-w-0">
          <h2 className="break-words font-display text-xl font-semibold leading-tight sm:text-2xl">{data.full_name}</h2>
          <p className="break-words text-sm text-graphite-300">{data.profile.headline ?? 'Agrega un titular profesional'}</p>
          <p className="mt-1 text-xs text-graphite-400">
            {data.profile.completeness < 100
              ? 'Completa tu perfil para mejorar las recomendaciones de AURA.'
              : 'Perfil completo. AURA tiene contexto suficiente para ayudarte.'}
          </p>
        </div>
      </header>

      <AuraTabs label="Secciones del perfil" tabs={tabs} active={tab} onChange={setTab} />

      <div role="tabpanel" aria-label={tabs.find((t) => t.id === tab)?.label}>
        {tab === 'summary' && <ProfileSummaryForm key={data.profile.id} profile={data.profile} />}

        {tab === 'experience' && (
          <CrudSection
            title="Experiencia laboral"
            icon={Briefcase}
            items={data.experiences}
            addLabel="Agregar experiencia"
            emptyTitle="Aun no registras experiencia"
            emptyHint="Incluye practicas, freelance o voluntariado: todo cuenta."
            itemLabel={(e) => e.title}
            onDelete={(e) => experiences.remove.mutateAsync(e.id)}
            renderForm={(props) => <ExperienceForm {...props} />}
            renderItem={(e) => (
              <>
                <p className="font-medium text-bone">{e.title}</p>
                <p className="text-sm text-graphite-300">
                  {e.company_name}
                  {e.employment_type && ` / ${EMPLOYMENT_TYPE[e.employment_type]}`}
                </p>
                <p className="hud-label mt-1 text-graphite-400">{formatRange(e.start_date, e.end_date, e.is_current)}</p>
                {e.achievements.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-graphite-300">
                    {e.achievements.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          />
        )}

        {tab === 'education' && (
          <CrudSection
            title="Formacion academica"
            icon={GraduationCap}
            items={data.education}
            addLabel="Agregar formacion"
            emptyTitle="Aun no registras formacion"
            itemLabel={(e) => e.institution}
            onDelete={(e) => education.remove.mutateAsync(e.id)}
            renderForm={(props) => <EducationForm {...props} />}
            renderItem={(e) => (
              <>
                <p className="font-medium text-bone">{e.degree ?? e.institution}</p>
                <p className="text-sm text-graphite-300">
                  {e.degree ? e.institution : ''}
                  {e.level && `${e.degree ? ' / ' : ''}${EDUCATION_LEVEL[e.level]}`}
                </p>
                <p className="hud-label mt-1 text-graphite-400">{formatRange(e.start_date, e.end_date, e.is_current)}</p>
              </>
            )}
          />
        )}

        {tab === 'skills' && <SkillsWorkspace skills={data.skills} />}

        {tab === 'languages' && (
          <div className="flex flex-col gap-8">
            <CrudSection
              title="Idiomas"
              icon={Languages}
              items={data.languages}
              addLabel="Agregar idioma"
              emptyTitle="Aun no registras idiomas"
              itemLabel={(l) => LANGUAGES[l.language_code] ?? l.language_code}
              onDelete={(l) => languages.remove.mutateAsync(l.id)}
              renderForm={(props) => <LanguageForm {...props} />}
              renderItem={(l) => (
                <p className="text-sm">
                  <span className="font-medium text-bone">{LANGUAGES[l.language_code] ?? l.language_code.toUpperCase()}</span>
                  <span className="text-graphite-300"> / {LANGUAGE_LEVEL[l.level]}</span>
                  {l.certificate_name && <span className="text-graphite-400"> / {l.certificate_name}</span>}
                </p>
              )}
            />
            <CrudSection
              title="Certificaciones"
              icon={Award}
              items={data.certifications}
              addLabel="Agregar certificacion"
              emptyTitle="Aun no registras certificaciones"
              itemLabel={(c) => c.name}
              onDelete={(c) => certifications.remove.mutateAsync(c.id)}
              renderForm={(props) => <CertificationForm {...props} />}
              renderItem={(c) => (
                <>
                  <p className="font-medium text-bone">{c.name}</p>
                  <p className="text-sm text-graphite-300">
                    {c.issuer}
                    {c.issued_at && ` / ${formatMonth(c.issued_at)}`}
                  </p>
                  {c.credential_url && (
                    <a href={c.credential_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-aura-400 hover:underline">
                      Verificar <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </>
              )}
            />
          </div>
        )}

        {tab === 'links' && (
          <CrudSection
            title="Enlaces profesionales"
            icon={Link2}
            items={data.links}
            addLabel="Agregar enlace"
            emptyTitle="Aun no registras enlaces"
            emptyHint="GitHub, LinkedIn o tu sitio personal ayudan a respaldar tu experiencia."
            itemLabel={(l) => l.label ?? LINK_TYPE[l.link_type] ?? l.url}
            onDelete={(l) => links.remove.mutateAsync(l.id)}
            renderForm={(props) => <LinkForm {...props} />}
            renderItem={(l) => (
              <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-aura-400">
                <span className="hud-label text-graphite-400">{LINK_TYPE[l.link_type]}</span>
                <span className="truncate">{l.label ?? l.url}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              </a>
            )}
          />
        )}
      </div>
    </AuraPanel>
  )
}
