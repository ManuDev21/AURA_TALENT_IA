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
    <div className="relative flex h-full flex-col overflow-y-auto">
      {/* Barra superior limpia para que el selector de idioma nunca tape el formulario en celular */}
      <header className="flex w-full shrink-0 items-center justify-between px-4 pt-4 sm:px-6 md:px-10 md:pt-6">
        <div className="flex items-center gap-2.5 md:hidden">
          <img src="/aura.svg" alt="" className="h-7 w-7" />
          <div>
            <p className="font-display text-sm font-bold tracking-wide text-bone">AURA TALENT AI</p>
            <p className="text-[10px] text-graphite-400">Apoyo inteligente para tu carrera</p>
          </div>
        </div>
        <div className="ml-auto">
          <LanguageSelectorButton />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-6 px-4 py-5 sm:px-6 md:grid-cols-2 md:gap-10 md:px-10 md:py-10">
        <div className="hidden flex-col justify-end self-stretch pb-10 md:flex">
          <p className="hud-label text-aura-400">Artificial Understanding &amp; Recruitment Assistant</p>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight text-bone text-glow">
            AURA TALENT AI
          </h1>
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
