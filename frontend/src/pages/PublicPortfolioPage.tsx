import { useQuery } from '@tanstack/react-query'
import { ExternalLink, MapPin } from 'lucide-react'
import { useEffect } from 'react'
import { useParams } from 'react-router'
import { portfolioApi } from '@/api/talent'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { NotFoundPage } from '@/pages/StatusPages'
import { PLACEMENTS, useAuraStore } from '@/store/auraStore'
import { LINK_TYPE } from '@/utils/labels'

export function PublicPortfolioPage() {
  const { slug = '' } = useParams()
  const isMobile = useIsMobile()
  const { data, isPending, error } = useQuery({ queryKey: ['public-portfolio', slug], queryFn: () => portfolioApi.public(slug), retry: false })

  useEffect(() => {
    useAuraStore.getState().setPlacement(isMobile ? PLACEMENTS.mobileFocus : PLACEMENTS.auth)
  }, [isMobile])

  if (isPending) {
    return (
      <div className="flex h-full items-end justify-center pb-24">
        <AuraLoader label="Cargando portfolio" />
      </div>
    )
  }
  if (error || !data) return <NotFoundPage />

  return (
    <div className="h-full overflow-y-auto">
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pb-16 pt-[30vh] md:ml-auto md:mr-[6vw] md:pt-12">
        <AuraPanel eyebrow={data.title ?? 'Portfolio'} title={data.full_name}>
          {data.headline && <p className="text-graphite-300">{data.headline}</p>}
          {data.location && (
            <p className="mt-1 flex items-center gap-1 text-sm text-graphite-400">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {data.location}
            </p>
          )}
          {data.summary && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-graphite-300">{data.summary}</p>}
          {data.links.length > 0 && (
            <p className="mt-4 flex flex-wrap gap-3 text-sm">
              {data.links.map((l) => (
                <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-aura-400 hover:underline">
                  {l.label ?? LINK_TYPE[l.link_type]} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ))}
            </p>
          )}
        </AuraPanel>

        {data.skills.length > 0 && (
          <AuraPanel eyebrow="Habilidades declaradas">
            <ul className="flex flex-wrap gap-2">
              {data.skills.map((s) => (
                <li key={s.name} className="rounded-lg bg-aura-500/10 px-2.5 py-1 text-xs text-ember-300">
                  {s.name}
                </li>
              ))}
            </ul>
          </AuraPanel>
        )}

        {data.projects.map((p) => (
          <AuraPanel key={p.id} eyebrow={p.role ?? 'Proyecto'} title={p.title}>
            {p.description && <p className="whitespace-pre-line text-sm leading-relaxed text-graphite-300">{p.description}</p>}
            {p.skills.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-1">
                {p.skills.map((s) => (
                  <span key={s.id} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.65rem] text-graphite-300">
                    {s.name}
                  </span>
                ))}
              </p>
            )}
            <p className="mt-3 flex gap-4 text-sm">
              {p.repo_url && <a className="text-aura-400 hover:underline" href={p.repo_url} target="_blank" rel="noreferrer">Repositorio</a>}
              {p.demo_url && <a className="text-aura-400 hover:underline" href={p.demo_url} target="_blank" rel="noreferrer">Demo</a>}
              {p.docs_url && <a className="text-aura-400 hover:underline" href={p.docs_url} target="_blank" rel="noreferrer">Documentacion</a>}
            </p>
          </AuraPanel>
        ))}
        <p className="hud-label text-center text-graphite-400">Portfolio publicado con AURA TALENT AI</p>
      </main>
    </div>
  )
}
