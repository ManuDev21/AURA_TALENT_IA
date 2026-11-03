import { Html, Line, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Mesh } from 'three'
import { STATUS_COLOR, STATUS_LABEL } from '@/features/career/careerStatus'
import { useReducedMotion } from '@/hooks/useMediaQuery'
import type { CareerNode, CareerPath, NodeStatus } from '@/types/career'
import { cn } from '@/utils/cn'

const SIZE: Record<CareerNode['node_type'], number> = {
  profile: 0.55,
  role: 0.62,
  milestone: 0.4,
  project: 0.42,
  skill: 0.28,
  course: 0.22,
}

const NodeMesh = memo(function NodeMesh({
  node,
  selected,
  onSelect,
  reduced,
  traceOrder,
  activeSearch,
}: {
  node: CareerNode
  selected: boolean
  onSelect: () => void
  reduced: boolean
  traceOrder: number | null
  activeSearch: boolean
}) {
  const ref = useRef<Mesh>(null)
  const color = node.node_type === 'role' ? '#ffb547' : STATUS_COLOR[node.status]
  const seed = useMemo(() => node.position[1] * 3.1 + node.position[0], [node.position])
  useFrame(({ clock }) => {
    if (!ref.current || reduced || (!selected && !activeSearch)) return
    const t = clock.getElapsedTime()
    ref.current.position.y = node.position[1] + Math.sin(t * 0.8 + seed) * 0.05
    ref.current.rotation.y = t * 0.35
  })
  const size = SIZE[node.node_type]
  const emissive =
    node.status === 'acquired' || node.node_type === 'role' || node.node_type === 'profile'
      ? 0.9
      : node.status === 'in_progress'
        ? 0.5
        : 0.08
  return (
    <group position={[node.position[0], 0, node.position[2]]}>
      <mesh
        ref={ref}
        position={[0, node.position[1], 0]}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
        scale={selected ? 1.35 : 1}
      >
        {node.node_type === 'course' ? (
          <octahedronGeometry args={[size, 0]} />
        ) : node.node_type === 'project' || node.node_type === 'milestone' ? (
          <icosahedronGeometry args={[size, 0]} />
        ) : (
          <sphereGeometry args={[size, 16, 16]} />
        )}
        <meshStandardMaterial
          color={activeSearch ? '#ffb547' : color}
          emissive={activeSearch ? '#ff7a1a' : color}
          emissiveIntensity={activeSearch ? 2.4 : emissive}
          roughness={0.35}
          metalness={0.2}
          wireframe={node.status === 'gap'}
        />
      </mesh>
      <Html position={[0, node.position[1] - size - 0.28, 0]} center distanceFactor={11} zIndexRange={[10, 0]}>
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'max-w-40 truncate whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[10px] backdrop-blur',
            selected ? 'bg-aura-500/30 text-bone' : 'bg-black/60 text-graphite-300 hover:text-bone',
          )}
        >
          {traceOrder !== null && <span className="mr-1 text-aura-400">{traceOrder}.</span>}
          {node.label}
        </button>
      </Html>
    </group>
  )
})

export const CareerMap3D = memo(function CareerMap3D({
  path,
  selectedId,
  onSelect,
  searchPath = [],
  visitedOrder = [],
  activeSearchNode = null,
}: {
  path: CareerPath
  selectedId: string | null
  onSelect: (id: string | null) => void
  searchPath?: string[]
  visitedOrder?: string[]
  activeSearchNode?: string | null
}) {
  const reduced = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(true)
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState === 'visible')

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setInView(entry.isIntersecting)
      },
      { threshold: 0.05 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const byId = useMemo(() => new Map(path.nodes.map((n) => [n.id, n])), [path.nodes])
  const routeEdges = useMemo(() => new Set(searchPath.slice(1).map((id, i) => `${searchPath[i]}>${id}`)), [searchPath])
  const traceOrder = useMemo(() => new Map(visitedOrder.map((id, i) => [id, i + 1])), [visitedOrder])
  const goalNode = useMemo(() => [...path.nodes].reverse().find((n) => n.node_type === 'role') ?? null, [path.nodes])
  const focusNode = useMemo(() => {
    const id = activeSearchNode ?? selectedId
    if (!id) return null
    const found = byId.get(id) ?? null
    return found && goalNode && found.id !== goalNode.id ? found : null
  }, [activeSearchNode, selectedId, byId, goalNode])
  const geometryVectors = useMemo(() => {
    if (!focusNode || !goalNode) return null
    const [x1, y1, z1] = focusNode.position
    const [x2, y2, z2] = goalNode.position
    const dx = Math.abs(x1 - x2)
    const dy = Math.abs(y1 - y2)
    const manhattan = dx + dy
    const euclidean = Math.hypot(dx, dy)
    const corner: [number, number, number] = [x2, y1, (z1 + z2) / 2]
    const midEuclidean: [number, number, number] = [(x1 + x2) / 2, (y1 + y2) / 2 + 0.35, (z1 + z2) / 2]
    return {
      start: [x1, y1, z1] as [number, number, number],
      corner,
      goal: [x2, y2, z2] as [number, number, number],
      midEuclidean,
      dx: dx.toFixed(2),
      dy: dy.toFixed(2),
      manhattan: manhattan.toFixed(2),
      euclidean: euclidean.toFixed(2),
    }
  }, [focusNode, goalNode])

  const canvasActive = inView && tabVisible

  return (
    <div ref={containerRef} className="neo-inset relative h-[28rem] overflow-hidden rounded-2xl" aria-hidden="true">
      <Canvas
        frameloop={canvasActive ? 'always' : 'demand'}
        camera={{ position: [0, 3, 15.5], fov: 50 }}
        dpr={[1, 1.35]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        onPointerMissed={() => onSelect(null)}
      >
        <color attach="background" args={['#08080a']} />
        <fog attach="fog" args={['#08080a', 14, 26]} />
        <ambientLight intensity={0.35} />
        <pointLight position={[0, 6, 6]} intensity={40} color="#ffb547" />
        <pointLight position={[-8, -4, 4]} intensity={18} color="#ff7a1a" />
        {geometryVectors && (
          <group>
            <Line
              points={[geometryVectors.start, geometryVectors.corner, geometryVectors.goal]}
              color="#ff7a1a"
              lineWidth={2.2}
              dashed
              dashSize={0.22}
              gapSize={0.14}
              transparent
              opacity={0.9}
            />
            <Line
              points={[geometryVectors.start, geometryVectors.goal]}
              color="#38bdf8"
              lineWidth={2.4}
              transparent
              opacity={0.92}
            />
            <Html position={geometryVectors.corner} center distanceFactor={12} zIndexRange={[8, 0]}>
              <span className="whitespace-nowrap rounded border border-aura-500/40 bg-black/80 px-1.5 py-0.5 font-mono text-[9px] text-aura-300">
                Por etapas: {geometryVectors.manhattan} (avance {geometryVectors.dx} + afinidad {geometryVectors.dy})
              </span>
            </Html>
            <Html position={geometryVectors.midEuclidean} center distanceFactor={12} zIndexRange={[8, 0]}>
              <span className="whitespace-nowrap rounded border border-sky-400/40 bg-black/80 px-1.5 py-0.5 font-mono text-[9px] text-sky-300">
                Distancia en linea recta: {geometryVectors.euclidean}
              </span>
            </Html>
          </group>
        )}
        {path.edges.map((e) => {
          const a = byId.get(e.source)
          const b = byId.get(e.target)
          if (!a || !b) return null
          const done = a.status === 'acquired' && (b.status === 'acquired' || b.node_type === 'skill')
          const onSearchRoute = routeEdges.has(`${a.id}>${b.id}`)
          const cycleEdge = activeSearchNode === b.id && searchPath.at(-1) === a.id
          return (
            <Line
              key={`${e.source}-${e.target}-${e.edge_type}`}
              points={[a.position, b.position]}
              color={cycleEdge ? '#ef4444' : onSearchRoute ? '#ffb547' : e.edge_type === 'related' ? '#3a3a42' : done ? '#ff7a1a' : e.edge_type === 'requires' ? '#8a5a2a' : '#4a4a52'}
              lineWidth={onSearchRoute || cycleEdge ? 2.8 : done ? 1.8 : 1}
              dashed={cycleEdge || e.edge_type !== 'leads_to'}
              dashSize={0.25}
              gapSize={0.18}
              transparent
              opacity={cycleEdge || onSearchRoute ? 1 : selectedId && selectedId !== a.id && selectedId !== b.id ? 0.25 : 0.9}
            />
          )
        })}
        {path.nodes.map((n) => (
          <NodeMesh
            key={n.id}
            node={n}
            selected={n.id === selectedId}
            onSelect={() => onSelect(n.id)}
            reduced={reduced}
            traceOrder={traceOrder.get(n.id) ?? null}
            activeSearch={n.id === activeSearchNode}
          />
        ))}
        <OrbitControls enablePan={false} minDistance={6} maxDistance={20} autoRotate={!reduced && !selectedId} autoRotateSpeed={0.35} makeDefault />
      </Canvas>
      <div className="pointer-events-none absolute bottom-2 left-3 flex flex-wrap gap-3 text-[0.62rem] text-graphite-400">
        {(Object.keys(STATUS_LABEL) as NodeStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[s] }} /> {STATUS_LABEL[s]}
          </span>
        ))}
        <span>Esfera: habilidad / Octaedro: recurso / Poliedro: proyecto</span>
        {visitedOrder.length > 0 && <span className="text-amber-300">Orden de visita numerado</span>}
        {activeSearchNode && <span className="text-red-400">Nodo activo: {path.nodes.find((n) => n.id === activeSearchNode)?.label}</span>}
      </div>
      <p className="pointer-events-none absolute right-3 top-2 text-[0.62rem] text-graphite-500">Arrastra para girar, rueda para acercar</p>
    </div>
  )
})
