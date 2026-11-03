import { Cpu, Waypoints } from 'lucide-react'
import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraLoader } from '@/components/aura/AuraLoader'
import { AuraPanel } from '@/components/aura/AuraPanel'
import { OllamaStudioPanel } from '@/features/ai/OllamaStudioPanel'
import { CareerSearchPanel } from '@/features/career/CareerSearchPanel'
import type { CareerPath } from '@/types/career'

const CareerMap3D = lazy(() =>
  import('@/features/career/CareerMap3D').then((m) => ({ default: m.CareerMap3D })),
)

const COMPANY_TALENT_PATHS: CareerPath[] = [
  {
    id: 'company-fullstack-lead',
    title: 'Ruta de Evaluacion: Full-Stack & Cloud Architect',
    goal_role: 'Full-Stack & Cloud Architect',
    progress: 74,
    generated_by: 'planner-v1',
    created_at: '2026-10-01T10:00:00Z',
    explanation: {
      method: 'Modelado de grafo de competencias corporativas para evaluacion de talento.',
      data_used: ['Catalogo de habilidades de vacantes activas', 'Pesos de formacion y proyectos'],
      limitations: ['Uso exclusivo de apoyo para analisis de rutas y brechas en seleccion empresarial.'],
    },
    nodes: [
      {
        id: 'n-profile',
        node_type: 'profile',
        ref_id: null,
        label: 'Perfil Base Postulante',
        status: 'acquired',
        position: [-6, 0, 0],
        meta: { hours: 1 },
      },
      {
        id: 'n-ts',
        node_type: 'skill',
        ref_id: null,
        label: 'TypeScript & React 19',
        status: 'acquired',
        position: [-3.5, 2.2, 0.8],
        meta: { current_level: 4, required_level: 5, core: true, hours: 14 },
      },
      {
        id: 'n-py',
        node_type: 'skill',
        ref_id: null,
        label: 'Python & FastAPI Async',
        status: 'in_progress',
        position: [-3.2, -2.1, -0.6],
        meta: { current_level: 3, required_level: 5, core: true, hours: 18 },
      },
      {
        id: 'n-sql',
        node_type: 'skill',
        ref_id: null,
        label: 'PostgreSQL & Modelado ACID',
        status: 'in_progress',
        position: [-0.8, 2.6, -0.5],
        meta: { current_level: 3, required_level: 4, core: true, hours: 16 },
      },
      {
        id: 'n-arch',
        node_type: 'course',
        ref_id: null,
        label: 'Arquitectura Distribuida y Seguridad',
        status: 'gap',
        position: [0.4, -1.8, 0.9],
        meta: { hours: 22 },
      },
      {
        id: 'n-devops',
        node_type: 'course',
        ref_id: null,
        label: 'CI/CD, Contenedores y Observabilidad',
        status: 'gap',
        position: [2.4, 1.9, 0.4],
        meta: { hours: 15 },
      },
      {
        id: 'n-proj',
        node_type: 'project',
        ref_id: null,
        label: 'Proyecto Integrador Empresarial',
        status: 'in_progress',
        position: [3.6, -0.6, -0.4],
        meta: { hours: 28 },
      },
      {
        id: 'n-goal',
        node_type: 'role',
        ref_id: null,
        label: 'Full-Stack & Cloud Architect',
        status: 'in_progress',
        position: [6.2, 0.4, 0],
        meta: { hours: 1 },
      },
    ],
    edges: [
      { source: 'n-profile', target: 'n-ts', edge_type: 'leads_to' },
      { source: 'n-profile', target: 'n-py', edge_type: 'leads_to' },
      { source: 'n-ts', target: 'n-sql', edge_type: 'leads_to' },
      { source: 'n-py', target: 'n-arch', edge_type: 'leads_to' },
      { source: 'n-sql', target: 'n-devops', edge_type: 'leads_to' },
      { source: 'n-arch', target: 'n-proj', edge_type: 'leads_to' },
      { source: 'n-devops', target: 'n-proj', edge_type: 'leads_to' },
      { source: 'n-proj', target: 'n-goal', edge_type: 'leads_to' },
    ],
  },
  {
    id: 'company-ai-data-engineer',
    title: 'Ruta de Evaluacion: AI & Data Systems Engineer',
    goal_role: 'AI & Data Systems Engineer',
    progress: 68,
    generated_by: 'planner-v1',
    created_at: '2026-10-05T10:00:00Z',
    explanation: {
      method: 'Simulacion algoritmica de brechas tecnicas para vacantes de IA y Datos.',
      data_used: ['Requisitos obligatorios de ingenieria de datos', 'Heuristicas espaciales'],
      limitations: ['Los algoritmos evaluan rutas formativas optimas sin automatizar contrataciones.'],
    },
    nodes: [
      {
        id: 'd-profile',
        node_type: 'profile',
        ref_id: null,
        label: 'Perfil Inicial Analizado',
        status: 'acquired',
        position: [-6, -0.5, 0],
        meta: { hours: 1 },
      },
      {
        id: 'd-math',
        node_type: 'skill',
        ref_id: null,
        label: 'Estadistica y Algebra Lineal',
        status: 'acquired',
        position: [-3.4, 2.4, 0.5],
        meta: { current_level: 4, required_level: 5, core: true, hours: 16 },
      },
      {
        id: 'd-etl',
        node_type: 'skill',
        ref_id: null,
        label: 'Pipelines de Datos y SQL Avanzado',
        status: 'in_progress',
        position: [-2.8, -2.0, -0.5],
        meta: { current_level: 3, required_level: 5, core: true, hours: 20 },
      },
      {
        id: 'd-ml',
        node_type: 'course',
        ref_id: null,
        label: 'Modelos Predictivos y Busqueda Heuristica',
        status: 'gap',
        position: [0.5, 1.8, 0.7],
        meta: { hours: 24 },
      },
      {
        id: 'd-mlops',
        node_type: 'project',
        ref_id: null,
        label: 'Despliegue MLOps y Gobernanza',
        status: 'gap',
        position: [3.2, -1.1, -0.4],
        meta: { hours: 26 },
      },
      {
        id: 'd-goal',
        node_type: 'role',
        ref_id: null,
        label: 'AI & Data Systems Engineer',
        status: 'in_progress',
        position: [6.0, 0.5, 0],
        meta: { hours: 1 },
      },
    ],
    edges: [
      { source: 'd-profile', target: 'd-math', edge_type: 'leads_to' },
      { source: 'd-profile', target: 'd-etl', edge_type: 'leads_to' },
      { source: 'd-math', target: 'd-ml', edge_type: 'leads_to' },
      { source: 'd-etl', target: 'd-ml', edge_type: 'leads_to' },
      { source: 'd-ml', target: 'd-mlops', edge_type: 'leads_to' },
      { source: 'd-mlops', target: 'd-goal', edge_type: 'leads_to' },
    ],
  },
]

export function CompanyAlgorithmsModule() {
  const [selectedPathId, setSelectedPathId] = useState(COMPANY_TALENT_PATHS[0]!.id)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [searchTrace, setSearchTrace] = useState<{
    path: string[]
    active: string | null
    visited: string[]
  }>({ path: [], active: null, visited: [] })

  const activePath = useMemo(
    () => COMPANY_TALENT_PATHS.find((p) => p.id === selectedPathId) ?? COMPANY_TALENT_PATHS[0]!,
    [selectedPathId],
  )

  const updateTrace = useCallback((ids: string[], active: string | null, visited: string[]) => {
    setSearchTrace({ path: ids, active, visited })
  }, [])

  return (
    <AuraPanel
      eyebrow="Exclusivo para Empresas — Inteligencia de Talento"
      title="Laboratorio de Algoritmos, Rutas y Evaluacion de Candidatos"
      className="flex flex-col gap-6"
    >
      <div className="card-3d flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="icon-orb-3d flex h-10 w-10 items-center justify-center rounded-xl text-aura-400">
            <Cpu className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="hud-label text-aura-400">Panel Exclusivo de Reclutamiento y Empresa</p>
              <AuraBadge tone="info">Oculto para candidatos</AuraBadge>
            </div>
            <p className="mt-0.5 text-xs text-graphite-300">
              Simula y audita como los algoritmos de busqueda, evolucion de rutas y heuristicas evaluan las brechas tecnicas de los postulantes hacia tus vacantes.
            </p>
          </div>
        </div>

        <div className="w-full sm:w-80">
          <AuraSelect
            label="Vacante / Perfil Objetivo a Simular"
            value={selectedPathId}
            onChange={(e) => {
              setSelectedPathId(e.target.value)
              setSelectedNode(null)
              setSearchTrace({ path: [], active: null, visited: [] })
            }}
            options={COMPANY_TALENT_PATHS.map((p) => ({ value: p.id, label: p.goal_role ?? p.title }))}
          />
        </div>
      </div>

      <OllamaStudioPanel />

      <CareerSearchPanel
        path={activePath}
        onTrace={updateTrace}
        selectedNodeId={selectedNode}
        onSelectNode={setSelectedNode}
      />

      <div className="card-3d flex flex-col gap-3 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Waypoints className="h-4 w-4 text-aura-400" aria-hidden="true" />
          <h4 className="hud-label text-bone">Visualizacion 3D del Grafo de Competencias de la Vacante</h4>
        </div>
        <Suspense
          fallback={
            <div className="flex h-[26rem] items-center justify-center">
              <AuraLoader label="Construyendo mapa 3D de la vacante" />
            </div>
          }
        >
          <CareerMap3D
            path={activePath}
            selectedId={selectedNode}
            onSelect={setSelectedNode}
            searchPath={searchTrace.path}
            visitedOrder={searchTrace.visited}
            activeSearchNode={searchTrace.active}
          />
        </Suspense>
      </div>
    </AuraPanel>
  )
}
