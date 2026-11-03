import gsap from 'gsap'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/useMediaQuery'
import { useAuraStore } from '@/store/auraStore'
import { BOOT_STORAGE_KEY } from '@/aura/bootState'
const STATUS_LINES = ['INITIALIZING...', 'VISION ONLINE', 'VOICE ONLINE', 'AI CORE ONLINE', 'AURA READY']

/** Secuencia de activacion: una vez por sesion, se puede omitir con Esc o clic. */
export function BootSequence({ onFinish }: { onFinish: () => void }) {
  const [visible, setVisible] = useState(() => sessionStorage.getItem(BOOT_STORAGE_KEY) !== '1')
  const root = useRef<HTMLDivElement>(null)
  const finished = useRef(false)
  const reducedMotion = useReducedMotion()

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    sessionStorage.setItem(BOOT_STORAGE_KEY, '1')
    setVisible(false)
    useAuraStore.getState().pulse('SUCCESS', 1800)
    onFinish()
  }, [onFinish])

  useLayoutEffect(() => {
    if (!visible || !root.current) return
    const overlay = root.current
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: finish })
      if (reducedMotion) {
        tl.from('[data-boot="title"]', { opacity: 0, duration: 0.3 }).to(overlay, { opacity: 0, duration: 0.3, delay: 0.5 })
        return
      }
      tl.fromTo('[data-boot="dot"]', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out' })
        .to('[data-boot="dot"]', { scale: 14, opacity: 0, duration: 0.7, ease: 'expo.out' })
        .fromTo(
          '[data-boot="ring"]',
          { scale: 0.3, opacity: 0, rotate: -50 },
          { scale: 1, opacity: 1, rotate: 0, duration: 0.8, stagger: 0.08, ease: 'expo.out' },
          '<0.1',
        )
        .fromTo(
          '[data-boot="letter"]',
          { opacity: 0, y: 12, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.07, ease: 'power3.out' },
          '-=0.45',
        )
        .fromTo('[data-boot="line"]', { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.16, stagger: 0.2 }, '+=0.05')
        .to(overlay, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, '+=0.35')
    }, overlay)
    return () => ctx.revert()
  }, [visible, reducedMotion, finish])

  useEffect(() => {
    if (!visible) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, finish])

  if (!visible) return null

  return (
    <div
      ref={root}
      role="dialog"
      aria-label="Activando AURA"
      className="fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center bg-void"
      onClick={finish}
    >
      <div className="relative flex h-72 w-72 items-center justify-center">
        <span data-boot="dot" className="absolute h-4 w-4 rounded-full bg-aura-500 shadow-[0_0_40px_10px_rgb(255_122_26/0.8)]" />
        <span data-boot="ring" className="absolute inset-0 rounded-full border border-aura-500/50" />
        <span data-boot="ring" className="absolute inset-6 rounded-full border border-amber-glow/40 [border-style:dashed]" />
        <span data-boot="ring" className="absolute inset-14 rounded-full border border-aura-500/70 shadow-[0_0_40px_-8px_rgb(255_122_26/0.8)]" />
        <h1 data-boot="title" className="relative flex gap-3 font-display text-5xl font-semibold text-bone text-glow">
          {'AURA'.split('').map((letter, i) => (
            <span key={i} data-boot="letter">
              {letter}
            </span>
          ))}
        </h1>
      </div>
      <ul className="mt-6 flex h-32 flex-col items-center gap-1.5" aria-live="polite">
        {STATUS_LINES.map((line, i) => (
          <li
            key={line}
            data-boot="line"
            className={i === STATUS_LINES.length - 1 ? 'hud-label text-aura-400 text-glow' : 'hud-label text-graphite-300'}
          >
            {line}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={finish}
        className="hud-label absolute bottom-6 right-6 rounded-lg px-3 py-2 text-graphite-400 hover:text-bone"
      >
        Omitir (Esc)
      </button>
    </div>
  )
}
