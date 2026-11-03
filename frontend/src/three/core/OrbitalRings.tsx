import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, type Group } from 'three'
import { useAuraStore } from '@/store/auraStore'
import { AURA_THEMES, useUiStore } from '@/store/uiStore'
import { CORE_PRESETS } from '@/three/core/statePresets'

const RINGS = [
  { radius: 1.55, tilt: [1.2, 0.2, 0], speed: 1, opacity: 0.55, satellite: true },
  { radius: 1.85, tilt: [1.75, -0.5, 0.3], speed: -0.7, opacity: 0.32, satellite: true },
  { radius: 2.2, tilt: [1.45, 0.9, -0.2], speed: 0.45, opacity: 0.18, satellite: false },
] as const

export function OrbitalRings({ motion }: { motion: number }) {
  const groups = useRef<(Group | null)[]>([])
  const colorTheme = useUiStore((s) => s.colorTheme)
  const palette = AURA_THEMES[colorTheme]

  useFrame((_, delta) => {
    const frameDelta = Math.min(delta, 0.05)
    const { ringSpeed } = CORE_PRESETS[useAuraStore.getState().coreState]
    groups.current.forEach((group, i) => {
      if (group) group.rotation.z += frameDelta * ringSpeed * (RINGS[i]?.speed ?? 1) * motion
    })
  })

  return (
    <>
      {RINGS.map((ring, i) => (
        <group key={ring.radius} rotation={[ring.tilt[0], ring.tilt[1], ring.tilt[2]]}>
          <group
            ref={(el) => {
              groups.current[i] = el
            }}
          >
            <mesh>
              <torusGeometry args={[ring.radius, 0.0065, 8, 144]} />
              <meshBasicMaterial
                color={palette.ring}
                transparent
                opacity={ring.opacity}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            {ring.satellite && (
              <mesh position={[ring.radius, 0, 0]}>
                <sphereGeometry args={[0.035, 16, 16]} />
                <meshBasicMaterial color={palette.secondarySwatch} />
              </mesh>
            )}
          </group>
        </group>
      ))}
    </>
  )
}
