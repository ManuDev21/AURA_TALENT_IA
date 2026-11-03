import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Points } from 'three'
import { useAuraStore } from '@/store/auraStore'
import { AURA_THEMES, useUiStore } from '@/store/uiStore'
import { particleFragmentShader, particleVertexShader } from '@/three/core/shaders'
import { CORE_PRESETS } from '@/three/core/statePresets'

interface ParticleFieldProps {
  count: number
  motion: number
}

export function ParticleField({ count, motion }: ParticleFieldProps) {
  const points = useRef<Points>(null)
  const pixelRatio = useThree((s) => s.viewport.dpr)

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // Distribucion en capa esferica, mas densa cerca del nucleo
      const radius = 1.45 + Math.pow(Math.random(), 1.8) * 2.6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.8
      positions[i * 3 + 2] = radius * Math.cos(phi)
      seeds[i] = Math.random()
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    return g
  }, [count])

  const colorTheme = useUiStore((s) => s.colorTheme)
  const palette = AURA_THEMES[colorTheme]

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 26 },
      uPixelRatio: { value: pixelRatio },
      uColor: { value: new Color(palette.particle) },
      uOpacity: { value: palette.isLight ? 0.55 : 0.75 },
    }),
    [pixelRatio, palette],
  )

  useFrame((_, delta) => {
    const frameDelta = Math.min(delta, 0.05)
    const preset = CORE_PRESETS[useAuraStore.getState().coreState]
    uniforms.uTime.value += frameDelta * motion
    if (points.current) {
      points.current.rotation.y += frameDelta * preset.particleSpeed * motion
      points.current.rotation.x += frameDelta * preset.particleSpeed * 0.25 * motion
    }
  })

  return (
    <points ref={points} geometry={geometry}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}
