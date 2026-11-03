import { useQuery } from '@tanstack/react-query'
import { Copy, ExternalLink, FolderGit2, Globe, Link2, Lock, Save, Star } from 'lucide-react'
import { useState } from 'react'
import { portfolioApi, queryKeys } from '@/api/talent'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraInput } from '@/components/aura/AuraInput'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { AuraSegmented } from '@/components/aura/AuraSegmented'
import { FormAlert } from '@/features/auth/FormAlert'
import { ProjectForm } from '@/features/portfolio/ProjectForm'
import { CrudSection } from '@/features/talent/CrudSection'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import { toast } from '@/store/toastStore'
import type { PortfolioSettings } from '@/types/talent'
import { formatRange } from '@/utils/dates'

export function PortfolioModule() {
  const { data, isPending, error } = useQuery({ queryKey: queryKeys.portfolio, queryFn: portfolioApi.me })
  const remove = useAuraMutation({
    mutationFn: (id: string) => portfolioApi.deleteProject(id),
    invalidate: [queryKeys.portfolio, queryKeys.candidate],
    success: 'Proyecto eliminado.',
  })

  if (isPending) {
    return (
      <AuraPanel eyebrow="Portfolio" title="Portfolio">
        <div className="flex justify-center py-12">
          <AuraLoader label="Cargando proyectos" />
        </div>
      </AuraPanel>
    )
  }
  if (error || !data) return <AuraPanel title="Portfolio"><FormAlert message={error?.message ?? 'Error'} /></AuraPanel>

  return (
    <AuraPanel eyebrow="Portfolio" title="Proyectos y presencia publica" className="flex flex-col gap-6">
      <PortfolioSettingsCard key={`${data.settings.slug}-${data.settings.visibility}`} settings={data.settings} />
      <CrudSection
        title="Proyectos"
        icon={FolderGit2}
        items={data.projects}
        addLabel="Agregar proyecto"
        emptyTitle="Aun no tienes proyectos"
        emptyHint="Los proyectos son evidencia concreta de tus habilidades."
        itemLabel={(p) => p.title}
        onDelete={(p) => remove.mutateAsync(p.id)}
        renderForm={(props) => <ProjectForm {...props} />}
        renderItem={(p) => (
          <>
            <p className="flex items-center gap-2 font-medium text-bone">
              {p.is_featured && <Star className="h-3.5 w-3.5 fill-aura-500 text-aura-500" aria-label="Destacado" />}
              {p.title}
            </p>
            {p.role && <p className="text-sm text-graphite-300">{p.role}</p>}
            {(p.started_at || p.ended_at) && <p className="hud-label mt-1 text-graphite-400">{formatRange(p.started_at, p.ended_at)}</p>}
            {p.skills.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-1">
                {p.skills.map((s) => (
                  <span key={s.id} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.65rem] text-graphite-300">
                    {s.name}
                  </span>
                ))}
              </p>
            )}
            <p className="mt-2 flex gap-3 text-xs">
              {[
                ['Repositorio', p.repo_url],
                ['Demo', p.demo_url],
                ['Docs', p.docs_url],
              ].map(([label, url]) =>
                url ? (
                  <a key={label} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-aura-400 hover:underline">
                    {label} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : null,
              )}
            </p>
          </>
        )}
      />
    </AuraPanel>
  )
}

function PortfolioSettingsCard({ settings }: { settings: PortfolioSettings }) {
  const [visibility, setVisibility] = useState(settings.visibility)
  const [slug, setSlug] = useState(settings.slug)
  const save = useAuraMutation({
    mutationFn: (data: Partial<PortfolioSettings>) => portfolioApi.updateSettings(data),
    invalidate: [queryKeys.portfolio],
    success: 'Configuracion del portfolio guardada.',
  })
  const publicUrl = `${window.location.origin}/p/${settings.slug}`
  const isShared = settings.visibility !== 'private'

  return (
    <section aria-label="Visibilidad del portfolio" className="neo-inset flex flex-col gap-4 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="hud-label text-graphite-300">Visibilidad</h3>
        <AuraBadge tone={isShared ? 'success' : 'neutral'}>{isShared ? 'Compartido' : 'Privado'}</AuraBadge>
      </div>
      <AuraSegmented
        label="Visibilidad del portfolio"
        value={visibility}
        onChange={setVisibility}
        options={[
          { value: 'private', label: 'Privado', icon: Lock },
          { value: 'link', label: 'Con enlace', icon: Link2 },
          { value: 'public', label: 'Publico', icon: Globe },
        ]}
      />
      <AuraInput
        label="Direccion"
        value={slug}
        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
        hint={`${window.location.origin}/p/${slug}`}
      />
      <div className="flex flex-wrap justify-end gap-2">
        {isShared && (
          <>
            <AuraButton
              variant="ghost"
              size="sm"
              icon={Copy}
              onClick={() => void navigator.clipboard.writeText(publicUrl).then(() => toast.info('Enlace copiado.'))}
            >
              Copiar enlace
            </AuraButton>
            <a href={`/p/${settings.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-graphite-300 hover:bg-white/5 hover:text-bone">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Ver
            </a>
          </>
        )}
        <AuraButton
          size="sm"
          icon={Save}
          loading={save.isPending}
          disabled={visibility === settings.visibility && slug === settings.slug}
          onClick={() => save.mutate({ visibility, ...(slug !== settings.slug ? { slug } : {}) })}
        >
          Guardar
        </AuraButton>
      </div>
    </section>
  )
}
