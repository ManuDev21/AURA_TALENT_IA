import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/hooks/useMediaQuery'
import { useAuraStore } from '@/store/auraStore'
import { AURA_THEMES, useUiStore } from '@/store/uiStore'
import { AuraCore } from '@/three/core/AuraCore'
import { initialQualityTier, type QualityTier } from '@/three/quality'

const DOWNGRADE: Record<QualityTier, QualityTier> = { high: 'medium', medium: 'low', low: 'low' }

/**
 * Lienzo 3D persistente optimizado en 1 solo pase de renderizado directo (sin post-procesado multipase pesado)
 * y sin vineta lateral para que el nucleo AURA conserve todo su brillo y color al abrir cualquier modulo.
 */
export function AuraCanvas() {
  const reducedMotion = useReducedMotion()
  const [tier, setTier] = useState<QualityTier>(initialQualityTier)
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState === 'visible')

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    let rafId = 0
    let lastX = 0
    let lastY = 0
    const onMove = (e: PointerEvent) => {
      lastX = (e.clientX / window.innerWidth) * 2 - 1
      lastY = (e.clientY / window.innerHeight) * 2 - 1
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        useAuraStore.getState().setGaze(lastX, lastY)
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [])

  const colorTheme = useUiStore((s) => s.colorTheme)
  const palette = AURA_THEMES[colorTheme]

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        frameloop={pageVisible ? 'always' : 'demand'}
        dpr={tier === 'high' ? [1, 1.25] : 1}
        camera={{ position: [0, 0, 6.2], fov: 45 }}
        gl={{ antialias: tier !== 'low', powerPreference: 'high-performance', alpha: false, stencil: false }}
      >
        <color attach="background" args={[palette.canvasBg]} />
        <PerformanceMonitor onDecline={() => setTier((t) => DOWNGRADE[t])} />
        <AuraCore tier={tier} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
