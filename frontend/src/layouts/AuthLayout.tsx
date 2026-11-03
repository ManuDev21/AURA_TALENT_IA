import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { LanguageSelectorButton } from '@/i18n/liveTranslator'
import { PLACEMENTS, useAuraStore } from '@/store/auraStore'

export function AuthLayout() {
  const isMobile = useIsMobile()

  useEffect(() => {
    useAuraStore.getState().setPlacement(isMobile ? PLACEMENTS.mobileFocus : PLACEMENTS.auth)
  }, [isMobile])

  return (
    <div className="relative flex h-full overflow-y-auto">
      <div className="fixed right-5 top-4 z-40">
        <LanguageSelectorButton />
      </div>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-10 pt-[34vh] md:grid-cols-2 md:px-10 md:py-10">
        <div className="hidden flex-col justify-end self-stretch pb-10 md:flex">
          <p className="hud-label text-aura-400">Artificial Understanding &amp; Recruitment Assistant</p>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight text-bone text-glow">AURA TALENT AI</h1>
          <p className="mt-4 max-w-md text-graphite-300">
            Una inteligencia que te acompana a construir tu perfil, encontrar oportunidades y tomar mejores decisiones
            profesionales. Tu siempre decides.
          </p>
        </div>
        <main id="contenido" className="w-full max-w-md justify-self-center md:justify-self-end">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
