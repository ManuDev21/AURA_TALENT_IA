import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BackSide, Color, type Group } from 'three'
import { type AuraCoreState, useAuraStore } from '@/store/auraStore'
import { AURA_THEMES, useUiStore } from '@/store/uiStore'
import { NotificationSatellites, Shockwave, VoiceRing } from '@/three/core/CoreEffects'
import { OrbitalRings } from '@/three/core/OrbitalRings'
import { ParticleField } from '@/three/core/ParticleField'
import {
  coreFragmentShader,
  coreVertexShader,
  haloFragmentShader,
  haloVertexShader,
} from '@/three/core/shaders'
import { CORE_PRESETS } from '@/three/core/statePresets'
import { PARTICLE_COUNT, type QualityTier } from '@/three/quality'

interface AuraCoreProps {
  tier: QualityTier
  reducedMotion: boolean
}

const SMOOTH = 0.35

export function AuraCore({ tier, reducedMotion }: AuraCoreProps) {
  const root = useRef<Group>(null)
  const spin = useRef(0)
  const motion = reducedMotion ? 0.2 : 1
  const segments = tier === 'high' ? 36 : tier === 'medium' ? 28 : 20

  const colorTheme = useUiStore((s) => s.colorTheme)
  const palette = AURA_THEMES[colorTheme]

  const colors = useMemo(() => {
    const entries = Object.entries(CORE_PRESETS).map(([state, p]) => {
      const useThemeColor = state !== 'ERROR' && state !== 'WARNING'
      return [
        state,
        {
          a: new Color(useThemeColor ? palette.coreA : p.colorA),
          b: new Color(useThemeColor ? palette.coreB : p.colorB),
        },
      ]
    })
    return Object.fromEntries(entries) as Record<AuraCoreState, { a: Color; b: Color }>
  }, [palette])

  const coreUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmplitude: { value: CORE_PRESETS.IDLE.amplitude },
      uFrequency: { value: CORE_PRESETS.IDLE.frequency },
      uSpeed: { value: CORE_PRESETS.IDLE.speed },
      uEnergy: { value: CORE_PRESETS.IDLE.energy },
      uRim: { value: CORE_PRESETS.IDLE.rim },
      uScan: { value: 0 },
      uAudio: { value: 0 },
      uColorA: { value: new Color(CORE_PRESETS.IDLE.colorA) },
      uColorB: { value: new Color(CORE_PRESETS.IDLE.colorB) },
    }),
    [],
  )

  const haloUniforms = useMemo(
    () => ({
      uColor: { value: new Color(CORE_PRESETS.IDLE.colorB) },
      uIntensity: { value: CORE_PRESETS.IDLE.halo },
    }),
    [],
  )

  useFrame((_, delta) => {
    const frameDelta = Math.min(delta, 0.05)
    const { coreState, placement, audioLevel } = useAuraStore.getState()
    const preset = CORE_PRESETS[coreState]
    const target = colors[coreState]
    const calm = reducedMotion ? 0.5 : 1

    coreUniforms.uTime.value += frameDelta * motion
    easing.damp(coreUniforms.uAmplitude, 'value', preset.amplitude * calm, SMOOTH, frameDelta)
    easing.damp(coreUniforms.uFrequency, 'value', preset.frequency, SMOOTH, frameDelta)
    easing.damp(coreUniforms.uSpeed, 'value', preset.speed, SMOOTH, frameDelta)
    easing.damp(coreUniforms.uEnergy, 'value', preset.energy, SMOOTH, frameDelta)
    easing.damp(coreUniforms.uRim, 'value', preset.rim, SMOOTH, frameDelta)
    easing.damp(coreUniforms.uScan, 'value', preset.scan, SMOOTH, frameDelta)
    easing.damp(coreUniforms.uAudio, 'value', audioLevel * calm, 0.08, frameDelta)
    easing.dampC(coreUniforms.uColorA.value, target.a, SMOOTH, frameDelta)
    easing.dampC(coreUniforms.uColorB.value, target.b, SMOOTH, frameDelta)
    easing.dampC(haloUniforms.uColor.value, target.b, SMOOTH, frameDelta)
    easing.damp(haloUniforms.uIntensity, 'value', preset.halo, SMOOTH, frameDelta)

    const group = root.current
    if (!group) return
    const breathing = 1 + Math.sin(coreUniforms.uTime.value * 1.1) * 0.018 * motion
    const scale = placement.scale * preset.scale * breathing * (1 + coreUniforms.uAudio.value * 0.12)
    easing.damp3(group.position, [placement.x, placement.y, 0], 0.6, frameDelta)
    easing.damp3(group.scale, [scale, scale, scale], 0.45, frameDelta)
    // Mirada: el nucleo se orienta suavemente hacia el puntero o el cursor de gestos
    const { gaze } = useAuraStore.getState()
    const look = reducedMotion ? 0.1 : 0.35
    easing.damp(group.rotation, 'x', -gaze.y * look, 0.5, frameDelta)
    spin.current += frameDelta * 0.05 * motion
    easing.damp(group.rotation, 'y', spin.current + gaze.x * look, 0.5, frameDelta)
  })

  return (
    <group ref={root}>
      <mesh>
        <icosahedronGeometry args={[1, tier === 'high' ? 10 : tier === 'medium' ? 7 : 5]} />
        <shaderMaterial
          uniforms={coreUniforms}
          vertexShader={coreVertexShader}
          fragmentShader={coreFragmentShader}
        />
      </mesh>
      <mesh scale={1.52}>
        <sphereGeometry args={[1, segments, segments]} />
        <shaderMaterial
          uniforms={haloUniforms}
          vertexShader={haloVertexShader}
          fragmentShader={haloFragmentShader}
          side={BackSide}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <OrbitalRings motion={motion} />
      <VoiceRing motion={motion} />
      <Shockwave />
      <NotificationSatellites motion={motion} />
      <ParticleField count={PARTICLE_COUNT[tier]} motion={motion} />
    </group>
  )
}
