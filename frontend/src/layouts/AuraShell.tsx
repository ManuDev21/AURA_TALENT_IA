import { ChevronRight, Home, Orbit, PanelLeftClose, PanelLeftOpen, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type CSSProperties, useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router'
import { AREA_MODULES, type AuraModule } from '@/aura/modules'
import { OrbitalNav } from '@/aura/OrbitalNav'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraCommandBar } from '@/components/aura/AuraCommandBar'
import { GestureController } from '@/gestures/GestureController'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ShellHud } from '@/layouts/ShellHud'
import { PLACEMENTS, useAuraStore } from '@/store/auraStore'
import { useSessionStore } from '@/store/sessionStore'
import { AURA_THEMES, useUiStore } from '@/store/uiStore'
import { cn } from '@/utils/cn'
import type { AuraArea } from '@/utils/roles'

/**
 * Layout principal con soporte dual:
 * 1. Modo Orbital (espacial 3D con el AURA Core al centro y modulos en orbita).
 * 2. Modo Clasico (Navbar superior + Cajon lateral animado con efecto spring + tarjetas con delay y shimmer).
 */
export function AuraShell({ area }: { area: AuraArea }) {
  const isMobile = useIsMobile()
  const location = useLocation()
  const match = useMatch(`/${area}/:moduleId`)
  const moduleId = match?.params.moduleId
  const modules = AREA_MODULES[area]
  const currentModule = modules.find((m) => m.id === moduleId)
  const wide = !!currentModule?.wide
  const user = useSessionStore((s) => s.user)
  const firstName = user?.full_name.split(' ')[0] ?? ''

  const layoutMode = useUiStore((s) => s.layoutMode)
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setLayoutMode = useUiStore((s) => s.setLayoutMode)
  const colorTheme = useUiStore((s) => s.colorTheme)

  useEffect(() => {
    if (layoutMode === 'clasico') {
      useAuraStore.getState().setPlacement(
        isMobile ? PLACEMENTS.mobileFocus : { x: 2.35, y: 0.15, scale: 0.68 },
      )
      return
    }
    const placement = isMobile
      ? moduleId
        ? PLACEMENTS.mobileFocus
        : PLACEMENTS.mobile
      : moduleId
        ? wide
          ? PLACEMENTS.focusWide
          : PLACEMENTS.focus
        : PLACEMENTS.center
    useAuraStore.getState().setPlacement(placement)
  }, [moduleId, isMobile, wide, layoutMode])

  if (layoutMode === 'clasico') {
    return (
      <div className="pointer-events-auto relative flex h-full flex-col">
        <a
          href="#workspace"
          className="sr-only z-50 rounded-lg bg-aura-500 px-3 py-2 text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Saltar al contenido
        </a>
        <ShellHud area={area} />
        <GestureController area={area} />

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <AnimatePresence>
            {isMobile && sidebarOpen && (
              <motion.div
                key="drawer-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs"
                aria-hidden="true"
              />
            )}
          </AnimatePresence>

          <motion.aside
            aria-label="Menu cajon principal del sistema"
            initial={false}
            animate={{
              width: sidebarOpen ? 268 : isMobile ? 0 : 72,
              x: isMobile && !sidebarOpen ? -280 : 0,
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className={cn(
              'glass z-40 flex shrink-0 flex-col overflow-hidden border-y-0 border-l-0 border-r border-aura-500/25',
              isMobile && 'fixed inset-y-14 left-0 shadow-2xl',
            )}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-3">
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="hud-label flex items-center gap-1.5 text-aura-400"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Cajon de Modulos
                </motion.span>
              )}
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={sidebarOpen ? 'Contraer cajon lateral' : 'Expandir cajon lateral'}
                title={sidebarOpen ? 'Contraer cajon lateral' : 'Expandir cajon lateral'}
                className="btn-jelly neo flex h-8 w-8 items-center justify-center rounded-lg text-graphite-300 hover:text-aura-400"
              >
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-2.5">
              <ul className="flex flex-col gap-1.5">
                <li
                  className="card-stagger"
                  style={{ '--stagger': 0 } as CSSProperties}
                >
                  <NavLink
                    to={`/${area}`}
                    end
                    onClick={() => {
                      if (isMobile) setSidebarOpen(false)
                    }}
                    title="Panel de Inicio"
                    className={({ isActive }) =>
                      cn(
                        'btn-jelly flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition',
                        isActive
                          ? 'bg-aura-500/20 text-bone shadow-[inset_3px_0_0_var(--color-aura-500)]'
                          : 'text-graphite-300 hover:bg-white/5 hover:text-bone',
                      )
                    }
                  >
                    <Home className="h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
                    {sidebarOpen && <span className="truncate">Panel de Inicio</span>}
                  </NavLink>
                </li>

                {modules.map(({ id, label, icon: Icon, available }, idx) => (
                  <li
                    key={id}
                    className="card-stagger"
                    style={{ '--stagger': idx + 1 } as CSSProperties}
                  >
                    <NavLink
                      to={`/${area}/${id}`}
                      onClick={() => {
                        if (isMobile) setSidebarOpen(false)
                      }}
                      title={label}
                      className={({ isActive }) =>
                        cn(
                          'btn-jelly flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition',
                          isActive
                            ? 'bg-aura-500/20 text-bone shadow-[inset_3px_0_0_var(--color-aura-500)]'
                            : 'text-graphite-300 hover:bg-white/5 hover:text-bone',
                          !available && 'opacity-50',
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
                      {sidebarOpen && <span className="truncate">{label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            {sidebarOpen && (
              <div className="border-t border-white/10 p-3">
                <button
                  type="button"
                  onClick={() => setLayoutMode('orbital')}
                  className="btn-jelly neo flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-graphite-300 transition hover:text-aura-400"
                >
                  <Orbit className="h-3.5 w-3.5 text-aura-400" />
                  Cambiar a Vista Orbital 3D
                </button>
              </div>
            )}
          </motion.aside>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <main
              id="workspace"
              className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="mx-auto flex w-full max-w-6xl flex-col gap-5"
                >
                  {moduleId ? (
                    <>
                      <div className="glass card-shimmer flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
                        <nav aria-label="Ruta de navegacion" className="flex items-center gap-2 text-xs text-graphite-300">
                          <Link to={`/${area}`} className="btn-jelly flex items-center gap-1.5 hover:text-aura-400">
                            <Home className="h-3.5 w-3.5 text-aura-400" />
                            Inicio
                          </Link>
                          <ChevronRight className="h-3.5 w-3.5 text-graphite-400" />
                          <span className="font-medium text-bone">{currentModule?.label ?? moduleId}</span>
                        </nav>
                        <div className="flex items-center gap-2">
                          <AuraBadge tone="info">Modo Clasico</AuraBadge>
                          <Link
                            to={`/${area}`}
                            className="btn-jelly neo inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-graphite-300 hover:text-aura-400"
                          >
                            <X className="h-3.5 w-3.5" /> Cerrar modulo
                          </Link>
                        </div>
                      </div>
                      <Outlet />
                    </>
                  ) : (
                    <ClassicDashboard
                      area={area}
                      firstName={firstName}
                      modules={modules}
                      themeLabel={AURA_THEMES[colorTheme].label}
                      contrastNote={AURA_THEMES[colorTheme].contrastNote}
                      onSwitchOrbital={() => setLayoutMode('orbital')}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            <div className="border-t border-white/10 bg-black/20 px-4 py-3 backdrop-blur">
              <div className="mx-auto flex max-w-4xl justify-center">
                <AuraCommandBar area={area} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none relative flex h-full flex-col">
      <a
        href="#workspace"
        className="pointer-events-auto sr-only z-50 rounded-lg bg-aura-500 px-3 py-2 text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <ShellHud area={area} />
      <GestureController area={area} />

      <div className="relative flex-1 overflow-hidden">
        {!isMobile && !moduleId && <OrbitalNav area={area} modules={modules} />}

        {!moduleId && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className={cn(
              'absolute inset-x-0 text-center',
              isMobile ? 'top-[46%] px-6' : 'bottom-6',
            )}
          >
            <p className="hud-label text-aura-400">AURA en linea</p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-bone md:text-3xl">Hola, {firstName}</h1>
            <p className="mt-1 text-sm text-graphite-300">Elige un modulo o pregunta a AURA.</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {moduleId && (
            <motion.main
              id="workspace"
              key={location.pathname}
              initial={{ opacity: 0, x: isMobile ? 0 : 40, y: isMobile ? 20 : 0 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: isMobile ? 0 : 40, y: isMobile ? 20 : 0 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className={cn(
                'pointer-events-auto absolute overflow-y-auto',
                isMobile
                  ? 'inset-x-2.5 bottom-2 top-2'
                  : cn('bottom-6 right-6 top-2', wide ? 'w-[min(920px,68vw)]' : 'w-[min(640px,52vw)]'),
              )}
            >
              <div className="relative">
                <Link
                  to={`/${area}`}
                  aria-label="Cerrar modulo y volver al nucleo"
                  className="btn-jelly neo absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-xl text-graphite-300 hover:text-aura-400 sm:right-4 sm:top-4 sm:h-9 sm:w-9"
                >
                  <X className="h-4 w-4" />
                </Link>
                <Outlet />
              </div>
            </motion.main>
          )}
        </AnimatePresence>
      </div>

      {isMobile && (
        <nav aria-label="Modulos de AURA" className="pointer-events-auto shrink-0 overflow-x-auto px-2.5 pb-1.5 pt-1">
          <ul className="flex gap-1.5">
            {modules.map(({ id, label, icon: Icon }) => (
              <li key={id} className="shrink-0">
                <NavLink
                  to={`/${area}/${id}`}
                  className={({ isActive }) =>
                    cn(
                      'btn-jelly neo flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium',
                      isActive ? 'border border-aura-500/40 bg-aura-500/15 text-aura-400' : 'text-graphite-300',
                    )
                  }
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="whitespace-nowrap">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="flex shrink-0 justify-center px-2.5 pb-3 pt-1 md:pb-6">
        <AuraCommandBar area={area} />
      </div>
    </div>
  )
}

function ClassicDashboard({
  area,
  firstName,
  modules,
  themeLabel,
  contrastNote,
  onSwitchOrbital,
}: {
  area: AuraArea
  firstName: string
  modules: AuraModule[]
  themeLabel: string
  contrastNote: string
  onSwitchOrbital: () => void
}) {
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <section className="card-3d card-shimmer card-stagger flex flex-col justify-between gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-6">
        <div className="min-w-0 flex-1">
          <p className="hud-label text-aura-400">Sistema AURA — Modo Clasico</p>
          <h1 className="mt-1 font-display text-xl font-bold text-bone sm:text-2xl">
            Bienvenido, {firstName}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-graphite-300 sm:text-sm">
            {contrastNote}. Navega desde el cajon lateral animado o selecciona una tarjeta 3D.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AuraBadge tone="aura">{themeLabel}</AuraBadge>
          <AuraButton size="sm" variant="neo" icon={Orbit} onClick={onSwitchOrbital}>
            Ver en Modo Orbital 3D
          </AuraButton>
        </div>
      </section>

      <section aria-label="Modulos disponibles">
        <h2 className="hud-label mb-3 text-aura-400">Modulos del Sistema ({modules.length})</h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {modules.map(({ id, label, description, icon: Icon }, idx) => (
            <Link
              key={id}
              to={`/${area}/${id}`}
              style={{ '--stagger': idx + 1 } as CSSProperties}
              className="card-3d card-shimmer card-stagger group flex h-full min-h-[136px] flex-col justify-between gap-3.5 p-4 sm:min-h-[154px] sm:gap-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="icon-orb-3d flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-aura-400 transition duration-300 group-hover:scale-110 sm:h-12 sm:w-12">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="neo flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-graphite-400 transition group-hover:translate-x-1 group-hover:text-aura-400">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-bone transition group-hover:text-aura-400">
                  {label}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-graphite-300">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
