import { CircleHelp, Sparkles } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'

export interface AuraInfoBubbleProps {
  title: string
  explanation: string
  benefit?: string
  example?: string
  label?: string
  className?: string
}

/**
 * Boton de informacion con globo explicativo flotante al pasar el cursor (hover) o enfocar con teclado.
 * Se renderiza en un Portal sobre document.body para no recortarse nunca dentro de tarjetas con overflow-hidden.
 */
export function AuraInfoBubble({
  title,
  explanation,
  benefit,
  example,
  label,
  className,
}: AuraInfoBubbleProps) {
  const tooltipId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeTimeout = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; placeBelow: boolean }>({
    top: 0,
    left: 0,
    placeBelow: false,
  })

  const updatePosition = () => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const bubbleWidth = 310
    const placeBelow = rect.top < 210
    const rawLeft = rect.left + rect.width / 2
    const clampedLeft = Math.max(
      bubbleWidth / 2 + 12,
      Math.min(window.innerWidth - bubbleWidth / 2 - 12, rawLeft),
    )
    setCoords({
      top: placeBelow ? rect.bottom + 12 : rect.top - 12,
      left: clampedLeft,
      placeBelow,
    })
  }

  const handleOpen = () => {
    if (closeTimeout.current) {
      window.clearTimeout(closeTimeout.current)
      closeTimeout.current = null
    }
    updatePosition()
    setOpen(true)
  }

  const handleClose = () => {
    closeTimeout.current = window.setTimeout(() => {
      setOpen(false)
    }, 110)
  }

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (closeTimeout.current) window.clearTimeout(closeTimeout.current)
    }
  }, [])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        aria-label={label ? `Informacion: ${label}` : `Que significa: ${title}`}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        onClick={(e) => {
          e.stopPropagation()
          if (open) setOpen(false)
          else handleOpen()
        }}
        className={cn(
          'btn-jelly inline-flex items-center gap-1 rounded-full border border-aura-500/35 bg-aura-500/12 px-2 py-0.5 text-[11px] font-medium text-aura-400 transition hover:border-aura-400 hover:bg-aura-500/25 hover:text-bone',
          className,
        )}
      >
        <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {label && <span>{label}</span>}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            onMouseEnter={handleOpen}
            onMouseLeave={handleClose}
            style={{
              top: coords.top,
              left: coords.left,
              transform: coords.placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            }}
            className="modal-surface pointer-events-auto fixed z-[90] w-[310px] rounded-2xl p-4 text-left shadow-2xl transition-opacity duration-150"
          >
            {/* Punta del globo */}
            <span
              aria-hidden="true"
              className={cn(
                ' absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-aura-400/45 bg-graphite-900',
                coords.placeBelow ? '-top-1.5 border-l border-t' : '-bottom-1.5 border-b border-r',
              )}
            />

            <div className="relative flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-aura-400" aria-hidden="true" />
                <p className="font-display text-xs font-bold text-bone">{title}</p>
              </div>

              <p className="text-xs leading-relaxed text-graphite-300">{explanation}</p>

              {benefit && (
                <div className="rounded-xl border border-aura-500/25 bg-aura-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-bone">
                  <strong className="text-aura-400">Como te ayuda: </strong>
                  {benefit}
                </div>
              )}

              {example && (
                <p className="rounded-lg bg-black/35 px-2.5 py-1.5 text-[11px] leading-snug text-sky-300">
                  <strong className="text-bone">En palabras simples: </strong>
                  {example}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
