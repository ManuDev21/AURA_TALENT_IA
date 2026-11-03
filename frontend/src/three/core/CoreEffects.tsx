import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Group, type LineLoop, type Mesh, type MeshBasicMaterial } from 'three'
import { useAuraStore } from '@/store/auraStore'
import { AURA_THEMES, useUiStore } from '@/store/uiStore'

/** Onda expansiva al completar una accion (SUCCESS, WARNING, ERROR). */
export function Shockwave() {
  const ring = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const state = useRef({ seen: 0, t: 1 })
  useFrame((_, delta) => {
    const frameDelta = Math.min(delta, 0.05)
    const { shockwave } = useAuraStore.getState()
    if (shockwave.id !== state.current.seen) {
      state.current = { seen: shockwave.id, t: 0 }
      material.current?.color.set(shockwave.color)
    }
    const s = state.current
    s.t = Math.min(1, s.t + frameDelta / 1.1)
    const eased = 1 - (1 - s.t) ** 3
    if (ring.current) ring.current.scale.setScalar(1.1 + eased * 2.4)
    if (material.current) material.current.opacity = s.t >= 1 ? 0 : (1 - eased) * 0.75
  })
  return (
    <mesh ref={ring} rotation={[Math.PI / 2.15, 0, 0]}>
      <torusGeometry args={[1, 0.018, 8, 160]} />
      <meshBasicMaterial ref={material} color="#ffb547" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
    </mesh>
  )
}

const WAVE_POINTS = 192

/** Anillo de voz: se deforma con el nivel de audio real mientras AURA escucha o habla. */
export function VoiceRing({ motion }: { motion: number }) {
  const line = useRef<LineLoop>(null)
  const colorTheme = useUiStore((s) => s.colorTheme)
  const palette = AURA_THEMES[colorTheme]
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(WAVE_POINTS * 3), 3))
    return g
  }, [])
  const level = useRef(0)
  const elapsed = useRef(0)
  const color = useMemo(() => new Color(palette.ring), [palette.ring])
  useFrame((_, delta) => {
    const frameDelta = Math.min(delta, 0.05)
    const { audioLevel, coreState } = useAuraStore.getState()
    const active =
      coreState === 'LISTENING' ||
      coreState === 'SPEAKING' ||
      coreState === 'GESTURE' ||
      coreState === 'SUCCESS' ||
      coreState === 'THINKING' ||
      coreState === 'ANALYZING'
    const baseEnergy = coreState === 'GESTURE' || coreState === 'SUCCESS' ? 0.38 : 0.25
    elapsed.current += frameDelta * motion
    level.current += ((active ? baseEnergy + audioLevel : 0) - level.current) * Math.min(1, frameDelta * 10)
    const material = line.current?.material as MeshBasicMaterial | undefined
    if (!active && level.current < 0.005) {
      if (material) material.opacity = 0
      return
    }
    const t = elapsed.current
    const pos = geometry.attributes.position as BufferAttribute
    for (let i = 0; i < WAVE_POINTS; i++) {
      const a = (i / WAVE_POINTS) * Math.PI * 2
      const wave = Math.sin(a * 6 + t * 5) * 0.5 + Math.sin(a * 11 - t * 7) * 0.3 + Math.sin(a * 3 + t * 2) * 0.2
      const r = 1.32 + wave * 0.11 * level.current
      pos.setXYZ(i, Math.cos(a) * r, Math.sin(a) * r, 0)
    }
    pos.needsUpdate = true
    if (material) {
      material.opacity = Math.min(0.88, level.current * 1.25)
      material.color.copy(color).offsetHSL(coreState === 'SPEAKING' || coreState === 'GESTURE' ? 0.025 : 0, 0, 0)
    }
  })
  return (
    <lineLoop ref={line} geometry={geometry}>
      <lineBasicMaterial color="#ffb547" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
    </lineLoop>
  )
}

/** Satelites de notificaciones: cada aviso sin leer orbita el nucleo hasta que se lee. */
export function NotificationSatellites({ motion }: { motion: number }) {
  const group = useRef<Group>(null)
  const elapsed = useRef(0)
  const unread = useAuraStore((s) => s.unread)
  const count = Math.min(6, unread)
  useFrame((_, delta) => {
    if (!group.current) return
    const frameDelta = Math.min(delta, 0.05)
    elapsed.current += frameDelta
    group.current.rotation.y += frameDelta * 0.6 * motion
    group.current.children.forEach((child, i) => {
      const s = 1 + Math.sin(elapsed.current * 3 + i) * 0.25
      child.scale.setScalar(s)
    })
  })
  return (
    <group ref={group} rotation={[0.35, 0, 0.15]}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / Math.max(1, count)) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 2.05, Math.sin(a * 2) * 0.18, Math.sin(a) * 2.05]}>
            <sphereGeometry args={[0.03, 16, 16]} />
            <meshBasicMaterial color="#ff7a1a" />
          </mesh>
        )
      })}
    </group>
  )
}
