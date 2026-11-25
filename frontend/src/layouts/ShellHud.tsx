import {
  Check,
  Download,
  EllipsisVertical,
  Hand,
  LayoutDashboard,
  LogOut,
  Orbit,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  WandSparkles,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { CoreStatus } from '@/aura/CoreStatus'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { useLogout } from '@/features/auth/useAuthActions'
import { SystemSimulationTourModal } from '@/features/simulation/SystemSimulationTour'
import { useGestureStore } from '@/gestures/gestureStore'
import { LanguageSelectorButton } from '@/i18n/liveTranslator'
import { NotificationBell } from '@/layouts/NotificationBell'
import { useInstallPrompt } from '@/pwa/useInstallPrompt'
import { useAuraStore } from '@/store/auraStore'
import { useSessionStore } from '@/store/sessionStore'
import { AURA_THEMES, type AuraColorTheme, type AuraLayoutMode, useUiStore } from '@/store/uiStore'
import { cn } from '@/utils/cn'
import { type AuraArea, primaryRoleLabel } from '@/utils/roles'

const AREA_LABEL: Record<AuraArea, string> = {
  candidate: 'Espacio personal',
  company: 'Espacio empresa',
  admin: 'Panel de administracion',
}

const THEME_LIST = Object.values(AURA_THEMES)

export function ShellHud({ area }: { area: AuraArea }) {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const { canInstall, install } = useInstallPrompt()
  const gestures = useGestureStore((s) => s.enabled)
  const setGestures = useGestureStore((s) => s.setEnabled)

  const colorTheme = useUiStore((s) => s.colorTheme)
  const setColorTheme = useUiStore((s) => s.setColorTheme)
  const layoutMode = useUiStore((s) => s.layoutMode)
  const toggleLayoutMode = useUiStore((s) => s.toggleLayoutMode)
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [simulationOpen, setSimulationOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!paletteOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPaletteOpen(false)
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [paletteOpen])

  const handleSelectTheme = (theme: AuraColorTheme) => {
    setColorTheme(theme)
    useAuraStore.getState().pulse('SUCCESS', 900)
    setPaletteOpen(false)
  }

  return (
    <header
      className={cn(
        'pointer-events-auto relative z-30 flex items-center justify-between gap-2 px-3 py-2.5 transition-all sm:gap-3 sm:px-4 sm:py-3 md:px-6',
        layoutMode === 'clasico' && 'glass border-x-0 border-t-0 border-b border-aura-500/25',
      )}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {layoutMode === 'clasico' && (
          <AuraButton
            variant="neo"
            size="icon"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Ocultar menu lateral' : 'Mostrar menu lateral'}
            title={sidebarOpen ? 'Ocultar menu lateral' : 'Mostrar menu lateral'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </AuraButton>
        )}
        <Link to={`/${area}`} className="flex shrink-0 items-center gap-2 rounded-lg" aria-label="Volver al inicio de AURA">
          <img src="/aura.svg" alt="" className="h-7 w-7 sm:h-8 sm:w-8" />
          <span className="font-display text-base font-semibold tracking-wide text-bone sm:text-lg">AURA</span>
        </Link>
        <span className="hidden h-4 w-px bg-white/10 md:block" aria-hidden="true" />
        <div className="hidden md:block">
          <CoreStatus />
        </div>
      </div>

      <p className="hud-label hidden text-graphite-400 xl:block">{AREA_LABEL[area]}</p>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <LanguageSelectorButton />

        <div className="hidden items-center gap-2 md:flex">
          <AuraButton
            variant="neo"
            size="sm"
            icon={WandSparkles}
            onClick={() => setSimulationOpen(true)}
            title="Ver guia paso a paso de como funciona la plataforma"
            className="px-2.5 sm:px-3"
          >
            <span className="hidden xl:inline">Recorrido guiado</span>
          </AuraButton>

          <div ref={menuRef} className="relative">
            <AuraButton
              variant="neo"
              size="sm"
              icon={Palette}
              aria-expanded={paletteOpen}
              aria-haspopup="menu"
              aria-label="Cambiar color del sistema"
              title="Cambiar color del sistema (6 temas disponibles)"
              onClick={() => setPaletteOpen((o) => !o)}
              className="px-2.5 sm:px-3"
            >
              <span
                className="h-2.5 w-2.5 rounded-full border border-white/30"
                style={{ backgroundColor: AURA_THEMES[colorTheme].swatch }}
                aria-hidden="true"
              />
              <span className="hidden md:inline">Color: {AURA_THEMES[colorTheme].shortLabel}</span>
            </AuraButton>

            {paletteOpen && (
            <div
              role="menu"
              aria-label="Seleccionar tema de color del sistema"
              className="modal-glass absolute right-0 top-12 z-50 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-1.5 rounded-2xl p-3"
            >
              <p className="hud-label px-2 py-1 text-aura-400">Paletas de Alto Impacto (6 temas)</p>
              {THEME_LIST.map((theme) => {
                const active = colorTheme === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => handleSelectTheme(theme.id)}
                    className={cn(
                      'btn-jelly flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition',
                      active
                        ? 'border border-aura-500/45 bg-aura-500/20 font-semibold text-bone'
                        : 'border border-transparent text-graphite-300 hover:bg-white/5 hover:text-bone',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex shrink-0 items-center -space-x-1.5">
                        <span
                          className="h-4 w-4 rounded-full border border-white/40 shadow-sm"
                          style={{ backgroundColor: theme.swatch }}
                        />
                        <span
                          className="h-4 w-4 rounded-full border border-white/40 shadow-sm"
                          style={{ backgroundColor: theme.secondarySwatch }}
                        />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-bone">{theme.label}</span>
                        <span className="truncate text-[10px] font-normal text-graphite-400">
                          {theme.contrastNote}
                        </span>
                      </span>
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0 text-aura-400" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

          <AuraButton
            variant="neo"
            size="sm"
            icon={layoutMode === 'orbital' ? LayoutDashboard : Orbit}
            onClick={() => {
              toggleLayoutMode()
              useAuraStore.getState().pulse('SUCCESS', 800)
            }}
            aria-label={layoutMode === 'orbital' ? 'Cambiar a diseno clasico con menu' : 'Cambiar a diseno orbital 3D'}
            title={layoutMode === 'orbital' ? 'Cambiar a diseno clasico (Navbar + Menu ocultable)' : 'Volver a diseno orbital 3D'}
          >
            <span className="hidden sm:inline">
              {layoutMode === 'orbital' ? 'Diseno Clasico' : 'Diseno Orbital'}
            </span>
          </AuraButton>

          {canInstall && (
            <AuraButton variant="neo" size="sm" icon={Download} onClick={() => void install()}>
              <span className="hidden lg:inline">Instalar app</span>
            </AuraButton>
          )}

          <AuraButton
            variant="neo"
            size="icon"
            aria-pressed={gestures}
            aria-label={gestures ? 'Desactivar control por gestos' : 'Activar control por gestos'}
            title={gestures ? 'Desactivar control por gestos' : 'Control por gestos (camara)'}
            className={cn(gestures && 'text-aura-400 shadow-[0_0_20px_-4px_var(--color-aura-500)]')}
            onClick={() => setGestures(!gestures)}
          >
            <Hand className="h-4 w-4" />
          </AuraButton>
        </div>

        <MobileMoreMenu
          colorTheme={colorTheme}
          gestures={gestures}
          layoutMode={layoutMode}
          canInstall={canInstall}
          onSelectTheme={handleSelectTheme}
          onToggleGestures={() => setGestures(!gestures)}
          onToggleLayout={() => {
            toggleLayoutMode()
            useAuraStore.getState().pulse('SUCCESS', 800)
          }}
          onOpenTour={() => setSimulationOpen(true)}
          onInstall={() => void install()}
        />

        <NotificationBell />

        <div className="hidden text-right sm:block">
          <p className="text-sm leading-tight text-bone">{user?.full_name}</p>
          <AuraBadge tone="neutral" className="mt-1">
            {primaryRoleLabel(user)}
          </AuraBadge>
        </div>

        <AuraButton
          variant="neo"
          size="icon"
          aria-label="Cerrar sesion"
          title="Cerrar sesion"
          onClick={() => void logout()}
        >
          <LogOut className="h-4 w-4" />
        </AuraButton>
      </div>

      <SystemSimulationTourModal
        open={simulationOpen}
        onCloseAndRestore={() => setSimulationOpen(false)}
      />
    </header>
  )
}

/**
 * En pantallas chicas la barra superior solo muestra idioma, notificaciones y
 * salir; todo lo demas (tema, vista, gestos, instalacion, guia) se agrupa en
 * este menu para no saturar el HUD.
 */
function MobileMoreMenu({
  colorTheme,
  gestures,
  layoutMode,
  canInstall,
  onSelectTheme,
  onToggleGestures,
  onToggleLayout,
  onOpenTour,
  onInstall,
}: {
  colorTheme: AuraColorTheme
  gestures: boolean
  layoutMode: AuraLayoutMode
  canInstall: boolean
  onSelectTheme: (t: AuraColorTheme) => void
  onToggleGestures: () => void
  onToggleLayout: () => void
  onOpenTour: () => void
  onInstall: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const item =
    'btn-jelly flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-graphite-300 transition hover:bg-white/5 hover:text-bone'

  return (
    <div ref={ref} className="relative md:hidden">
      <AuraButton
        variant="neo"
        size="icon"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Mas opciones"
        title="Mas opciones"
        onClick={() => setOpen((o) => !o)}
      >
        <EllipsisVertical className="h-4 w-4" />
      </AuraButton>

      {open && (
        <div
          role="menu"
          aria-label="Opciones adicionales del sistema"
          className="modal-surface absolute right-0 top-12 z-50 flex w-64 max-w-[calc(100vw-1.5rem)] flex-col gap-1 rounded-2xl p-3"
        >
          <p className="hud-label px-2 py-1 text-aura-400">Color del sistema</p>
          <div className="flex items-center gap-2 px-3 pb-2">
            {THEME_LIST.map((theme) => (
              <button
                key={theme.id}
                type="button"
                role="menuitemradio"
                aria-checked={colorTheme === theme.id}
                aria-label={`Tema ${theme.label}`}
                title={theme.label}
                onClick={() => onSelectTheme(theme.id)}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition',
                  colorTheme === theme.id ? 'scale-110 border-aura-400' : 'border-white/25 hover:border-white/60',
                )}
                style={{ backgroundColor: theme.swatch }}
              />
            ))}
          </div>

          <button type="button" role="menuitem" className={item} onClick={() => { onToggleLayout(); setOpen(false) }}>
            {layoutMode === 'orbital' ? <LayoutDashboard className="h-4 w-4 text-aura-400" /> : <Orbit className="h-4 w-4 text-aura-400" />}
            {layoutMode === 'orbital' ? 'Diseno clasico' : 'Diseno orbital 3D'}
          </button>

          <button
            type="button"
            role="menuitem"
            aria-pressed={gestures}
            className={cn(item, gestures && 'text-aura-400')}
            onClick={() => { onToggleGestures(); setOpen(false) }}
          >
            <Hand className="h-4 w-4 text-aura-400" />
            {gestures ? 'Desactivar gestos (camara)' : 'Control por gestos (camara)'}
          </button>

          <button type="button" role="menuitem" className={item} onClick={() => { onOpenTour(); setOpen(false) }}>
            <WandSparkles className="h-4 w-4 text-aura-400" />
            Recorrido guiado
          </button>

          {canInstall && (
            <button type="button" role="menuitem" className={item} onClick={() => { onInstall(); setOpen(false) }}>
              <Download className="h-4 w-4 text-aura-400" />
              Instalar app
            </button>
          )}
        </div>
      )}
    </div>
  )
}
