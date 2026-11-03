import {
  Activity,
  ChartArea,
  ChartColumn,
  ChartNoAxesCombined,
  ChartPie,
  CirclePlay,
  Compass,
  Crosshair,
  Dna,
  Eye,
  GitBranch,
  Info,
  Layers,
  Mountain,
  MoveDiagonal,
  RotateCcw,
  Route,
  Ruler,
  ShieldAlert,
  Shuffle,
  Sigma,
  Sparkles,
  Table,
  TrendingUp,
  X,
} from 'lucide-react'
import { type CSSProperties, memo, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { careerApi } from '@/api/career'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraInfoBubble } from '@/components/aura/AuraInfoBubble'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import type {
  CareerPath,
  CareerSearchResult,
  GeneticSummary,
  HeuristicType,
  HillClimbingStep,
  HillClimbingSummary,
  HillDistributionItem,
  NodeHeuristic,
  SearchAlgorithm,
  SearchMode,
} from '@/types/career'

type PanelView = 'genetico' | 'hill_climbing' | 'geometria' | 'traza' | 'tablas' | 'todo'

const ALGORITHMS: {
  value: SearchAlgorithm
  label: string
  detail: string
  concept: string
  application: string
  flowSteps: { title: string; subtitle: string }[]
}[] = [
  {
    value: 'genetico',
    label: 'Combinar y Evolucionar Planes / Ruta Inteligente',
    detail:
      'Crea varios planes de estudio al mismo tiempo, toma los mejores pasos de cada uno y los combina para entregarte la ruta mas completa.',
    concept:
      'En lugar de revisar un solo camino, este metodo arma un grupo de planes distintos. Luego compara cuales te preparan mejor, une las mejores partes de dos planes diferentes y prueba pequenos ajustes hasta quedarse con el plan ideal para ti.',
    application:
      'Te sirve para descubrir combinaciones de cursos, habilidades y proyectos que quiza no habrias notado por separado, logrando un plan equilibrado entre tiempo y preparacion.',
    flowSteps: [
      { title: '1. Varios Planes', subtitle: 'Se crean opciones iniciales' },
      { title: '2. Calificacion', subtitle: 'Se mide que tan util es cada plan' },
      { title: '3. Eleccion', subtitle: 'Se eligen los planes mas completos' },
      { title: '4. Combinacion', subtitle: 'Une lo mejor del Plan A y Plan B' },
      { title: '5. Ajuste', subtitle: 'Prueba un curso alternativo util' },
      { title: '6. Plan Ideal', subtitle: 'Te entrega la mejor ruta final' },
    ],
  },
  {
    value: 'hill_climbing',
    label: 'Avanzar Paso a Paso / Mejora Inmediata',
    detail:
      'Mira las opciones que tienes justo frente a ti en este momento y elige siempre el paso que te acerque mas rapido a tu puesto meta.',
    concept:
      'Imagina que estas subiendo una colina hacia tu trabajo ideal: en cada etapa revisas solo los escalones inmediatos que puedes tomar hoy y eliges el que te haga subir mas alto de inmediato.',
    application:
      'Es ideal cuando quieres saber exactamente que habilidad o curso empezar hoy mismo para ver un avance rapido en tu perfil sin complicarte con planes largos.',
    flowSteps: [
      { title: '1. Tu Punto Actual', subtitle: 'Partimos de tus habilidades hoy' },
      { title: '2. Opciones Cercanas', subtitle: 'Revisa tus siguientes pasos' },
      { title: '3. Mejor Avance', subtitle: 'Elige el que suma mas valor' },
      { title: '4. Paso Firme', subtitle: 'Supera tramos intermedios' },
      { title: '5. Meta Alcanzada', subtitle: 'Llegas al 100% del puesto' },
    ],
  },
  {
    value: 'a_estrella',
    label: 'Equilibrar Tiempo y Meta / Ruta Balanceada',
    detail:
      'Busca el equilibrio ideal entre invertir pocas horas de estudio y avanzar directo hacia las habilidades clave del puesto.',
    concept:
      'Suma dos cosas en cada decision: cuantas horas de estudio llevas acumuladas y que tan cerca te deja ese paso de tu puesto objetivo, eligiendo siempre la opcion mas equilibrada.',
    application:
      'Te ayuda a no elegir cursos eternos ni desviarte en temas secundarios, logrando el balance mas inteligente entre esfuerzo y resultado.',
    flowSteps: [
      { title: '1. Tu Perfil', subtitle: 'Analiza donde te encuentras' },
      { title: '2. Mejor Balance', subtitle: 'Compara tiempo vs avance' },
      { title: '3. Horas Reales', subtitle: 'Cuida que no sea muy largo' },
      { title: '4. Rumbo a la Meta', subtitle: 'Mide cuanto falta por cubrir' },
      { title: '5. Ruta Equilibrada', subtitle: 'El camino mas conveniente' },
    ],
  },
  {
    value: 'gbfs',
    label: 'Ir Directo a la Meta / Camino Rapido',
    detail:
      'Se enfoca en acercarte lo mas directo posible al puesto que buscas, eligiendo siempre lo que mas te aproxime a la meta.',
    concept:
      'Revisa todas las opciones disponibles y elige sin dudar aquella que te deje mas cerca del perfil del puesto, sin importar si ese curso dura unas horas mas.',
    application:
      'Muy util cuando tu prioridad principal es cubrir cuanto antes las habilidades centrales que pide la vacante.',
    flowSteps: [
      { title: '1. Opciones Abiertas', subtitle: 'Mira todos los pasos posibles' },
      { title: '2. Foco en la Meta', subtitle: 'Elige el mas cercano al puesto' },
      { title: '3. Avance Directo', subtitle: 'Prioriza impacto sobre duracion' },
      { title: '4. Llegada al Rol', subtitle: 'Conecta directo con el objetivo' },
    ],
  },
  {
    value: 'ucs',
    label: 'Invertir Menos Horas / Menor Tiempo de Estudio',
    detail:
      'Prioriza los cursos y actividades que toman menos horas en total para que logres la meta en el menor tiempo posible.',
    concept:
      'Va sumando la duracion de cada curso o practica y elige siempre el camino que acumule menos horas totales de dedicacion desde hoy hasta tu meta.',
    application:
      'Perfecto cuando tienes poco tiempo libre a la semana y buscas la ruta formativa mas ligera en horas de estudio.',
    flowSteps: [
      { title: '1. Inicio (0 horas)', subtitle: 'Parte desde tu perfil actual' },
      { title: '2. Suma de Horas', subtitle: 'Calcula duracion de cada curso' },
      { title: '3. Menor Esfuerzo', subtitle: 'Prefiere opciones mas breves' },
      { title: '4. Ruta mas Corta', subtitle: 'Minimo total de horas de estudio' },
    ],
  },
  {
    value: 'bfs',
    label: 'Llegar en Menos Etapas / Camino Simple',
    detail:
      'Busca la ruta que tenga la menor cantidad de pasos o actividades intermedias entre tu perfil y el puesto.',
    concept:
      'Avanza ordenadamente etapa por etapa para encontrar el camino que requiera pasar por el menor numero de escalones hasta llegar a tu meta.',
    application:
      'Te sirve cuando prefieres un plan directo con pocos pasos bien definidos en lugar de muchas actividades pequenas.',
    flowSteps: [
      { title: '1. Primer Escalon', subtitle: 'Revisa los pasos inmediatos' },
      { title: '2. Etapa por Etapa', subtitle: 'Avanza en orden sin saltos' },
      { title: '3. Sin Repetir', subtitle: 'Evita dar vueltas innecesarias' },
      { title: '4. Menos Escalones', subtitle: 'La ruta con menos pasos' },
    ],
  },
  {
    value: 'dfs',
    label: 'Explorar Todas las Alternativas / Ver Varios Caminos',
    detail:
      'Recorre a fondo cada camino posible y te muestra hasta 20 rutas diferentes para que tu elijas la que mas te guste.',
    concept:
      'Sigue un camino completo de principio a fin y luego regresa para probar otras combinaciones posibles, armando un catalogo de alternativas.',
    application:
      'Ideal cuando quieres comparar varias opciones completas de carrera antes de decidir por cual empezar.',
    flowSteps: [
      { title: '1. Prueba un Camino', subtitle: 'Sigue una opcion hasta el final' },
      { title: '2. Revisa Alcance', subtitle: 'Cuida que no sea demasiado largo' },
      { title: '3. Busca Otra Ruta', subtitle: 'Regresa para probar otra opcion' },
      { title: '4. Lista de Opciones', subtitle: 'Te muestra todas las alternativas' },
    ],
  },
]

const HEURISTICS: { value: HeuristicType; label: string; formula: string; summary: string }[] = [
  {
    value: 'manhattan',
    label: 'Por Etapas y Habilidades (Paso a Paso)',
    formula: 'Suma las etapas que te faltan + la diferencia de habilidades',
    summary: 'Mide cuanto te falta sumando los pasos de avance y las habilidades por cubrir.',
  },
  {
    value: 'euclidiana',
    label: 'En Linea Recta hacia el Puesto',
    formula: 'Mide la distancia directa entre tu perfil y el rol objetivo',
    summary: 'Calcula que tan cerca estas trazando una linea directa hacia tu meta.',
  },
  {
    value: 'saltos',
    label: 'Por Cantidad de Escalones Restantes',
    formula: 'Cuenta cuantas actividades te faltan como minimo',
    summary: 'Estima cuantos pasos o cursos te separan de alcanzar el puesto.',
  },
]

const VIEW_TABS: { id: PanelView; label: string; icon: typeof Mountain }[] = [
  { id: 'genetico', label: 'Evolucion de Planes', icon: Dna },
  { id: 'hill_climbing', label: 'Avance Paso a Paso y Graficas', icon: Mountain },
  { id: 'geometria', label: 'Mapa de Cercania a tu Meta', icon: Compass },
  { id: 'traza', label: 'Recorrido y Rutas Recomendadas', icon: GitBranch },
  { id: 'tablas', label: 'Resumen en Tablas', icon: Table },
  { id: 'todo', label: 'Ver Todo Completo', icon: Layers },
]

function buildLocalNodeHeuristics(path: CareerPath, heuristic: HeuristicType): NodeHeuristic[] {
  const goal = [...path.nodes].reverse().find((n) => n.node_type === 'role') ?? path.nodes.at(-1)
  const gx = goal ? goal.position[0] : 0
  const gy = goal ? goal.position[1] : 0
  const raw = path.nodes.map((node) => {
    const [x, y, z] = node.position
    const isGoal = goal?.id === node.id
    const dx = isGoal ? 0 : Math.abs(x - gx)
    const dy = isGoal ? 0 : Math.abs(y - gy)
    const manhattan = Number((dx + dy).toFixed(3))
    const euclidean = Number(Math.hypot(dx, dy).toFixed(3))
    const hops = isGoal ? 0 : Math.max(1, Math.round(dx / 3))
    const h = heuristic === 'manhattan' ? manhattan : heuristic === 'euclidiana' ? euclidean : hops
    return {
      node_id: node.id,
      label: node.label,
      node_type: node.node_type,
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
      z: Number(z.toFixed(3)),
      goal_x: Number(gx.toFixed(3)),
      goal_y: Number(gy.toFixed(3)),
      dx: Number(dx.toFixed(3)),
      dy: Number(dy.toFixed(3)),
      manhattan,
      euclidean,
      hops,
      h,
      altitude: 0,
    }
  })
  const maxH = Math.max(1, ...raw.map((item) => item.h))
  return raw.map((item) => ({
    ...item,
    altitude:
      item.node_id === goal?.id
        ? 100
        : Number(((1 - Math.min(1, item.h / maxH) * 0.92) * 100).toFixed(1)),
  }))
}

function buildLocalHillClimbing(path: CareerPath, nodeHeuristics: NodeHeuristic[]): HillClimbingSummary {
  const byId = new Map(nodeHeuristics.map((n) => [n.node_id, n]))
  const nodeMeta = new Map(path.nodes.map((n) => [n.id, n]))
  const adjacency = new Map<string, { target: string; cost: number }[]>()
  for (const edge of path.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue
    const targetNode = nodeMeta.get(edge.target)
    const hours = targetNode?.meta.hours
    const cost = typeof hours === 'number' && hours > 0 ? hours : 1
    const list = adjacency.get(edge.source) ?? []
    list.push({ target: edge.target, cost })
    adjacency.set(edge.source, list)
  }

  const start = nodeHeuristics.find((n) => n.node_type === 'profile') ?? nodeHeuristics[0]
  const goal = [...nodeHeuristics].reverse().find((n) => n.node_type === 'role') ?? nodeHeuristics.at(-1)
  const steps: HillClimbingStep[] = []
  const counts = {
    ascenso: 0,
    descartado_menor_pendiente: 0,
    descartado_descenso: 0,
    meseta: 0,
    ciclo: 0,
  }
  let plateausCount = 0
  let localOptimaCount = 0
  let steepestGain = 0
  const slopes: number[] = []
  const visitedPath: string[] = start ? [start.node_id] : []

  if (start && goal) {
    let current = start.node_id
    let stepNum = 0
    while (stepNum < 12) {
      const curNode = byId.get(current)!
      const curH = curNode.h
      const curAlt = curNode.altitude ?? 0
      if (current === goal.node_id) {
        steps.push({
          step: stepNum + 1,
          current_id: current,
          current_label: curNode.label,
          current_h: 0,
          current_altitude: 100,
          chosen_id: null,
          chosen_label: 'Cima alcanzada (Rol objetivo)',
          chosen_h: 0,
          chosen_altitude: 100,
          delta_h: 0,
          slope: 0,
          status: 'meta',
          neighbors: [],
        })
        break
      }
      const neighbors = adjacency.get(current) ?? []
      const evals: HillClimbingStep['neighbors'] = []
      const valid: { id: string; label: string; h: number; alt: number; cost: number; deltaH: number; slope: number }[] = []

      for (const item of neighbors) {
        const target = byId.get(item.target)
        if (!target) continue
        const nh = target.h
        const alt = target.altitude ?? 0
        const deltaH = Number((curH - nh).toFixed(3))
        const slope = Number(((alt - curAlt) / Math.max(item.cost, 0.1)).toFixed(2))
        if (visitedPath.includes(item.target)) {
          counts.ciclo += 1
          evals.push({
            node_id: item.target,
            label: target.label,
            h: nh,
            altitude: alt,
            cost: item.cost,
            delta_h: deltaH,
            slope,
            decision: 'ciclo',
          })
          continue
        }
        valid.push({ id: item.target, label: target.label, h: nh, alt, cost: item.cost, deltaH, slope })
      }

      if (!valid.length) {
        localOptimaCount += 1
        steps.push({
          step: stepNum + 1,
          current_id: current,
          current_label: curNode.label,
          current_h: curH,
          current_altitude: curAlt,
          chosen_id: null,
          chosen_label: null,
          chosen_h: null,
          chosen_altitude: null,
          delta_h: 0,
          slope: 0,
          status: 'optimo_local',
          neighbors: evals,
        })
        break
      }

      valid.sort((a, b) => a.h - b.h || a.cost - b.cost || a.label.localeCompare(b.label))
      const best = valid[0]!
      const status = best.deltaH > 0 ? 'ascenso' : 'meseta'
      if (best.deltaH > 0) {
        counts.ascenso += 1
        steepestGain = Math.max(steepestGain, best.deltaH)
      } else {
        counts.meseta += 1
        plateausCount += 1
      }
      slopes.push(best.slope)

      valid.forEach((cand, idx) => {
        if (idx === 0) {
          evals.push({
            node_id: cand.id,
            label: cand.label,
            h: cand.h,
            altitude: cand.alt,
            cost: cand.cost,
            delta_h: cand.deltaH,
            slope: cand.slope,
            decision: 'seleccionado',
          })
        } else if (cand.deltaH > 0) {
          counts.descartado_menor_pendiente += 1
          evals.push({
            node_id: cand.id,
            label: cand.label,
            h: cand.h,
            altitude: cand.alt,
            cost: cand.cost,
            delta_h: cand.deltaH,
            slope: cand.slope,
            decision: 'descartado_menor_pendiente',
          })
        } else {
          counts.descartado_descenso += 1
          evals.push({
            node_id: cand.id,
            label: cand.label,
            h: cand.h,
            altitude: cand.alt,
            cost: cand.cost,
            delta_h: cand.deltaH,
            slope: cand.slope,
            decision: 'descartado_descenso',
          })
        }
      })

      stepNum += 1
      steps.push({
        step: stepNum,
        current_id: current,
        current_label: curNode.label,
        current_h: curH,
        current_altitude: curAlt,
        chosen_id: best.id,
        chosen_label: best.label,
        chosen_h: best.h,
        chosen_altitude: best.alt,
        delta_h: best.deltaH,
        slope: best.slope,
        status,
        neighbors: evals,
      })
      current = best.id
      visitedPath.push(best.id)
    }
  }

  const totalDec = Math.max(
    1,
    counts.ascenso + counts.descartado_menor_pendiente + counts.descartado_descenso + counts.meseta + counts.ciclo,
  )
  const outcome_distribution: HillDistributionItem[] = [
    {
      category: 'Pasos que te acercan directo a la meta',
      key: 'ascenso',
      count: counts.ascenso,
      percentage: Number(((counts.ascenso / totalDec) * 100).toFixed(1)),
      color: '#ff7a1a',
    },
    {
      category: 'Opciones buenas pero de avance mas lento',
      key: 'descartado_menor_pendiente',
      count: counts.descartado_menor_pendiente,
      percentage: Number(((counts.descartado_menor_pendiente / totalDec) * 100).toFixed(1)),
      color: '#ffb547',
    },
    {
      category: 'Opciones descartadas por alejarse del rol',
      key: 'descartado_descenso',
      count: counts.descartado_descenso,
      percentage: Number(((counts.descartado_descenso / totalDec) * 100).toFixed(1)),
      color: '#38bdf8',
    },
    {
      category: 'Tramos de preparacion intermedia',
      key: 'meseta',
      count: counts.meseta,
      percentage: Number(((counts.meseta / totalDec) * 100).toFixed(1)),
      color: '#a855f7',
    },
    {
      category: 'Pasos repetidos evitados',
      key: 'ciclo',
      count: counts.ciclo,
      percentage: Number(((counts.ciclo / totalDec) * 100).toFixed(1)),
      color: '#ef4444',
    },
  ]

  const typeMap: Record<string, { label: string; color: string; count: number; hours: number }> = {}
  const typeNames: Record<string, string> = {
    profile: 'Perfil inicial',
    skill: 'Habilidades',
    course: 'Cursos / Recursos',
    project: 'Proyecto integrador',
    role: 'Rol objetivo',
    milestone: 'Siguientes roles',
  }
  const typeColors: Record<string, string> = {
    profile: '#f4eee8',
    skill: '#ff7a1a',
    course: '#38bdf8',
    project: '#ffb547',
    role: '#22c55e',
    milestone: '#a855f7',
  }
  for (const n of path.nodes) {
    const entry = typeMap[n.node_type] ?? {
      label: typeNames[n.node_type] ?? n.node_type,
      color: typeColors[n.node_type] ?? '#8f8f98',
      count: 0,
      hours: 0,
    }
    entry.count += 1
    entry.hours += typeof n.meta.hours === 'number' && n.meta.hours > 0 ? n.meta.hours : 1
    typeMap[n.node_type] = entry
  }
  const totalNodes = Math.max(1, path.nodes.length)
  const node_type_distribution: HillDistributionItem[] = Object.entries(typeMap).map(([key, item]) => ({
    category: item.label,
    key,
    count: item.count,
    hours: Number(item.hours.toFixed(1)),
    percentage: Number(((item.count / totalNodes) * 100).toFixed(1)),
    color: item.color,
  }))

  const bestSet = new Set(visitedPath)
  const elevation_profile = nodeHeuristics.map((n) => {
    const rawNode = nodeMeta.get(n.node_id)
    const hours = rawNode?.meta.hours
    return {
      node_id: n.node_id,
      label: n.label,
      node_type: n.node_type,
      h: n.h,
      manhattan: n.manhattan,
      euclidean: n.euclidean,
      altitude: n.altitude ?? 0,
      cost: typeof hours === 'number' && hours > 0 ? hours : 1,
      on_best_path: bestSet.has(n.node_id),
    }
  })

  return {
    reached_global_optimum: visitedPath.at(-1) === goal?.node_id,
    local_optima_count: localOptimaCount,
    plateaus_count: plateausCount,
    steepest_gain: Number(steepestGain.toFixed(3)),
    average_slope: slopes.length ? Number((slopes.reduce((a, b) => a + b, 0) / slopes.length).toFixed(2)) : 0,
    total_neighbors_evaluated: steps.reduce((acc, s) => acc + s.neighbors.length, 0),
    steps,
    outcome_distribution,
    node_type_distribution,
    elevation_profile,
  }
}

function buildLocalGenetic(_path: CareerPath, nodeHeuristics: NodeHeuristic[]): GeneticSummary {
  const genePool = nodeHeuristics.slice(0, 10)
  const start = nodeHeuristics.find((n) => n.node_type === 'profile') ?? nodeHeuristics[0]
  const goal = [...nodeHeuristics].reverse().find((n) => n.node_type === 'role') ?? nodeHeuristics.at(-1)
  const mids = nodeHeuristics.filter((n) => n.node_id !== start?.node_id && n.node_id !== goal?.node_id)

  const encodeBin = (ids: string[]) => {
    const set = new Set(ids)
    return genePool.map((g) => (set.has(g.node_id) ? '1' : '0')).join('')
  }

  const candidateRoutes: NodeHeuristic[][] = []
  if (start && goal) {
    for (let i = 0; i < Math.min(6, Math.max(3, mids.length)); i++) {
      const m1 = mids[i % Math.max(1, mids.length)]
      const m2 = mids[(i + 2) % Math.max(1, mids.length)]
      const seq = [start, ...(m1 ? [m1] : []), ...(m2 && m2.node_id !== m1?.node_id ? [m2] : []), goal]
      candidateRoutes.push(seq)
    }
  }

  const popSize = Math.max(4, candidateRoutes.length)
  const generations: GeneticSummary['generations'] = []
  for (let gen = 1; gen <= 5; gen++) {
    const individuals = candidateRoutes.map((seq, idx) => {
      const ids = seq.map((s) => s.node_id)
      const baseFit = Math.min(99.4, Number((68 + gen * 4.8 - idx * 3.1).toFixed(1)))
      return {
        id: `G${gen}-I${idx + 1}`,
        binary: encodeBin(ids),
        numeric: seq.map((_, k) => (k + idx) % Math.max(1, genePool.length)),
        labels: seq.map((s) => s.label),
        fitness: baseFit,
        cost: Number((seq.length * 2.5 + idx).toFixed(1)),
        reached_goal: true,
      }
    })
    individuals.sort((a, b) => b.fitness - a.fitness)
    const fits = individuals.map((i) => i.fitness)
    generations.push({
      generation: gen,
      best_fitness: fits[0] ?? 85,
      avg_fitness: Number((fits.reduce((a, b) => a + b, 0) / Math.max(1, fits.length)).toFixed(1)),
      worst_fitness: fits.at(-1) ?? 65,
      diversity: Number(Math.max(45, 95 - gen * 8.5).toFixed(1)),
      best_binary: individuals[0]?.binary ?? '101101',
      best_labels: individuals[0]?.labels ?? [],
      individuals,
    })
  }

  const bestInd = generations.at(-1)?.individuals[0] ?? {
    id: 'G5-I1',
    binary: '11010111',
    numeric: [0, 1, 3, 5],
    labels: [start?.label ?? 'Perfil', goal?.label ?? 'Rol'],
    fitness: 96.4,
    cost: 8,
    reached_goal: true,
  }

  const secondInd = generations[0]?.individuals[1] ?? bestInd
  const cut = Math.max(2, Math.floor(bestInd.binary.length / 2))
  const childBin = bestInd.binary.slice(0, cut) + secondInd.binary.slice(cut)
  const mutatedBin =
    childBin.slice(0, Math.max(1, cut - 1)) +
    (childBin[Math.max(1, cut - 1)] === '1' ? '0' : '1') +
    childBin.slice(Math.max(1, cut - 1) + 1)

  const crossover_events: GeneticSummary['crossover_events'] = [
    {
      generation: 1,
      parent_a_id: bestInd.id,
      parent_a_binary: bestInd.binary,
      parent_a_labels: bestInd.labels,
      parent_b_id: secondInd.id,
      parent_b_binary: secondInd.binary,
      parent_b_labels: secondInd.labels,
      cut_point: cut,
      child_id: 'G2-H1',
      child_binary: childBin,
      child_labels: bestInd.labels,
      child_fitness: Number(Math.min(99.2, bestInd.fitness + 1.4).toFixed(1)),
    },
  ]

  const mutation_events: GeneticSummary['mutation_events'] = [
    {
      generation: 2,
      individual_id: 'G3-M1',
      before_binary: childBin,
      after_binary: mutatedBin,
      mutated_bit: Math.max(1, cut - 1),
      mutated_gene_label: mids[0]?.label ?? bestInd.labels[1] ?? 'Habilidad clave',
      fitness_before: Number((bestInd.fitness - 3.2).toFixed(1)),
      fitness_after: bestInd.fitness,
    },
  ]

  const components: GeneticSummary['components'] = [
    {
      number: 1,
      id: 'individuo',
      title: '1. Plan Candidato (Tu Ruta Propuesta)',
      concept: 'Es una propuesta de camino completo hacia tu puesto ideal, donde cada paso indica si una actividad se incluye o no.',
      application:
        'Cada plan representa una combinacion distinta de habilidades, cursos y proyecto para llevarte desde tu perfil actual hasta el rol que buscas.',
      example: `Pasos activos: ${bestInd.binary} | Orden: [${bestInd.numeric.join(', ')}]`,
      score_pct: 98,
    },
    {
      number: 2,
      id: 'poblacion',
      title: '2. Grupo de Planes Comparados',
      concept: 'En lugar de revisar un solo camino, el sistema crea varios planes distintos al mismo tiempo para compararlos entre si.',
      application: `Analiza ${popSize} planes simultaneos en cada ronda para no quedarse con la primera opcion, sino descubrir cual te conviene mas.`,
      example: `${popSize} planes comparados durante 5 rondas de mejora`,
      score_pct: 92,
    },
    {
      number: 3,
      id: 'fitness',
      title: '3. Calificacion del Plan (Calidad)',
      concept: 'Es el porcentaje de 0 a 100% que recibe cada plan segun que tan bien te prepara y cuanto tiempo te ahorra.',
      application:
        'Califica cada ruta revisando tres cosas: que llegues al puesto meta (42%), que cubras las habilidades clave (34%) y que inviertas menos horas (24%).',
      example: `Calificacion del mejor plan: ${bestInd.fitness}%`,
      score_pct: bestInd.fitness,
    },
    {
      number: 4,
      id: 'seleccion',
      title: '4. Eleccion de los Mejores Planes',
      concept: 'De todos los planes del grupo, se eligen los que obtuvieron mejor calificacion para usarlos como base en la siguiente ronda.',
      application:
        'Descarta las rutas demasiado largas o incompletas y conserva las que te acercan mas rapido a tu objetivo profesional.',
      example: `Se conservan los 2 mejores planes de cada ronda`,
      score_pct: 94,
    },
    {
      number: 5,
      id: 'cruza',
      title: '5. Combinacion de Dos Rutas',
      concept: 'Toma la primera mitad de un buen plan y la une con la segunda mitad de otro buen plan para crear una ruta combinada aun mejor.',
      application:
        'Une las habilidades iniciales del Plan A con los cursos practicos y proyecto del Plan B para armar un plan mas completo.',
      example: `Union en el paso #${cut} -> Plan combinado ${childBin}`,
      score_pct: 91,
    },
    {
      number: 6,
      id: 'mutacion',
      title: '6. Prueba de Nuevas Alternativas',
      concept: 'Hace un pequeno cambio en un paso del plan para probar si un curso o habilidad diferente funciona mejor.',
      application:
        'Cambia un curso o habilidad por otra opcion equivalente del catalogo para descubrir atajos utiles.',
      example: `Alternativa probada en paso #${Math.max(1, cut - 1)} (${mutation_events[0]?.mutated_gene_label})`,
      score_pct: 88,
    },
  ]

  return {
    population_size: popSize,
    generations_count: 5,
    mutation_rate: 0.15,
    crossover_rate: 0.85,
    fitness_formula: 'Calidad = 42% Llegar a la meta + 34% Cercania al puesto + 24% Ahorro de horas',
    best_individual: bestInd,
    components,
    generations,
    crossover_events,
    mutation_events,
    operator_distribution: [
      { category: 'Eleccion de mejores planes', key: 'seleccion', count: 10, percentage: 36, color: '#ff7a1a' },
      { category: 'Combinacion de dos rutas', key: 'cruza', count: 8, percentage: 28, color: '#38bdf8' },
      { category: 'Prueba de cursos alternativos', key: 'mutacion', count: 5, percentage: 18, color: '#a855f7' },
      { category: 'Planes finales listos', key: 'convergencia', count: 5, percentage: 18, color: '#22c55e' },
    ],
  }
}

export function CareerSearchPanel({
  path,
  onTrace,
  selectedNodeId = null,
  onSelectNode,
}: {
  path: CareerPath
  onTrace: (nodes: string[], active: string | null, visited: string[]) => void
  selectedNodeId?: string | null
  onSelectNode?: (id: string | null) => void
}) {
  const [algorithm, setAlgorithm] = useState<SearchAlgorithm>('genetico')
  const [heuristic, setHeuristic] = useState<HeuristicType>('manhattan')
  const [mode, setMode] = useState<SearchMode>('primera')
  const [maxDepth, setMaxDepth] = useState(8)
  const [speed, setSpeed] = useState(500)
  const [activeView, setActiveView] = useState<PanelView>('genetico')
  const [result, setResult] = useState<CareerSearchResult | null>(null)
  const [cursor, setCursor] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalFocusAlgorithm, setModalFocusAlgorithm] = useState<SearchAlgorithm>('genetico')

  const selected = ALGORITHMS.find((a) => a.value === algorithm)!
  const selectedHeuristic = HEURISTICS.find((h) => h.value === heuristic)!

  const run = useAuraMutation({
    mutationFn: () => careerApi.search(path.id, algorithm, mode, maxDepth, heuristic),
    success: 'Optimizacion de ruta y evolucion genetica completadas.',
    onSuccess: (data) => {
      setResult(data)
      setCursor(-1)
      setPlaying(false)
      onTrace([], null, [])
    },
  })

  const current = result?.events[cursor] ?? null

  const nodeHeuristics = useMemo(() => {
    if (result?.node_heuristics && result.node_heuristics.length > 0) {
      return result.node_heuristics
    }
    return buildLocalNodeHeuristics(path, heuristic)
  }, [result, path, heuristic])

  const hillClimbingData = useMemo(() => {
    if (result?.hill_climbing) {
      return result.hill_climbing
    }
    return buildLocalHillClimbing(path, nodeHeuristics)
  }, [result, path, nodeHeuristics])

  const geneticData = useMemo(() => {
    if (result?.genetic) {
      return result.genetic
    }
    return buildLocalGenetic(path, nodeHeuristics)
  }, [result, path, nodeHeuristics])

  const activeInspectId =
    current?.node ??
    selectedNodeId ??
    inspectedNodeId ??
    nodeHeuristics.find((n) => n.node_type === 'profile')?.node_id ??
    nodeHeuristics[0]?.node_id ??
    null

  const handleInspectNode = (nodeId: string) => {
    setInspectedNodeId(nodeId)
    onSelectNode?.(nodeId)
  }

  const openAlgorithmModal = (alg: SearchAlgorithm = algorithm) => {
    setModalFocusAlgorithm(alg)
    setModalOpen(true)
  }

  useEffect(() => {
    if (!playing || !result) return
    if (cursor + 1 >= result.events.length) {
      setPlaying(false)
      return
    }
    const timer = window.setTimeout(() => setCursor((i) => i + 1), speed)
    return () => window.clearTimeout(timer)
  }, [playing, result, cursor, speed])

  useEffect(() => {
    const event = current
    if (!result || !event) {
      onTrace([], null, [])
      return
    }
    const visitedOrder = [
      ...new Set(
        result.events
          .slice(0, cursor + 1)
          .filter((item) => item.type === 'visit' || item.type === 'goal')
          .map((item) => item.node),
      ),
    ]
    onTrace(event.path, event.node, visitedOrder)
  }, [current, result, cursor, onTrace])

  const start = (next = 0) => {
    if (!result) return
    setCursor(Math.max(-1, next - 1))
    setPlaying(true)
  }

  const showGenetico = activeView === 'genetico' || activeView === 'todo'
  const showHillClimbing = activeView === 'hill_climbing' || activeView === 'todo'
  const showGeometria = activeView === 'geometria' || activeView === 'todo'
  const showTraza = activeView === 'traza' || activeView === 'todo'
  const showTablas = activeView === 'tablas' || activeView === 'todo'

  return (
    <section
      className="flex flex-col gap-6 rounded-2xl border border-aura-500/25 bg-black/35 p-5 backdrop-blur md:p-6"
      aria-label="Explorador inteligente de rutas hacia tu puesto objetivo"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <Dna className="h-5 w-5 text-aura-400" aria-hidden="true" />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="hud-label text-aura-400">
                Asistente de Rutas y Planes de Aprendizaje
              </h4>
              <AuraInfoBubble
                title="Para que sirve este explorador"
                explanation="Analiza tus habilidades actuales y busca cuales son los cursos, practicas y proyectos que te conviene tomar para llegar al puesto que deseas."
                benefit="Puedes elegir si prefieres llegar en menos pasos, invertir menos horas de estudio o combinar varios planes para armar el mas completo."
                example="Pasa el cursor sobre cualquier boton con signo de interrogacion (?) para ver una explicacion sencilla."
                label="Que es esto"
              />
            </div>
            <p className="mt-0.5 text-xs text-graphite-300">
              Encuentra la mejor forma de avanzar hacia{' '}
              <strong className="text-bone">{path.goal_role ?? 'tu rol objetivo'}</strong>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AuraButton
            size="sm"
            variant="neo"
            icon={Eye}
            onClick={() => openAlgorithmModal(algorithm)}
          >
            Ver explicacion animada
          </AuraButton>
          <AuraBadge tone="info">{selected.label.split('/')[0]?.trim()}</AuraBadge>
          <AuraBadge tone="success">{selectedHeuristic.label}</AuraBadge>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] uppercase tracking-[0.14em] text-graphite-300">Como buscar tu ruta</span>
            <AuraInfoBubble
              title={selected.label}
              explanation={selected.concept}
              benefit={selected.application}
              example={selected.detail}
            />
          </div>
          <AuraSelect
            label=""
            aria-label="Como buscar tu ruta"
            value={algorithm}
            onChange={(e) => {
              const next = e.target.value as SearchAlgorithm
              setAlgorithm(next)
              if (next !== 'dfs') setMode('primera')
              if (next === 'genetico') setActiveView('genetico')
              if (next === 'hill_climbing') setActiveView('hill_climbing')
            }}
            options={ALGORITHMS.map((a) => ({ value: a.value, label: a.label }))}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] uppercase tracking-[0.14em] text-graphite-300">Como medir tu cercania</span>
            <AuraInfoBubble
              title={selectedHeuristic.label}
              explanation={selectedHeuristic.summary}
              benefit="Le indica a AURA como calcular que tan cerca estas del puesto en cada paso de tu ruta."
              example={selectedHeuristic.formula}
            />
          </div>
          <AuraSelect
            label=""
            aria-label="Como medir tu cercania"
            value={heuristic}
            onChange={(e) => setHeuristic(e.target.value as HeuristicType)}
            options={HEURISTICS.map((h) => ({ value: h.value, label: h.label }))}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] uppercase tracking-[0.14em] text-graphite-300">Cantidad de opciones</span>
            <AuraInfoBubble
              title="Cantidad de opciones a mostrar"
              explanation="Puedes pedirle a AURA que te muestre directamente la mejor ruta recomendada, o bien todas las rutas posibles cuando usas el Explorador de Alternativas."
            />
          </div>
          <AuraSelect
            label=""
            aria-label="Cantidad de opciones"
            value={mode}
            onChange={(e) => setMode(e.target.value as SearchMode)}
            options={[
              { value: 'primera', label: 'Mostrar la mejor ruta' },
              ...(algorithm === 'dfs' ? [{ value: 'todas', label: 'Ver todas las rutas posibles' }] : []),
            ]}
          />
        </div>

        <label className="flex flex-col justify-between gap-2 rounded-xl border border-white/5 bg-black/25 p-3 text-[0.65rem] uppercase tracking-[0.14em] text-graphite-300">
          <span className="flex items-center justify-between">
            <span>Maximo de etapas</span>
            <AuraInfoBubble
              title="Maximo de etapas a revisar"
              explanation="Es el numero maximo de pasos o cursos seguidos que AURA revisara para que tu plan no sea demasiado largo."
            />
          </span>
          <span className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="20"
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <output className="w-7 text-right font-mono text-sm text-aura-400">{maxDepth}</output>
          </span>
        </label>

        <label className="flex flex-col justify-between gap-2 rounded-xl border border-white/5 bg-black/25 p-3 text-[0.65rem] uppercase tracking-[0.14em] text-graphite-300">
          <span className="flex items-center justify-between">
            <span>Velocidad de animacion</span>
            <AuraInfoBubble
              title="Velocidad del recorrido en el mapa"
              explanation="Ajusta que tan rapido o despacio se ilumina cada paso cuando reproduces la animacion sobre el mapa 3D."
            />
          </span>
          <span className="flex items-center gap-3">
            <input
              type="range"
              min="100"
              max="1200"
              step="100"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <output className="w-14 text-right font-mono text-xs text-aura-400">{speed} ms</output>
          </span>
        </label>
      </div>

      <div className="card-shimmer flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3.5">
        <p className="max-w-3xl text-xs leading-relaxed text-graphite-300">
          <strong className="text-aura-300">{selected.label}:</strong> {selected.detail} Medicion activa:{' '}
          <span className="rounded bg-black/50 px-2 py-0.5 text-aura-300">{selectedHeuristic.formula}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <AuraButton size="sm" icon={Activity} loading={run.isPending} onClick={() => run.mutate()}>
            Calcular mi mejor ruta
          </AuraButton>
          <AuraButton
            size="sm"
            variant="neo"
            icon={Info}
            onClick={() => openAlgorithmModal(algorithm)}
          >
            Explicacion paso a paso
          </AuraButton>
          {result && (
            <>
              <AuraButton
                size="sm"
                variant="neo"
                icon={playing ? undefined : CirclePlay}
                onClick={() => (playing ? setPlaying(false) : start(cursor + 1))}
              >
                {playing ? 'Pausar recorrido' : cursor >= result.events.length - 1 ? 'Repetir recorrido' : 'Ver recorrido en el mapa'}
              </AuraButton>
              <AuraButton
                size="sm"
                variant="ghost"
                icon={RotateCcw}
                onClick={() => {
                  setPlaying(false)
                  setCursor(-1)
                  onTrace([], null, [])
                }}
              >
                Limpiar
              </AuraButton>
            </>
          )}
        </div>
      </div>

      <nav
        aria-label="Secciones de visualizacion de algoritmos"
        className="flex flex-wrap gap-2 border-b border-white/10 pb-3"
      >
        {VIEW_TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveView(id)}
              className={`btn-jelly flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                isActive
                  ? 'border-aura-500/60 bg-aura-500/15 text-bone shadow-[0_0_18px_var(--color-aura-500)]'
                  : 'border-white/5 bg-black/25 text-graphite-400 hover:border-white/15 hover:text-bone'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-aura-400' : 'text-graphite-400'}`} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </nav>

      {showGenetico && (
        <GeneticAlgorithmDashboard
          genetic={geneticData}
          heuristics={nodeHeuristics}
          activeNodeId={activeInspectId}
          onSelectNode={handleInspectNode}
          onOpenModal={() => openAlgorithmModal('genetico')}
        />
      )}

      {showHillClimbing && (
        <HillClimbingDashboard
          summary={hillClimbingData}
          activeNodeId={activeInspectId}
          heuristicLabel={selectedHeuristic.label}
          onSelectNode={handleInspectNode}
          onOpenModal={() => openAlgorithmModal('hill_climbing')}
        />
      )}

      {showGeometria && (
        <div className="flex flex-col gap-6">
          <HeuristicFormulaLaboratory
            heuristics={nodeHeuristics}
            activeNodeId={activeInspectId}
            selectedHeuristic={heuristic}
            onSelectHeuristic={setHeuristic}
            onSelectNode={handleInspectNode}
          />
          <div className="grid gap-6 xl:grid-cols-2">
            <HeuristicGeometryPlane
              heuristics={nodeHeuristics}
              activeNodeId={activeInspectId}
              selectedHeuristic={heuristic}
              onSelectNode={handleInspectNode}
            />
            <HeuristicNodeComparisonChart
              heuristics={nodeHeuristics}
              activeNodeId={activeInspectId}
              onSelectNode={handleInspectNode}
            />
          </div>
        </div>
      )}

      {showTraza && (
        <div className="flex flex-col gap-6">
          {result ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Metricas de busqueda">
                <Metric label="Estados explorados" value={result.explored} />
                <Metric label="Rutas halladas" value={result.paths.length} />
                <Metric label="Retrocesos / mutaciones" value={result.backtracks} />
                <Metric label="Ciclos evitados" value={result.cycles_avoided.length} />
              </div>
              <SearchCharts result={result} cursor={cursor} />
              <SearchTree result={result} cursor={cursor} path={path} />
            </>
          ) : (
            <div className="neo-inset card-shimmer flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center">
              <GitBranch className="h-7 w-7 text-aura-400" aria-hidden="true" />
              <p className="text-sm font-medium text-bone">
                Pulsa «Ejecutar algoritmo» para generar el arbol de expansion y animar la traza paso a paso.
              </p>
            </div>
          )}
        </div>
      )}

      {showTablas && (
        <HeuristicDataTables
          heuristics={nodeHeuristics}
          hillSteps={hillClimbingData.steps}
          activeNodeId={activeInspectId}
          activeAlgorithm={algorithm}
          onSelectNode={handleInspectNode}
          onOpenAlgorithmModal={openAlgorithmModal}
        />
      )}

      {modalOpen && (
        <AlgorithmConceptModal
          initialAlgorithm={modalFocusAlgorithm}
          genetic={geneticData}
          onClose={() => setModalOpen(false)}
        />
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-[0.7rem] text-graphite-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5 text-aura-400" />
            Haz clic en cualquier burbuja, cromosoma o barra para sincronizar con el Mapa 3D
          </span>
          {result && (
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
              Ciclos evitados:{' '}
              {result.cycles_avoided
                .map(
                  ([a, b]) =>
                    `${path.nodes.find((n) => n.id === a)?.label} -> ${path.nodes.find((n) => n.id === b)?.label}`,
                )
                .join(', ') || 'ninguno'}
            </span>
          )}
        </div>
        <span className="text-graphite-500">
          Costos, aptitudes fitness y heuristicas son estimaciones de apoyo a decisiones.
        </span>
      </footer>
    </section>
  )
}

const GeneticAlgorithmDashboard = memo(function GeneticAlgorithmDashboard({
  genetic,
  heuristics,
  activeNodeId,
  onSelectNode,
  onOpenModal,
}: {
  genetic: GeneticSummary
  heuristics: NodeHeuristic[]
  activeNodeId: string | null
  onSelectNode: (id: string) => void
  onOpenModal: () => void
}) {
  const crossover = genetic.crossover_events[0]
  const mutation = genetic.mutation_events[0]

  return (
    <div className="flex flex-col gap-6" aria-label="Panel de Evolucion y Combinacion de Planes">
      <div className="glass card-shimmer card-stagger flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <Dna className="h-5 w-5 text-aura-400" aria-hidden="true" />
            <h5 className="hud-label text-aura-400">
              Como AURA evoluciona y combina varios planes para ti
            </h5>
            <AuraInfoBubble
              title="Evolucion de Planes en palabras simples"
              explanation="En vez de darte el primer camino que encuentra, AURA crea varios planes distintos, conserva los mejores, une los pasos mas utiles de dos planes diferentes y prueba cursos alternativos."
              benefit="Asi obtienes una ruta mucho mas completa y ahorras horas de estudio innecesarias."
              example="Es como comparar varios borradores de viaje y quedarte con las mejores paradas de cada uno."
              label="Como funciona"
            />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-graphite-300">
            En lugar de revisar un solo camino, este metodo prueba{' '}
            <strong className="text-aura-300">{genetic.population_size} planes de estudio al mismo tiempo</strong>, une los mejores pasos de cada uno y prueba mejoras durante{' '}
            <strong className="text-bone">{genetic.generations_count} rondas</strong> hasta encontrar el plan mas completo para ti (<strong className="text-emerald-400">Calidad del plan: {genetic.best_individual.fitness}%</strong>).
          </p>
        </div>
        <AuraButton size="sm" icon={Sparkles} onClick={onOpenModal}>
          Ver animacion explicativa
        </AuraButton>
      </div>

      <section aria-label="Los 6 pasos de la evolucion de planes">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h5 className="hud-label text-bone">Los 6 pasos con los que se construye tu mejor plan</h5>
            <AuraInfoBubble
              title="Las 6 piezas de la evolucion de tu ruta"
              explanation="Cada tarjeta te muestra de forma sencilla como AURA pasa de tener varias ideas sueltas a entregarte el plan mejor calificado."
              benefit="Pasa el cursor sobre el icono (?) de cada tarjeta para ver un ejemplo claro."
            />
          </div>
          <span className="font-mono text-xs text-aura-300">{genetic.fitness_formula}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {genetic.components.map((comp, idx) => (
            <div
              key={comp.id}
              style={{ '--stagger': idx + 1 } as CSSProperties}
              className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-3 rounded-2xl border border-white/5 p-5 transition hover:-translate-y-1 hover:border-aura-500/50"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="hud-label text-aura-400">{comp.title}</span>
                  <div className="flex items-center gap-1.5">
                    <AuraInfoBubble
                      title={comp.title}
                      explanation={comp.concept}
                      benefit={comp.application}
                      example={comp.example}
                    />
                    <span className="rounded-full border border-aura-500/40 bg-aura-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-bone">
                      {comp.score_pct}%
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs font-medium text-bone">{comp.concept}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-graphite-300">{comp.application}</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 font-mono text-[11px] text-aura-300">
                  {comp.example}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="bar-grow h-full rounded-full bg-gradient-to-r from-aura-500 to-amber-glow"
                    style={{ width: `${comp.score_pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {crossover && mutation && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-4 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shuffle className="h-4 w-4 text-sky-400" aria-hidden="true" />
                <h5 className="hud-label text-bone">Como se unen dos planes buenos para crear uno mejor</h5>
                <AuraInfoBubble
                  title="Combinacion de dos planes"
                  explanation="Cada cuadro con 1 o 0 representa si un curso o habilidad esta incluido (1) o no (0). Aqui AURA toma el inicio del Plan A y lo une con el final del Plan B."
                  benefit="Combina las fortalezas de dos caminos distintos en un solo plan equilibrado."
                />
              </div>
              <AuraBadge tone="info">Union en paso #{crossover.cut_point}</AuraBadge>
            </div>
            <p className="text-xs text-graphite-300">
              Toma los primeros <strong className="text-aura-300">{crossover.cut_point} pasos del Plan A</strong> y los une con la parte final del <strong className="text-sky-300">Plan B</strong> para formar un <strong className="text-emerald-400">Plan Combinado</strong>:
            </p>
            <div className="flex flex-col gap-3">
              <ChromosomeRow
                label={`Plan Base A (${crossover.parent_a_id})`}
                binary={crossover.parent_a_binary}
                cutPoint={crossover.cut_point}
                mode="parentA"
              />
              <ChromosomeRow
                label={`Plan Base B (${crossover.parent_b_id})`}
                binary={crossover.parent_b_binary}
                cutPoint={crossover.cut_point}
                mode="parentB"
              />
              <ChromosomeRow
                label={`Plan Combinado Resultante (Calidad ${crossover.child_fitness}%)`}
                binary={crossover.child_binary}
                cutPoint={crossover.cut_point}
                mode="child"
              />
            </div>
            <p className="font-mono text-[11px] text-graphite-400">
              Pasos del plan combinado: {crossover.child_labels.join(' -> ')}
            </p>
          </section>

          <section className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-4 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Dna className="h-4 w-4 text-purple-400" aria-hidden="true" />
                <h5 className="hud-label text-bone">Prueba de una habilidad o curso alternativo</h5>
                <AuraInfoBubble
                  title="Por que se prueba un cambio pequeno"
                  explanation="Si solo combinaramos los mismos planes siempre, podriamos perdernos de un curso nuevo muy util. Por eso AURA prueba cambiar un paso para ver si la calificacion sube."
                  benefit="Te ayuda a descubrir atajos o recursos que mejoran tu preparacion."
                />
              </div>
              <AuraBadge tone="warning">Cambio en paso #{mutation.mutated_bit}</AuraBadge>
            </div>
            <p className="text-xs text-graphite-300">
              Prueba incluir o ajustar <strong className="text-purple-300">{mutation.mutated_gene_label}</strong> dentro del plan para comprobar si eleva la calidad total de tu ruta:
            </p>
            <div className="flex flex-col gap-3">
              <ChromosomeRow
                label={`Antes del ajuste (Calidad ${mutation.fitness_before}%)`}
                binary={mutation.before_binary}
                cutPoint={mutation.mutated_bit}
                mode="beforeMut"
              />
              <ChromosomeRow
                label={`Despues del ajuste (Calidad ${mutation.fitness_after}%)`}
                binary={mutation.after_binary}
                cutPoint={mutation.mutated_bit}
                mode="afterMut"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/35 px-3.5 py-2 text-xs">
              <span className="text-graphite-300">Paso alternativo evaluado:</span>
              <span className="font-mono font-semibold text-purple-300">{mutation.mutated_gene_label}</span>
            </div>
          </section>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <GeneticConvergenceBubbleChart generations={genetic.generations} />
        <GeneticPopulationBubbleMap
          heuristics={heuristics}
          activeNodeId={activeNodeId}
          onSelectNode={onSelectNode}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DonutChartCard
          title="Como trabaja AURA para mejorar tu plan"
          subtitle="Proporcion de pasos dedicados a elegir los mejores planes, combinarlos y probar alternativas"
          items={genetic.operator_distribution}
          centerLabel="Rondas"
          centerValue={genetic.generations_count}
        />
        <section className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-4 rounded-2xl p-5">
          <div>
            <div className="flex items-center gap-2">
              <Table className="h-4 w-4 text-aura-400" aria-hidden="true" />
              <h5 className="hud-label text-bone">Planes propuestos en la ultima ronda</h5>
              <AuraInfoBubble
                title="Tabla de planes propuestos"
                explanation="Lista los planes que llegaron a la ronda final ordenados desde el mas recomendable hasta el menos completo, indicando su calificacion y horas estimadas."
              />
            </div>
            <p className="mt-1 text-xs text-graphite-400">
              Ordenados desde el plan mas completo y conveniente para ti
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-black/50 font-mono text-[10px] uppercase tracking-wider text-graphite-400">
                  <th className="px-3.5 py-2.5">Opcion</th>
                  <th className="px-3.5 py-2.5">Pasos activos (1=Si, 0=No)</th>
                  <th className="px-3.5 py-2.5">Calidad del plan</th>
                  <th className="px-3.5 py-2.5">Tiempo estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(genetic.generations.at(-1)?.individuals ?? []).map((ind) => (
                  <tr key={ind.id} className="bg-black/20 transition hover:bg-aura-500/10">
                    <td className="px-3.5 py-2.5 font-mono font-semibold text-aura-400">{ind.id}</td>
                    <td className="px-3.5 py-2.5 font-mono tracking-widest text-bone">{ind.binary}</td>
                    <td className="px-3.5 py-2.5 font-mono font-bold text-emerald-400">{ind.fitness}%</td>
                    <td className="px-3.5 py-2.5 font-mono text-amber-300">{ind.cost} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
})

function ChromosomeRow({
  label,
  binary,
  cutPoint,
  mode,
}: {
  label: string
  binary: string
  cutPoint: number
  mode: 'parentA' | 'parentB' | 'child' | 'beforeMut' | 'afterMut'
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] text-graphite-300">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {binary.split('').map((bit, idx) => {
          const isFirstHalf = idx < cutPoint
          const isMutatedBit = (mode === 'beforeMut' || mode === 'afterMut') && idx === cutPoint
          let cellStyle = 'border-white/15 bg-black/40 text-graphite-300'
          if (isMutatedBit) {
            cellStyle =
              mode === 'afterMut'
                ? 'border-purple-400 bg-purple-500/30 text-white shadow-[0_0_12px_rgba(168,85,247,0.7)]'
                : 'border-amber-400/50 bg-amber-500/20 text-amber-300'
          } else if (mode === 'parentA' || (mode === 'child' && isFirstHalf)) {
            cellStyle = 'border-aura-500/50 bg-aura-500/20 text-bone'
          } else if (mode === 'parentB' || (mode === 'child' && !isFirstHalf)) {
            cellStyle = 'border-sky-400/50 bg-sky-500/20 text-sky-200'
          }
          return (
            <span
              key={`${label}-${idx}`}
              style={{ '--b-delay': idx } as CSSProperties}
              className={`bubble-pop flex h-7 w-7 items-center justify-center rounded-lg border font-mono text-xs font-bold ${cellStyle}`}
            >
              {bit}
            </span>
          )
        })}
      </div>
    </div>
  )
}

const GeneticConvergenceBubbleChart = memo(function GeneticConvergenceBubbleChart({
  generations,
}: {
  generations: GeneticSummary['generations']
}) {
  const width = 560
  const height = 245
  const left = 44
  const right = 24
  const top = 28
  const bottom = 42
  const plotW = width - left - right
  const plotH = height - top - bottom

  const x = (idx: number) =>
    left + (generations.length <= 1 ? plotW / 2 : (idx / (generations.length - 1)) * plotW)
  const y = (val: number) => top + plotH - (Math.min(100, Math.max(0, val)) / 100) * plotH

  const bestPts = generations.map((g, i) => `${x(i)},${y(g.best_fitness)}`).join(' ')
  const avgPts = generations.map((g, i) => `${x(i)},${y(g.avg_fitness)}`).join(' ')

  return (
    <section
      className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-3 rounded-2xl p-5"
      aria-label="Evolucion de la aptitud fitness por generacion"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-aura-400" aria-hidden="true" />
          <h5 className="hud-label text-bone">Como mejora tu plan en cada ronda</h5>
          <AuraInfoBubble
            title="Progreso ronda por ronda"
            explanation="Muestra como sube la calificacion de tu plan desde la primera ronda de prueba hasta la ronda final."
            benefit="La linea naranja es el mejor plan encontrado y la linea azul es el promedio de todos los planes probados."
          />
        </div>
        <span className="font-mono text-[11px] text-emerald-400">
          Calidad final: {generations.at(-1)?.best_fitness ?? 95}%
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full rounded-xl border border-white/5 bg-[#09090d]"
        role="img"
        aria-label="Grafica de evolucion generacional del algoritmo genetico"
      >
        <defs>
          <radialGradient id="bubble-orange-gen" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#ffb347" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0.75" />
          </radialGradient>
          <radialGradient id="bubble-cyan-gen" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#7dd3fc" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.75" />
          </radialGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((pct) => {
          const gy = y(pct)
          return (
            <g key={pct}>
              <line x1={left} y1={gy} x2={width - right} y2={gy} stroke="#ffffff" strokeOpacity="0.07" strokeDasharray="3 5" />
              <text x={left - 8} y={gy + 3} textAnchor="end" fill="#7a7a85" fontSize="9" fontFamily="monospace">
                {pct}%
              </text>
            </g>
          )
        })}

        {avgPts && (
          <polyline
            points={avgPts}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.2"
            strokeDasharray="5 4"
          />
        )}
        {bestPts && (
          <polyline
            points={bestPts}
            fill="none"
            stroke="#ff7a1a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {generations.map((g, i) => {
          const cx = x(i)
          const cyBest = y(g.best_fitness)
          const cyAvg = y(g.avg_fitness)
          return (
            <g key={g.generation} style={{ '--b-delay': i } as CSSProperties} className="bubble-pop">
              <circle
                cx={cx}
                cy={cyAvg}
                r="7"
                fill="url(#bubble-cyan-gen)"
                className="bubble-float"
              >
                <title>{`G${g.generation} Promedio: ${g.avg_fitness}%`}</title>
              </circle>
              <circle
                cx={cx}
                cy={cyBest}
                r="9.5"
                fill="url(#bubble-orange-gen)"
                className="bubble-float"
              >
                <title>{`G${g.generation} Mejor Fitness: ${g.best_fitness}%`}</title>
              </circle>
              <text
                x={cx}
                y={cyBest - 13}
                textAnchor="middle"
                fill="#f4eee8"
                fontSize="9"
                fontFamily="monospace"
              >
                {g.best_fitness}%
              </text>
              <text x={cx} y={height - 14} textAnchor="middle" fill="#a1a1aa" fontSize="9" fontFamily="monospace">
                Gen {g.generation}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-graphite-300">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-aura-500 shadow-[0_0_8px_var(--color-aura-500)]" />
          Burbujas Naranja: Mejor individuo por generacion
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-sky-400" />
          Burbujas Cian: Fitness promedio de la poblacion
        </span>
      </div>
    </section>
  )
})

const GeneticPopulationBubbleMap = memo(function GeneticPopulationBubbleMap({
  heuristics,
  activeNodeId,
  onSelectNode,
}: {
  heuristics: NodeHeuristic[]
  activeNodeId: string | null
  onSelectNode: (id: string) => void
}) {
  const width = 560
  const height = 245
  const padX = 48
  const padY = 34
  const plotW = width - padX * 2
  const plotH = height - padY * 2
  const maxManhattan = Math.max(1, ...heuristics.map((n) => n.manhattan))

  return (
    <section
      className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-3 rounded-2xl p-5"
      aria-label="Mapa de burbujas de aptitud por gen y nodo"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sky-400" aria-hidden="true" />
          <h5 className="hud-label text-bone">Burbujas de Preparacion: Cuanto te acerca cada paso</h5>
          <AuraInfoBubble
            title="Que representan estas burbujas"
            explanation="Cada burbuja es una habilidad, curso o proyecto de tu mapa. Mientras mas grande y mas arriba este la burbuja, mas cerca te deja de tu puesto objetivo."
            benefit="Haz clic en cualquier burbuja para ver su detalle en el mapa 3D."
          />
        </div>
        <span className="font-mono text-[11px] text-graphite-400">Tamano = Nivel de avance (%)</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full rounded-xl border border-white/5 bg-[#09090d]"
        role="img"
        aria-label="Grafica de burbujas donde cada nodo tiene tamano proporcional a su aptitud"
      >
        <defs>
          <radialGradient id="gloss-bubble-primary" cx="32%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="30%" stopColor="#ffb347" stopOpacity="0.88" />
            <stop offset="80%" stopColor="#ff7a1a" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#9a3412" stopOpacity="0.4" />
          </radialGradient>
          <radialGradient id="gloss-bubble-goal" cx="32%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#6ee7b7" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.65" />
          </radialGradient>
          <radialGradient id="gloss-bubble-node" cx="32%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="35%" stopColor="#7dd3fc" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.55" />
          </radialGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padX}
            y1={padY + plotH * f}
            x2={width - padX}
            y2={padY + plotH * f}
            stroke="#ffffff"
            strokeOpacity="0.06"
            strokeDasharray="3 5"
          />
        ))}

        {heuristics.map((node, idx) => {
          const cx =
            padX +
            (heuristics.length <= 1 ? plotW / 2 : (idx / (heuristics.length - 1)) * plotW)
          const closeness = 1 - Math.min(1, node.manhattan / maxManhattan)
          const cy = padY + plotH - closeness * plotH
          const alt = node.altitude ?? 50
          const r = 8 + (alt / 100) * 14
          const isSelected = node.node_id === activeNodeId
          const isGoal = node.node_type === 'role'
          const fillUrl = isGoal
            ? 'url(#gloss-bubble-goal)'
            : isSelected
              ? 'url(#gloss-bubble-primary)'
              : 'url(#gloss-bubble-node)'

          return (
            <g
              key={node.node_id}
              onClick={() => onSelectNode(node.node_id)}
              style={{ '--b-delay': idx } as CSSProperties}
              className="bubble-pop cursor-pointer"
            >
              <g className="bubble-float" style={{ '--b-delay': idx } as CSSProperties}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + 4}
                  fill="none"
                  stroke={isSelected ? '#ff7a1a' : '#38bdf8'}
                  strokeOpacity={isSelected ? 0.55 : 0.18}
                  strokeWidth="1.5"
                />
                <circle cx={cx} cy={cy} r={r} fill={fillUrl} />
                <text
                  x={cx}
                  y={cy + 3}
                  textAnchor="middle"
                  fill="#09090d"
                  fontSize="8"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {Math.round(alt)}%
                </text>
                <text
                  x={cx}
                  y={cy - r - 6}
                  textAnchor="middle"
                  fill={isSelected ? '#f4eee8' : '#a1a1aa'}
                  fontSize="8.5"
                >
                  {node.label.slice(0, 11)}
                </text>
              </g>
            </g>
          )
        })}
      </svg>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-graphite-300">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-sky-400" />
          Burbujas interactivas: haz clic para inspeccionar el gen/nodo
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
          Esmeralda: Cima / Rol Objetivo (100%)
        </span>
      </div>
    </section>
  )
})

function AlgorithmConceptModal({
  initialAlgorithm,
  genetic,
  onClose,
}: {
  initialAlgorithm: SearchAlgorithm
  genetic: GeneticSummary
  onClose: () => void
}) {
  const [selectedAlg, setSelectedAlg] = useState<SearchAlgorithm>(initialAlgorithm)
  const [activeStepIdx, setActiveStepIdx] = useState(0)

  const info = ALGORITHMS.find((a) => a.value === selectedAlg) ?? ALGORITHMS[0]!

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStepIdx((prev) => (prev + 1) % info.flowSteps.length)
    }, 1500)
    return () => window.clearInterval(timer)
  }, [info.flowSteps.length])

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Concepto y arquitectura animada de ${info.label}`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-surface card-stagger relative flex max-h-[92vh] w-full max-w-5xl flex-col gap-6 overflow-y-auto rounded-3xl p-6 md:p-8"
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="hud-label text-aura-400">
              Arquitectura Algoritmica y Simulacion Visual en Tiempo Real
            </p>
            <h3 className="mt-1 font-display text-2xl font-bold text-bone">{info.label}</h3>
          </div>

          <div className="flex items-center gap-3">
            <AuraBadge tone="aura">
              Paso {activeStepIdx + 1} / {info.flowSteps.length}
            </AuraBadge>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="btn-jelly neo flex h-10 w-10 items-center justify-center rounded-xl text-graphite-300 hover:text-aura-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex shrink-0 flex-wrap gap-2">
          {ALGORITHMS.map((alg) => (
            <button
              key={alg.value}
              type="button"
              onClick={() => {
                setSelectedAlg(alg.value)
                setActiveStepIdx(0)
              }}
              className={`btn-jelly rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                selectedAlg === alg.value
                  ? 'border-aura-500 bg-aura-500/20 text-bone shadow-[0_0_16px_-4px_var(--color-aura-500)]'
                  : 'border-white/10 bg-black/25 text-graphite-300 hover:text-bone'
              }`}
            >
              {alg.label.split('/')[0]?.trim()}
            </button>
          ))}
        </div>

        <div className="grid shrink-0 gap-4 md:grid-cols-2">
          <div className="bubble-card card-shimmer rounded-2xl border border-white/10 p-5">
            <p className="hud-label text-aura-400">Fundamento Teorico del Algoritmo</p>
            <p className="mt-2 text-xs leading-relaxed text-bone">{info.concept}</p>
          </div>
          <div className="bubble-card card-shimmer rounded-2xl border border-white/10 p-5">
            <p className="hud-label text-sky-400">Aplicacion y Aportacion en AURA</p>
            <p className="mt-2 text-xs leading-relaxed text-bone">{info.application}</p>
          </div>
        </div>

        <section className="shrink-0 rounded-2xl border border-aura-500/30 bg-[#09090d] p-5 shadow-inner">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="hud-label text-aura-400">
              {selectedAlg === 'genetico'
                ? 'Arbol Evolutivo Darwiniano: Seleccion, Cruza de Cromosomas y Mutacion'
                : selectedAlg === 'hill_climbing'
                  ? 'Topografia de Ascenso de Colina: Cresta Local, Meseta y Cima Global'
                  : selectedAlg === 'bfs' || selectedAlg === 'dfs'
                    ? `Arbol Jerarquico de Exploracion (${selectedAlg.toUpperCase()})`
                    : `Red Ponderada y Geometria Heuristica (${selectedAlg.toUpperCase()})`}
            </span>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs text-emerald-400">
              Etapa activa: {info.flowSteps[activeStepIdx]?.title} — {info.flowSteps[activeStepIdx]?.subtitle}
            </span>
          </div>

          <div className="h-[270px] w-full overflow-hidden rounded-xl border border-white/5 bg-[#07080c]">
            <AlgorithmVisualStage
              algorithm={selectedAlg}
              step={activeStepIdx}
              genetic={genetic}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {info.flowSteps.map((st, idx) => (
              <button
                key={st.title}
                type="button"
                onClick={() => setActiveStepIdx(idx)}
                className={`rounded-xl border px-2.5 py-2 text-left transition ${
                  idx === activeStepIdx
                    ? 'border-aura-500 bg-aura-500/20 text-white'
                    : 'border-white/5 bg-white/[0.03] text-slate-400 hover:text-white'
                }`}
              >
                <p className="truncate font-mono text-[10px] font-bold text-aura-400">{st.title}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-300">{st.subtitle}</p>
              </button>
            ))}
          </div>
        </section>

        {selectedAlg === 'genetico' && (
          <section className="grid shrink-0 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {genetic.components.map((c, idx) => (
              <div
                key={c.id}
                style={{ '--stagger': idx + 1 } as CSSProperties}
                className="bubble-card card-shimmer rounded-2xl border border-white/10 p-4 text-xs"
              >
                <div className="flex items-center justify-between">
                  <p className="font-display font-bold text-aura-400">{c.title}</p>
                  <span className="font-mono text-[11px] font-semibold text-emerald-400">{c.score_pct}%</span>
                </div>
                <p className="mt-1.5 leading-relaxed text-graphite-300">{c.concept}</p>
                <p className="mt-2 rounded-lg bg-black/35 px-2.5 py-1.5 font-mono text-[10px] text-sky-300">
                  {c.example}
                </p>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>,
    document.body,
  )
}

function AlgorithmVisualStage({
  algorithm,
  step,
  genetic,
}: {
  algorithm: SearchAlgorithm
  step: number
  genetic: GeneticSummary
}) {
  if (algorithm === 'genetico') {
    const pA = genetic.crossover_events[0]?.parent_a_binary ?? '11010110'
    const pB = genetic.crossover_events[0]?.parent_b_binary ?? '10111001'
    const child = genetic.crossover_events[0]?.child_binary ?? '11011001'
    const mutated = genetic.mutation_events[0]?.after_binary ?? '11011101'
    return (
      <svg viewBox="0 0 780 260" className="h-full w-full" role="img" aria-label="Arbol evolutivo del algoritmo genetico">
        <defs>
          <radialGradient id="ga-orb-orange" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#ffb347" />
            <stop offset="100%" stopColor="#ff7a1a" />
          </radialGradient>
          <radialGradient id="ga-orb-cyan" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#0284c7" />
          </radialGradient>
          <radialGradient id="ga-orb-emerald" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#059669" />
          </radialGradient>
        </defs>

        {/* Ramas del arbol genealogico evolutivo */}
        <path d="M 140 52 C 140 95, 270 85, 270 125" fill="none" stroke={step >= 2 ? '#ff7a1a' : '#334155'} strokeWidth="2.5" strokeDasharray="5 5" className="mv-flow" />
        <path d="M 310 52 C 310 95, 270 85, 270 125" fill="none" stroke={step >= 2 ? '#38bdf8' : '#334155'} strokeWidth="2.5" strokeDasharray="5 5" className="mv-flow" />
        <path d="M 480 52 C 480 95, 520 85, 520 125" fill="none" stroke={step >= 2 ? '#38bdf8' : '#334155'} strokeWidth="2" strokeDasharray="4 4" />
        <path d="M 640 52 C 640 95, 520 85, 520 125" fill="none" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 4" />

        {/* Cruza (Crossover) hacia Hijo y Mutacion */}
        <path d="M 270 150 C 270 185, 390 175, 390 212" fill="none" stroke={step >= 3 ? '#ff7a1a' : '#334155'} strokeWidth="3" strokeDasharray="6 5" className="mv-flow" />
        <path d="M 520 150 C 520 185, 390 175, 390 212" fill="none" stroke={step >= 3 ? '#38bdf8' : '#334155'} strokeWidth="3" strokeDasharray="6 5" className="mv-flow" />
        <path d="M 390 212 L 625 212" fill="none" stroke={step >= 4 ? '#10b981' : '#334155'} strokeWidth="3" strokeDasharray="6 5" className="mv-flow" />

        {/* Nivel 1: Poblacion de Individuos (Cromosomas) */}
        {[
          { x: 140, label: 'Individuo 1 (Padre A)', bin: pA.slice(0, 6), fit: '92%', elite: true },
          { x: 310, label: 'Individuo 2 (Padre B)', bin: pB.slice(0, 6), fit: '88%', elite: true },
          { x: 480, label: 'Individuo 3', bin: '011010', fit: '74%', elite: false },
          { x: 640, label: 'Individuo 4', bin: '010100', fit: '61%', elite: false },
        ].map((ind, idx) => (
          <g key={ind.label}>
            <rect
              x={ind.x - 68}
              y={16}
              width="136"
              height="40"
              rx="10"
              fill={step === 0 || (step >= 1 && ind.elite) ? '#1e293b' : '#0f172a'}
              stroke={ind.elite && step >= 1 ? '#ff7a1a' : '#334155'}
              strokeWidth={ind.elite && step >= 1 ? 2 : 1}
            />
            <text x={ind.x} y={31} textAnchor="middle" fill="#f8fafc" fontSize="9" fontWeight="bold">
              {ind.label}
            </text>
            <text x={ind.x} y={46} textAnchor="middle" fill={idx === 0 ? '#ffb347' : '#7dd3fc'} fontSize="9.5" fontFamily="monospace">
              [{ind.bin}] Fit:{ind.fit}
            </text>
          </g>
        ))}

        {/* Nivel 2: Seleccion y Cruza (Crossover) */}
        <g>
          <rect
            x={175}
            y={114}
            width="190"
            height="42"
            rx="12"
            fill={step === 2 || step === 3 ? '#271712' : '#0f172a'}
            stroke={step >= 2 ? '#ff7a1a' : '#475569'}
            strokeWidth="2"
          />
          <text x={270} y={131} textAnchor="middle" fill="#ffb347" fontSize="9.5" fontWeight="bold">
            4. Seleccion + 5. Cruza (Crossover)
          </text>
          <text x={270} y={146} textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="monospace">
            {pA.slice(0, 3)} | {pB.slice(3, 6)} -&gt; Hijo [{child.slice(0, 6)}]
          </text>
        </g>

        <g>
          <rect
            x={430}
            y={114}
            width="180"
            height="42"
            rx="12"
            fill={step === 4 ? '#231433' : '#0f172a'}
            stroke={step >= 4 ? '#c084fc' : '#475569'}
            strokeWidth="2"
          />
          <text x={520} y={131} textAnchor="middle" fill="#d8b4fe" fontSize="9.5" fontWeight="bold">
            6. Operador de Mutacion
          </text>
          <text x={520} y={146} textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="monospace">
            Bit #4 invertido -&gt; [{mutated.slice(0, 6)}]
          </text>
        </g>

        {/* Nivel 3: Hijo Hibrido y Convergencia Optima */}
        <g>
          <circle cx={390} cy={212} r={step === 3 || step === 4 ? 22 : 18} fill="url(#ga-orb-cyan)" />
          <text x={390} y={215} textAnchor="middle" fill="#09090d" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
            HIJO
          </text>
          <text x={390} y={246} textAnchor="middle" fill="#7dd3fc" fontSize="9.5" fontFamily="monospace">
            Cromosoma Hibrido [{mutated.slice(0, 6)}]
          </text>
        </g>

        <g>
          <circle cx={650} cy={212} r={step === 5 ? 25 : 20} fill="url(#ga-orb-emerald)" />
          <text x={650} y={215} textAnchor="middle" fill="#052e16" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
            {genetic.best_individual.fitness}%
          </text>
          <text x={650} y={246} textAnchor="middle" fill="#6ee7b7" fontSize="10" fontWeight="bold">
            Solucion Convergente Optima
          </text>
        </g>
      </svg>
    )
  }

  if (algorithm === 'hill_climbing') {
    const climberPositions: [number, number, string][] = [
      [85, 210, 'Valle Inicial (24%)'],
      [215, 145, 'Ascenso Local (58%)'],
      [345, 118, 'Cresta / Meseta (72%)'],
      [485, 118, 'Hombro Superado (76%)'],
      [655, 44, 'Cima Global: Rol (100%)'],
    ]
    const activePos = climberPositions[step % climberPositions.length] ?? climberPositions[0]!
    return (
      <svg viewBox="0 0 780 260" className="h-full w-full" role="img" aria-label="Topografia de ascenso Hill Climbing">
        <defs>
          <linearGradient id="mountain-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#09090d" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {[60, 115, 170, 220].map((yLine, idx) => (
          <g key={yLine}>
            <line x1="40" y1={yLine} x2="740" y2={yLine} stroke="#334155" strokeOpacity="0.35" strokeDasharray="4 6" />
            <text x="34" y={yLine + 3} textAnchor="end" fill="#64748b" fontSize="8.5" fontFamily="monospace">
              {100 - idx * 25}%
            </text>
          </g>
        ))}

        {/* Silueta de montana con optimo local, meseta y cima global */}
        <path
          d="M 50 225 L 85 210 C 145 190, 180 135, 215 145 C 260 158, 300 118, 345 118 L 485 118 C 545 118, 600 44, 655 44 L 730 95 L 730 235 L 50 235 Z"
          fill="url(#mountain-grad)"
        />
        <path
          d="M 50 225 L 85 210 C 145 190, 180 135, 215 145 C 260 158, 300 118, 345 118 L 485 118 C 545 118, 600 44, 655 44 L 730 95"
          fill="none"
          stroke="#ff7a1a"
          strokeWidth="3.5"
        />

        {climberPositions.map(([px, py, lbl], idx) => (
          <g key={lbl}>
            <circle
              cx={px}
              cy={py}
              r={idx === step % climberPositions.length ? 12 : 6.5}
              fill={idx === 4 ? '#10b981' : idx === step % climberPositions.length ? '#ffb347' : '#1e293b'}
              stroke="#f8fafc"
              strokeWidth="2"
            />
            <text
              x={px}
              y={py - 16}
              textAnchor="middle"
              fill={idx === step % climberPositions.length ? '#ffb347' : '#cbd5e1'}
              fontSize="9"
              fontWeight={idx === step % climberPositions.length ? 'bold' : 'normal'}
            >
              {lbl}
            </text>
          </g>
        ))}

        <circle cx={activePos[0]} cy={activePos[1]} r="18" fill="none" stroke="#ffb347" strokeWidth="2" className="mv-pulse" />
      </svg>
    )
  }

  if (algorithm === 'bfs' || algorithm === 'dfs') {
    const isBfs = algorithm === 'bfs'
    const treeNodes = [
      { id: 'R', label: 'Perfil (d=0)', x: 390, y: 36, level: 0, dfsOrder: 0 },
      { id: 'A', label: 'Skill Core (d=1)', x: 190, y: 105, level: 1, dfsOrder: 1 },
      { id: 'B', label: 'Skill Aux (d=1)', x: 390, y: 105, level: 1, dfsOrder: 3 },
      { id: 'C', label: 'Recurso (d=1)', x: 590, y: 105, level: 1, dfsOrder: 2 },
      { id: 'A1', label: 'Curso A (d=2)', x: 120, y: 178, level: 2, dfsOrder: 1 },
      { id: 'A2', label: 'Proyecto (d=2)', x: 260, y: 178, level: 2, dfsOrder: 2 },
      { id: 'B1', label: 'Curso B (d=2)', x: 390, y: 178, level: 2, dfsOrder: 3 },
      { id: 'G', label: 'Rol Meta (d=3)', x: 590, y: 222, level: 3, dfsOrder: 3 },
    ]
    const treeEdges: [string, string, boolean][] = [
      ['R', 'A', false],
      ['R', 'B', false],
      ['R', 'C', false],
      ['A', 'A1', true],
      ['A', 'A2', false],
      ['B', 'B1', false],
      ['C', 'G', false],
    ]
    const byKey = new Map(treeNodes.map((n) => [n.id, n]))
    return (
      <svg viewBox="0 0 780 260" className="h-full w-full" role="img" aria-label={`Arbol jerarquico ${algorithm.toUpperCase()}`}>
        {treeEdges.map(([fromId, toId, isBacktrack]) => {
          const a = byKey.get(fromId)!
          const b = byKey.get(toId)!
          return (
            <line
              key={`${fromId}-${toId}`}
              x1={a.x}
              y1={a.y + 16}
              x2={b.x}
              y2={b.y - 16}
              stroke={!isBfs && isBacktrack && step >= 2 ? '#f43f5e' : '#ff7a1a'}
              strokeWidth="2.4"
              strokeDasharray={!isBfs && isBacktrack ? '5 4' : '6 6'}
              className="mv-flow"
            />
          )
        })}

        {treeNodes.map((n) => {
          const active = isBfs ? n.level === step % 4 : n.dfsOrder === step % 4
          return (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r={active ? 20 : 15}
                fill={n.id === 'G' ? '#10b981' : active ? '#ff7a1a' : '#1e293b'}
                stroke={active ? '#ffffff' : '#64748b'}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <text x={n.x} y={n.y + 3} textAnchor="middle" fill="#f8fafc" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                {n.id}
              </text>
              <text x={n.x} y={n.y + 30} textAnchor="middle" fill={active ? '#ffb347' : '#cbd5e1'} fontSize="8.5">
                {n.label}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 780 260" className="h-full w-full" role="img" aria-label="Grafo ponderado con heuristica geometrica">
      {/* Ruta superior costosa vs Ruta inferior optima */}
      <line x1="110" y1="135" x2="290" y2="62" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="290" y1="62" x2="650" y2="135" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />

      <line x1="110" y1="135" x2="290" y2="195" stroke="#ff7a1a" strokeWidth="3" strokeDasharray="6 6" className="mv-flow" />
      <line x1="290" y1="195" x2="480" y2="195" stroke="#ff7a1a" strokeWidth="3" strokeDasharray="6 6" className="mv-flow" />
      <line x1="480" y1="195" x2="650" y2="135" stroke="#10b981" strokeWidth="3" strokeDasharray="6 6" className="mv-flow" />

      {/* Triangulo Manhattan L1 + Euclidiana L2 desde el nodo intermedio a la meta */}
      <line x1="290" y1="195" x2="650" y2="195" stroke="#ffb347" strokeWidth="1.8" strokeDasharray="4 3" />
      <line x1="650" y1="195" x2="650" y2="135" stroke="#ffb347" strokeWidth="1.8" strokeDasharray="4 3" />
      <line x1="290" y1="195" x2="650" y2="135" stroke="#38bdf8" strokeWidth="2.2" />

      <text x="470" y="212" textAnchor="middle" fill="#ffb347" fontSize="9" fontFamily="monospace">
        Cateto Manhattan |x1 - x2| = 6.0
      </text>
      <text x="465" y="156" textAnchor="middle" fill="#38bdf8" fontSize="9" fontFamily="monospace">
        Hipotenusa Euclidiana L2 = 6.32
      </text>

      {[
        { x: 110, y: 135, label: 'Perfil (g=0, h=9)', idx: 0 },
        { x: 290, y: 62, label: 'Ruta Cara (g=12, f=17)', idx: 1 },
        { x: 290, y: 195, label: 'Skill Optima (g=2, h=6)', idx: 2 },
        { x: 480, y: 195, label: 'Proyecto (g=4, h=2)', idx: 3 },
        { x: 650, y: 135, label: 'Rol Meta (g=5, h=0)', idx: 4 },
      ].map((n) => {
        const active = n.idx === step % 5
        return (
          <g key={n.label}>
            <circle
              cx={n.x}
              cy={n.y}
              r={active ? 21 : 16}
              fill={n.idx === 4 ? '#10b981' : active ? '#ff7a1a' : '#1e293b'}
              stroke="#f8fafc"
              strokeWidth={active ? 2.5 : 1.5}
            />
            <text x={n.x} y={n.y - 24} textAnchor="middle" fill={active ? '#ffb347' : '#e2e8f0'} fontSize="9" fontWeight="bold">
              {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const HillClimbingDashboard = memo(function HillClimbingDashboard({
  summary,
  activeNodeId,
  heuristicLabel,
  onSelectNode,
  onOpenModal,
}: {
  summary: HillClimbingSummary
  activeNodeId: string | null
  heuristicLabel: string
  onSelectNode: (id: string) => void
  onOpenModal: () => void
}) {
  return (
    <div className="flex flex-col gap-6" aria-label="Panel de Avance Paso a Paso">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-1.5 rounded-2xl p-4">
          <span className="flex items-center justify-between gap-1.5 text-[0.65rem] uppercase tracking-widest text-graphite-400">
            <span className="flex items-center gap-1.5">
              <Mountain className="h-3.5 w-3.5 text-aura-400" />
              Resultado del camino
            </span>
            <AuraInfoBubble
              title="Resultado de tu avance paso a paso"
              explanation="Indica si eligiendo siempre el paso mas prometedor frente a ti logras llegar directo al 100% del puesto objetivo."
            />
          </span>
          <p className="font-display text-lg font-semibold text-bone">
            {summary.reached_global_optimum ? 'Meta Alcanzada (100%)' : 'Pausa Intermedia'}
          </p>
          <span className="text-[0.68rem] text-aura-300">
            {summary.reached_global_optimum ? 'Llegas directo al rol objetivo' : 'Requiere explorar un paso lateral'}
          </span>
        </div>

        <div className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-1.5 rounded-2xl p-4">
          <span className="flex items-center justify-between gap-1.5 text-[0.65rem] uppercase tracking-widest text-graphite-400">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-amber-300" />
              Mayor avance en 1 paso
            </span>
            <AuraInfoBubble
              title="Tu salto mas grande de avance"
              explanation="Muestra cuanto te acerco a la meta el paso individual mas efectivo de toda tu ruta."
            />
          </span>
          <p className="font-mono text-xl font-semibold text-amber-300">+{summary.steepest_gain}</p>
          <span className="text-[0.68rem] text-graphite-400">Medido {heuristicLabel.toLowerCase()}</span>
        </div>

        <div className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-1.5 rounded-2xl p-4">
          <span className="flex items-center justify-between gap-1.5 text-[0.65rem] uppercase tracking-widest text-graphite-400">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-sky-400" />
              Velocidad de mejora
            </span>
            <AuraInfoBubble
              title="Avance por cada hora invertida"
              explanation="Indica que tanto sube tu preparacion hacia el puesto por cada hora de estudio que dedicas."
            />
          </span>
          <p className="font-mono text-xl font-semibold text-sky-300">{summary.average_slope}% / h</p>
          <span className="text-[0.68rem] text-graphite-400">Avance ganado por hora de estudio</span>
        </div>

        <div className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-1.5 rounded-2xl p-4">
          <span className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-graphite-400">
            <span>Tramos planos</span>
            <AuraInfoBubble
              title="Que son los tramos planos"
              explanation="Son pasos de preparacion (como tomar un curso base antes de un proyecto) donde primero te preparas para dar el siguiente gran salto."
            />
          </span>
          <p className="font-mono text-xl font-semibold text-purple-300">
            {summary.plateaus_count} / {summary.local_optima_count}
          </p>
          <span className="text-[0.68rem] text-graphite-400">Pasos de preparacion previa</span>
        </div>

        <div className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-1.5 rounded-2xl p-4">
          <span className="text-[0.65rem] uppercase tracking-widest text-graphite-400">Explicacion Visual</span>
          <AuraButton size="sm" variant="neo" icon={Eye} onClick={onOpenModal}>
            Ver como funciona
          </AuraButton>
          <span className="text-[0.68rem] text-graphite-400">{summary.total_neighbors_evaluated} opciones comparadas</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <HillElevationLandscapeChart
          steps={summary.steps}
          activeNodeId={activeNodeId}
          onSelectNode={onSelectNode}
        />
        <HillElevationBarChart
          profile={summary.elevation_profile}
          activeNodeId={activeNodeId}
          onSelectNode={onSelectNode}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DonutChartCard
          title="Como se eligieron tus pasos en cada etapa"
          subtitle="Proporcion de opciones elegidas por darte el mayor avance frente a opciones mas lentas descartadas"
          items={summary.outcome_distribution}
          centerLabel="Opciones"
          centerValue={summary.total_neighbors_evaluated}
        />
        <DonutChartCard
          title="Que incluye tu ruta de aprendizaje"
          subtitle="Reparto de tu plan entre habilidades, cursos recomendados, proyecto practico y rol meta"
          items={summary.node_type_distribution}
          centerLabel="Actividades"
          centerValue={summary.elevation_profile.length}
          showHours
        />
      </div>
    </div>
  )
})

const HillElevationLandscapeChart = memo(function HillElevationLandscapeChart({
  steps,
  activeNodeId,
  onSelectNode,
}: {
  steps: HillClimbingStep[]
  activeNodeId: string | null
  onSelectNode: (id: string) => void
}) {
  const width = 560
  const height = 240
  const left = 44
  const right = 24
  const top = 26
  const bottom = 42
  const plotW = width - left - right
  const plotH = height - top - bottom

  const x = (idx: number) =>
    left + (steps.length <= 1 ? plotW / 2 : (idx / (steps.length - 1)) * plotW)
  const yAlt = (alt: number) => top + plotH - (Math.min(100, Math.max(0, alt)) / 100) * plotH

  const maxH = Math.max(1, ...steps.map((s) => s.current_h))
  const yHeur = (hVal: number) => top + plotH - (Math.min(maxH, Math.max(0, hVal)) / maxH) * plotH

  const altPoints = steps.map((s, i) => `${x(i)},${yAlt(s.current_altitude)}`).join(' ')
  const areaPoints = steps.length
    ? `${x(0)},${top + plotH} ${altPoints} ${x(steps.length - 1)},${top + plotH}`
    : ''
  const heurPoints = steps.map((s, i) => `${x(i)},${yHeur(s.current_h)}`).join(' ')

  return (
    <section
      className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-3 rounded-2xl p-5"
      aria-label="Paisaje de ascenso de colina Hill Climbing"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChartArea className="h-4 w-4 text-aura-400" aria-hidden="true" />
          <h5 className="hud-label text-bone">Tu Subida Paso a Paso hacia el Puesto Meta</h5>
          <AuraInfoBubble
            title="Curva de subida hacia el puesto"
            explanation="La curva naranja muestra como sube tu porcentaje de preparacion en cada etapa hasta llegar al 100%, mientras la linea punteada azul muestra como se reduce lo que te falta por cubrir."
          />
        </div>
        <span className="font-mono text-[11px] text-aura-300">Meta = 100%</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full rounded-xl border border-white/5 bg-[#09090d]"
        role="img"
        aria-label="Curva de ascenso de colina paso a paso hasta el rol objetivo"
      >
        <defs>
          <linearGradient id="hill-climb-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.45" />
            <stop offset="65%" stopColor="#ffb547" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#09090d" stopOpacity="0.02" />
          </linearGradient>
          <radialGradient id="hill-bubble-grad" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#ffb347" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0.8" />
          </radialGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((pct) => {
          const gy = yAlt(pct)
          return (
            <g key={pct}>
              <line x1={left} y1={gy} x2={width - right} y2={gy} stroke="#ffffff" strokeOpacity="0.07" strokeDasharray="3 5" />
              <text x={left - 8} y={gy + 3} textAnchor="end" fill="#7a7a85" fontSize="9" fontFamily="monospace">
                {pct}%
              </text>
            </g>
          )
        })}

        {areaPoints && <polygon points={areaPoints} fill="url(#hill-climb-area)" />}
        {heurPoints && (
          <polyline
            points={heurPoints}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="5 4"
            opacity="0.85"
          />
        )}
        {altPoints && (
          <polyline
            points={altPoints}
            fill="none"
            stroke="#ff7a1a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {steps.map((s, i) => {
          const cx = x(i)
          const cy = yAlt(s.current_altitude)
          const isCurrent = s.current_id === activeNodeId
          const isGoal = s.status === 'meta'
          return (
            <g
              key={`${s.step}-${s.current_id}`}
              onClick={() => onSelectNode(s.current_id)}
              style={{ '--b-delay': i } as CSSProperties}
              className="bubble-pop cursor-pointer"
            >
              <circle
                cx={cx}
                cy={cy}
                r={isGoal || isCurrent ? 9 : 7}
                fill="url(#hill-bubble-grad)"
                stroke="#f4eee8"
                strokeWidth={isCurrent ? 2.2 : 1}
                className="bubble-float"
              />
              <text
                x={cx}
                y={cy - 12}
                textAnchor="middle"
                fill="#f4eee8"
                fontSize="8.5"
                fontFamily="monospace"
              >
                {s.current_altitude}%
              </text>
              <text
                x={cx}
                y={height - 14}
                textAnchor="middle"
                fill="#a1a1aa"
                fontSize="8.5"
              >
                P{s.step}: {s.current_label.slice(0, 11)}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-graphite-300">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-aura-500" />
          Burbujas de Altitud Profesional (ascenso hacia 100%)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-sky-400" />
          Distancia heuristica restante h(n) (desciende a 0)
        </span>
      </div>
    </section>
  )
})

const HillElevationBarChart = memo(function HillElevationBarChart({
  profile,
  activeNodeId,
  onSelectNode,
}: {
  profile: HillClimbingSummary['elevation_profile']
  activeNodeId: string | null
  onSelectNode: (id: string) => void
}) {
  const width = 560
  const height = 240
  const left = 38
  const right = 18
  const top = 26
  const bottom = 46
  const plotW = width - left - right
  const plotH = height - top - bottom
  const items = profile.slice(0, 10)
  const slot = plotW / Math.max(1, items.length)
  const barW = Math.min(22, slot * 0.34)
  const maxH = Math.max(1, ...items.map((i) => i.manhattan))

  return (
    <section
      className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-3 rounded-2xl p-5"
      aria-label="Grafica de barras de altitud y heuristica por nodo"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChartColumn className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <h5 className="hud-label text-bone">Comparativa de Avance (%) y Lo que Falta por Actividad</h5>
          <AuraInfoBubble
            title="Que comparan estas barras"
            explanation="En cada actividad, la barra naranja te muestra que tan cerca del puesto te deja (%) y la barra azul cuanto camino resta despues de completarla."
          />
        </div>
        <span className="font-mono text-[11px] text-graphite-400">Clic en una barra para ver en 3D</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full rounded-xl border border-white/5 bg-[#09090d]"
        role="img"
        aria-label="Grafica de barras agrupadas de altitud y distancia heuristica por etapa"
      >
        {[0, 0.5, 1].map((f) => {
          const gy = top + plotH * (1 - f)
          return (
            <line
              key={f}
              x1={left}
              y1={gy}
              x2={width - right}
              y2={gy}
              stroke="#ffffff"
              strokeOpacity="0.07"
              strokeDasharray="3 5"
            />
          )
        })}

        {items.map((item, idx) => {
          const centerX = left + idx * slot + slot / 2
          const altHeight = (item.altitude / 100) * plotH
          const hRatio = Math.min(1, item.h / maxH)
          const hHeight = hRatio * plotH
          const isSelected = item.node_id === activeNodeId
          const altY = top + plotH - altHeight
          const hY = top + plotH - hHeight
          return (
            <g
              key={item.node_id}
              onClick={() => onSelectNode(item.node_id)}
              style={{ '--b-delay': idx } as CSSProperties}
              className="cursor-pointer"
            >
              {isSelected && (
                <rect
                  x={centerX - barW - 4}
                  y={top - 4}
                  width={barW * 2 + 8}
                  height={plotH + 8}
                  rx="8"
                  fill="#ff7a1a"
                  fillOpacity="0.12"
                  stroke="#ff7a1a"
                  strokeOpacity="0.4"
                />
              )}
              <rect
                x={centerX - barW - 1}
                y={altY}
                width={barW}
                height={Math.max(3, altHeight)}
                rx="6"
                fill={item.on_best_path ? '#ff7a1a' : '#9a4c10'}
                className="bar-grow"
                style={{ '--b-delay': idx } as CSSProperties}
              />
              <circle
                cx={centerX - barW / 2 - 1}
                cy={altY}
                r="4.5"
                fill="#ffd166"
                className="bubble-pop"
                style={{ '--b-delay': idx + 2 } as CSSProperties}
              />
              <rect
                x={centerX + 1}
                y={hY}
                width={barW}
                height={Math.max(3, hHeight)}
                rx="6"
                fill="#38bdf8"
                className="bar-grow"
                style={{ '--b-delay': idx + 1 } as CSSProperties}
              />
              <circle
                cx={centerX + barW / 2 + 1}
                cy={hY}
                r="4.5"
                fill="#bae6fd"
                className="bubble-pop"
                style={{ '--b-delay': idx + 3 } as CSSProperties}
              />
              <text
                x={centerX - barW / 2 - 1}
                y={altY - 7}
                textAnchor="middle"
                fill="#ffb547"
                fontSize="7.5"
                fontFamily="monospace"
              >
                {Math.round(item.altitude)}%
              </text>
              <text
                x={centerX + barW / 2 + 1}
                y={hY - 7}
                textAnchor="middle"
                fill="#7dd3fc"
                fontSize="7.5"
                fontFamily="monospace"
              >
                {item.h}
              </text>
              <text
                x={centerX}
                y={height - 14}
                textAnchor="middle"
                fill={isSelected ? '#f4eee8' : '#a1a1aa'}
                fontSize="8"
              >
                {item.label.slice(0, 9)}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-graphite-300">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-aura-500" />
          Barra Naranja: Altitud del nodo (%)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
          Barra Azul: Distancia heuristica h(n)
        </span>
      </div>
    </section>
  )
})

const DonutChartCard = memo(function DonutChartCard({
  title,
  subtitle,
  items,
  centerLabel,
  centerValue,
  showHours = false,
}: {
  title: string
  subtitle: string
  items: HillDistributionItem[]
  centerLabel: string
  centerValue: number
  showHours?: boolean
}) {
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const nonZero = items.filter((i) => i.count > 0)
  const total = Math.max(1, nonZero.reduce((sum, i) => sum + i.count, 0))

  const segments = useMemo(() => {
    let accumulated = 0
    return nonZero.map((item) => {
      const fraction = item.count / total
      const dash = fraction * circumference
      const offset = -accumulated * circumference
      accumulated += fraction
      return { ...item, dash, offset }
    })
  }, [nonZero, total, circumference])

  return (
    <section
      className="bubble-card card-stagger card-shimmer flex min-w-0 flex-col justify-between gap-5 overflow-hidden rounded-2xl p-5"
      aria-label={title}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <ChartPie className="h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
          <h5 className="hud-label truncate text-bone">{title}</h5>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-graphite-400">{subtitle}</p>
      </div>

      <div className="flex flex-col items-center gap-5">
        <div className="bubble-pop relative flex h-40 w-40 shrink-0 items-center justify-center">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label={title}>
            <circle cx="80" cy="80" r={radius} fill="none" stroke="#1f1f27" strokeWidth="20" />
            {segments.map((seg) => (
              <circle
                key={seg.key}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${seg.dash} ${circumference}`}
                strokeDashoffset={seg.offset}
              >
                <title>{`${seg.category}: ${seg.count} (${seg.percentage}%)`}</title>
              </circle>
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono text-2xl font-bold text-bone">{centerValue}</span>
            <span className="text-[10px] uppercase tracking-wider text-graphite-400">{centerLabel}</span>
          </div>
        </div>

        <ul className="grid w-full min-w-0 gap-2.5 sm:grid-cols-2">
          {items.map((item, idx) => (
            <li
              key={item.key}
              style={{ '--stagger': idx + 1 } as CSSProperties}
              className="card-stagger flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl border border-white/5 bg-black/35 p-3 text-xs"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate font-medium text-bone" title={item.category}>
                    {item.category}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-bone">{item.percentage}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="bar-grow h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(item.count > 0 ? 4 : 0, item.percentage)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-graphite-400">
                <span>Cantidad: {item.count}</span>
                {showHours && item.hours !== undefined && item.hours !== null && (
                  <span className="text-amber-300">Esfuerzo: {item.hours} h</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
})

const HeuristicFormulaLaboratory = memo(function HeuristicFormulaLaboratory({
  heuristics,
  activeNodeId,
  selectedHeuristic,
  onSelectHeuristic,
  onSelectNode,
}: {
  heuristics: NodeHeuristic[]
  activeNodeId: string | null
  selectedHeuristic: HeuristicType
  onSelectHeuristic: (h: HeuristicType) => void
  onSelectNode: (id: string) => void
}) {
  const active =
    heuristics.find((item) => item.node_id === activeNodeId) ??
    heuristics.find((item) => item.node_type === 'profile') ??
    heuristics[0]

  if (!active) return null

  const dx2 = Number((active.dx * active.dx).toFixed(2))
  const dy2 = Number((active.dy * active.dy).toFixed(2))
  const diff = Number(Math.max(0, active.manhattan - active.euclidean).toFixed(3))
  const ratio = active.euclidean > 0.001 ? Number((active.manhattan / active.euclidean).toFixed(3)) : 1
  const maxDistance = Math.max(1, ...heuristics.map((n) => n.manhattan))

  return (
    <div className="grid gap-5 lg:grid-cols-3" aria-label="Formas de medir tu cercania al puesto">
      <div
        onClick={() => onSelectHeuristic('manhattan')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelectHeuristic('manhattan')
        }}
        className={`btn-jelly bubble-card card-stagger card-shimmer flex cursor-pointer flex-col justify-between gap-3.5 rounded-2xl border p-5 text-left transition ${
          selectedHeuristic === 'manhattan'
            ? 'border-aura-500/60 bg-aura-500/10 shadow-[0_0_25px_rgba(255,122,26,0.12)]'
            : 'border-white/5 hover:border-aura-500/30'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-aura-400">
            <Ruler className="h-4 w-4" aria-hidden="true" />
            Medicion por Etapas y Habilidades
          </span>
          <div className="flex items-center gap-1.5">
            <AuraInfoBubble
              title="Medicion Paso a Paso (Por Etapas)"
              explanation="Calcula lo que te falta sumando dos cosas por separado: cuantas etapas de aprendizaje restan y que tan diferente es la habilidad frente al puesto."
              benefit="Es como caminar por las cuadras de una ciudad: primero avanzas en etapas y luego en afinidad tematica."
            />
            <span className="rounded-md bg-aura-500/20 px-2 py-0.5 font-mono text-[10px] text-aura-300">
              {selectedHeuristic === 'manhattan' ? 'EN USO' : 'ELEGIR'}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-aura-500/25 bg-black/45 px-3.5 py-2.5 text-xs text-bone">
          Falta por recorrer = Etapas por avanzar + Diferencia de especialidad
        </div>
        <div className="flex flex-col gap-1.5 font-mono text-xs text-graphite-300">
          <span>
            Etapas ({active.dx}) + Afinidad ({active.dy})
          </span>
          <span className="text-aura-300">
            Distancia total paso a paso = <strong className="text-base text-aura-400">{active.manhattan}</strong>
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[11px] text-graphite-400">
            <span>Etapas: {active.dx}</span>
            <span>Afinidad: {active.dy}</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-aura-500 transition-all"
              style={{ width: `${(active.dx / maxDistance) * 100}%` }}
            />
            <div
              className="h-full bg-amber-300 transition-all"
              style={{ width: `${(active.dy / maxDistance) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div
        onClick={() => onSelectHeuristic('euclidiana')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelectHeuristic('euclidiana')
        }}
        className={`btn-jelly bubble-card card-stagger card-shimmer flex cursor-pointer flex-col justify-between gap-3.5 rounded-2xl border p-5 text-left transition ${
          selectedHeuristic === 'euclidiana'
            ? 'border-sky-400/60 bg-sky-500/10 shadow-[0_0_25px_rgba(56,189,248,0.12)]'
            : 'border-white/5 hover:border-sky-400/30'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-300">
            <MoveDiagonal className="h-4 w-4" aria-hidden="true" />
            Medicion en Linea Recta
          </span>
          <div className="flex items-center gap-1.5">
            <AuraInfoBubble
              title="Medicion en Linea Directa"
              explanation="Traza una linea recta imaginaria entre la actividad en la que estas y el puesto objetivo para ver que tan cerca quedan en el mapa."
              benefit="Favorece las habilidades que van directo al corazon del puesto que buscas."
              example={`Para ${active.label}, la linea directa mide ${active.euclidean} (${dx2} + ${dy2} bajo raiz).`}
            />
            <span className="rounded-md bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] text-sky-300">
              {selectedHeuristic === 'euclidiana' ? 'EN USO' : 'ELEGIR'}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-sky-400/25 bg-black/45 px-3.5 py-2.5 text-xs text-bone">
          Cercania directa = Linea recta entre tu paso actual y la meta
        </div>
        <div className="flex flex-col gap-1.5 font-mono text-xs text-graphite-300">
          <span>
            De {active.label.slice(0, 18)} hacia el Rol Objetivo
          </span>
          <span className="text-sky-300">
            Distancia directa = <strong className="text-base text-sky-400">{active.euclidean}</strong>
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[11px] text-graphite-400">
            <span>Trayecto en linea recta</span>
            <span>{active.euclidean} u</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-all"
              style={{ width: `${(active.euclidean / maxDistance) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bubble-card card-stagger card-shimmer flex flex-col justify-between gap-3.5 rounded-2xl border border-white/5 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
            <Sigma className="h-4 w-4" aria-hidden="true" />
            Explorar una actividad
          </span>
          <AuraInfoBubble
            title="Comparador de actividades"
            explanation="Elige cualquier habilidad o curso de tu lista para ver que tan cerca te deja del puesto objetivo."
          />
        </div>
        <label className="flex flex-col gap-1.5 text-[0.65rem] uppercase tracking-wider text-graphite-400">
          Actividad seleccionada
          <select
            aria-label="Actividad seleccionada"
            value={active.node_id}
            onChange={(e) => onSelectNode(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 font-mono text-xs text-bone focus:border-aura-500 focus:outline-none"
          >
            {heuristics.map((item) => (
              <option key={item.node_id} value={item.node_id}>
                {item.label} (Avance: {item.altitude ?? 0}%)
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2 text-center font-mono">
          <div className="rounded-xl border border-white/5 bg-black/35 p-2">
            <p className="text-[9px] uppercase text-graphite-400">Diferencia</p>
            <p className="mt-0.5 text-xs text-amber-300">+{diff}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/35 p-2">
            <p className="text-[9px] uppercase text-graphite-400">Proporcion</p>
            <p className="mt-0.5 text-xs text-bone">{ratio}x</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-black/35 p-2">
            <p className="text-[9px] uppercase text-graphite-400">Avance</p>
            <p className="mt-0.5 text-xs text-emerald-400">{active.altitude ?? 0}%</p>
          </div>
        </div>
      </div>
    </div>
  )
})

const HeuristicGeometryPlane = memo(function HeuristicGeometryPlane({
  heuristics,
  activeNodeId,
  selectedHeuristic,
  onSelectNode,
}: {
  heuristics: NodeHeuristic[]
  activeNodeId: string | null
  selectedHeuristic: HeuristicType
  onSelectNode: (id: string) => void
}) {
  const width = 560
  const height = 270
  const padX = 48
  const padY = 34
  const plotW = width - padX * 2
  const plotH = height - padY * 2

  const bounds = useMemo(() => {
    const xs = heuristics.map((n) => n.x)
    const ys = heuristics.map((n) => n.y)
    const minX = Math.min(-7, ...xs) - 1
    const maxX = Math.max(8, ...xs) + 1
    const minY = Math.min(-6, ...ys) - 1
    const maxY = Math.max(6, ...ys) + 1
    return { minX, maxX, minY, maxY }
  }, [heuristics])

  const toSvgX = (x: number) => padX + ((x - bounds.minX) / Math.max(0.001, bounds.maxX - bounds.minX)) * plotW
  const toSvgY = (y: number) => padY + plotH - ((y - bounds.minY) / Math.max(0.001, bounds.maxY - bounds.minY)) * plotH

  const active =
    heuristics.find((n) => n.node_id === activeNodeId) ??
    heuristics.find((n) => n.node_type === 'profile') ??
    heuristics[0]
  const goal = heuristics.find((n) => n.node_type === 'role') ?? heuristics.at(-1)

  if (!active || !goal) return null

  const x1 = toSvgX(active.x)
  const y1 = toSvgY(active.y)
  const x2 = toSvgX(goal.x)
  const y2 = toSvgY(goal.y)
  const cornerX = x2
  const cornerY = y1

  const scaleX = plotW / Math.max(0.001, bounds.maxX - bounds.minX)
  const scaleY = plotH / Math.max(0.001, bounds.maxY - bounds.minY)
  const diamondRx = active.manhattan * scaleX
  const diamondRy = active.manhattan * scaleY
  const circleRx = active.euclidean * scaleX
  const circleRy = active.euclidean * scaleY

  const signX = x1 <= cornerX ? -1 : 1
  const signY = y2 <= cornerY ? -1 : 1
  const rightAngleSize = Math.min(10, Math.abs(x2 - x1) * 0.35, Math.abs(y2 - y1) * 0.35)

  return (
    <section
      className="bubble-card card-stagger card-shimmer flex min-w-0 flex-col justify-between gap-3 rounded-2xl p-5"
      aria-label="Plano geometrico 2D de distancia Manhattan y Euclidiana"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-aura-400" aria-hidden="true" />
          <h5 className="hud-label text-bone">Mapa Visual de Cercania: Paso a Paso vs Linea Directa</h5>
          <AuraInfoBubble
            title="Como leer este mapa 2D"
            explanation="Muestra todas las actividades de tu ruta. La linea punteada naranja es el recorrido por etapas y la linea azul continua es la distancia directa hacia el puesto."
            benefit="Haz clic en cualquier circulo para ver que tan cerca esta del rol objetivo."
          />
        </div>
        <span className="font-mono text-[11px] text-aura-300">
          {active.label} -&gt; {goal.label}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full rounded-xl border border-white/5 bg-[#09090d]"
        role="img"
        aria-label={`Plano de coordenadas con trayectoria Manhattan ${active.manhattan} y vector Euclidiano ${active.euclidean}`}
      >
        <defs>
          <linearGradient id="triangle-area-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {[-6, -3, 0, 3, 6].map((gx) => {
          const sx = toSvgX(gx)
          return (
            <g key={`gx-${gx}`}>
              <line x1={sx} y1={padY} x2={sx} y2={height - padY} stroke="#ffffff" strokeOpacity="0.06" strokeDasharray="2 4" />
              <text x={sx} y={height - 10} textAnchor="middle" fill="#6b6b76" fontSize="8.5" fontFamily="monospace">
                x={gx}
              </text>
            </g>
          )
        })}

        {[-4, -2, 0, 2, 4].map((gy) => {
          const sy = toSvgY(gy)
          return (
            <g key={`gy-${gy}`}>
              <line x1={padX} y1={sy} x2={width - padX} y2={sy} stroke="#ffffff" strokeOpacity="0.06" strokeDasharray="2 4" />
              <text x={padX - 6} y={sy + 3} textAnchor="end" fill="#6b6b76" fontSize="8.5" fontFamily="monospace">
                y={gy}
              </text>
            </g>
          )
        })}

        {active.manhattan > 0.05 && (
          <polygon
            points={`${x2},${y2 - diamondRy} ${x2 + diamondRx},${y2} ${x2},${y2 + diamondRy} ${x2 - diamondRx},${y2}`}
            fill="none"
            stroke="#ff7a1a"
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {active.euclidean > 0.05 && (
          <ellipse
            cx={x2}
            cy={y2}
            rx={circleRx}
            ry={circleRy}
            fill="none"
            stroke="#38bdf8"
            strokeOpacity="0.24"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        )}

        {active.node_id !== goal.node_id && (
          <g>
            <polygon points={`${x1},${y1} ${cornerX},${cornerY} ${x2},${y2}`} fill="url(#triangle-area-grad)" />

            {rightAngleSize > 2 && (
              <polyline
                points={`${cornerX + signX * rightAngleSize},${cornerY} ${cornerX + signX * rightAngleSize},${cornerY + signY * rightAngleSize} ${cornerX},${cornerY + signY * rightAngleSize}`}
                fill="none"
                stroke="#ffb547"
                strokeWidth="1.2"
                opacity="0.85"
              />
            )}

            <line
              x1={x1}
              y1={y1}
              x2={cornerX}
              y2={cornerY}
              stroke="#ff7a1a"
              strokeWidth={selectedHeuristic === 'manhattan' ? 2.8 : 2}
              strokeDasharray="6 3"
            />
            <line
              x1={cornerX}
              y1={cornerY}
              x2={x2}
              y2={y2}
              stroke="#ffb547"
              strokeWidth={selectedHeuristic === 'manhattan' ? 2.8 : 2}
              strokeDasharray="6 3"
            />

            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#38bdf8"
              strokeWidth={selectedHeuristic === 'euclidiana' ? 3 : 2.1}
            />

            <rect
              x={(x1 + cornerX) / 2 - 36}
              y={cornerY - 18}
              width="72"
              height="15"
              rx="4"
              fill="#09090d"
              fillOpacity="0.9"
              stroke="#ff7a1a"
              strokeOpacity="0.45"
            />
            <text
              x={(x1 + cornerX) / 2}
              y={cornerY - 8}
              textAnchor="middle"
              fill="#ffb547"
              fontSize="8.5"
              fontFamily="monospace"
            >
              |x1-x2|={active.dx}
            </text>

            <rect
              x={(x1 + x2) / 2 - 38}
              y={(y1 + y2) / 2 - 19}
              width="76"
              height="15"
              rx="4"
              fill="#081420"
              fillOpacity="0.92"
              stroke="#38bdf8"
              strokeOpacity="0.6"
            />
            <text
              x={(x1 + x2) / 2}
              y={(y1 + y2) / 2 - 9}
              textAnchor="middle"
              fill="#7dd3fc"
              fontSize="8.5"
              fontFamily="monospace"
            >
              L2={active.euclidean}
            </text>
          </g>
        )}

        {heuristics.map((node, idx) => {
          const cx = toSvgX(node.x)
          const cy = toSvgY(node.y)
          const isCurrent = node.node_id === active.node_id
          const isGoal = node.node_id === goal.node_id
          return (
            <g
              key={node.node_id}
              onClick={() => onSelectNode(node.node_id)}
              style={{ '--b-delay': idx } as CSSProperties}
              className="bubble-pop cursor-pointer"
            >
              <circle
                cx={cx}
                cy={cy}
                r={isCurrent || isGoal ? 7.5 : 5.5}
                fill={isGoal ? '#38bdf8' : isCurrent ? '#ff7a1a' : '#262630'}
                stroke={isGoal ? '#bae6fd' : isCurrent ? '#ffd166' : '#8f8f98'}
                strokeWidth="1.5"
                className="bubble-float"
              />
              <text
                x={cx}
                y={cy + (cy < 48 ? 15 : -9)}
                textAnchor="middle"
                fill={isCurrent || isGoal ? '#f4eee8' : '#a1a1aa'}
                fontSize={isCurrent || isGoal ? '9' : '8'}
              >
                {node.label.slice(0, 14)}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-graphite-300">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-3.5 bg-aura-500" />
          Catetos Manhattan L1 = {active.manhattan}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-3.5 bg-sky-400" />
          Hipotenusa Euclidiana L2 = {active.euclidean}
        </span>
        <span className="flex items-center gap-2">
          <Crosshair className="h-3.5 w-3.5 text-amber-300" />
          Haz clic en cualquier burbuja del plano
        </span>
      </div>
    </section>
  )
})

const HeuristicNodeComparisonChart = memo(function HeuristicNodeComparisonChart({
  heuristics,
  activeNodeId,
  onSelectNode,
}: {
  heuristics: NodeHeuristic[]
  activeNodeId: string | null
  onSelectNode: (id: string) => void
}) {
  const sorted = useMemo(() => [...heuristics].sort((a, b) => b.manhattan - a.manhattan), [heuristics])
  const maxVal = Math.max(1, ...sorted.map((n) => n.manhattan))

  return (
    <section
      className="bubble-card card-stagger card-shimmer flex min-w-0 flex-col justify-between gap-3 rounded-2xl p-5"
      aria-label="Comparativa de heuristicas Manhattan y Euclidiana por nodo"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChartNoAxesCombined className="h-4 w-4 text-sky-400" aria-hidden="true" />
          <h5 className="hud-label text-bone">Cuanto te falta desde cada actividad hacia la meta</h5>
          <AuraInfoBubble
            title="Comparacion por actividad"
            explanation="Muestra para cada habilidad o curso cuanto te falta por recorrer si mides por etapas (barra superior) o en linea directa (barra inferior)."
            benefit="Las barras mas cortas son las actividades que ya estan muy cerca del puesto objetivo."
          />
        </div>
        <span className="font-mono text-[11px] text-graphite-400">{sorted.length} actividades</span>
      </div>

      <div className="flex max-h-[270px] flex-col gap-2.5 overflow-y-auto pr-1">
        {sorted.map((node, idx) => {
          const isSelected = node.node_id === activeNodeId
          const dxPct = (node.dx / maxVal) * 100
          const dyPct = (node.dy / maxVal) * 100
          const eucPct = (node.euclidean / maxVal) * 100
          return (
            <button
              key={node.node_id}
              type="button"
              onClick={() => onSelectNode(node.node_id)}
              style={{ '--stagger': idx } as CSSProperties}
              className={`btn-jelly card-stagger flex flex-col gap-1.5 rounded-xl border px-3.5 py-2.5 text-left transition ${
                isSelected
                  ? 'border-aura-500/50 bg-aura-500/10'
                  : 'border-white/5 bg-black/25 hover:border-white/15'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-bone">{node.label}</span>
                <span className="shrink-0 font-mono text-[11px] text-graphite-300">
                  <span className="text-aura-300">L1={node.manhattan}</span>
                  {' | '}
                  <span className="text-sky-300">L2={node.euclidean}</span>
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-16 shrink-0 font-mono text-[10px] text-aura-300">Manhattan</span>
                  <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div className="bar-grow h-full bg-aura-500" style={{ width: `${dxPct}%` }} />
                    <div className="bar-grow h-full bg-amber-300" style={{ width: `${dyPct}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-16 shrink-0 font-mono text-[10px] text-sky-300">Euclidiana</span>
                  <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div className="bar-grow h-full rounded-full bg-sky-400" style={{ width: `${eucPct}%` }} />
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
})

const HeuristicDataTables = memo(function HeuristicDataTables({
  heuristics,
  hillSteps,
  activeNodeId,
  activeAlgorithm,
  onSelectNode,
  onOpenAlgorithmModal,
}: {
  heuristics: NodeHeuristic[]
  hillSteps: HillClimbingStep[]
  activeNodeId: string | null
  activeAlgorithm: SearchAlgorithm
  onSelectNode: (id: string) => void
  onOpenAlgorithmModal: (alg: SearchAlgorithm) => void
}) {
  const algorithmRows: {
    code: SearchAlgorithm
    name: string
    function: string
    complete: string
    optimal: string
    roleInAura: string
  }[] = [
    {
      code: 'genetico',
      name: 'Combinar y Evolucionar Planes (Ruta Inteligente)',
      function: 'Prueba varios planes, une los mejores y ajusta pasos',
      complete: 'Compara multiples opciones',
      optimal: 'Plan combinado muy completo',
      roleInAura:
        'Arma varios planes de estudio a la vez y combina lo mejor de cada uno para darte una ruta equilibrada.',
    },
    {
      code: 'hill_climbing',
      name: 'Avanzar Paso a Paso (Mejora Inmediata)',
      function: 'Elige el siguiente paso que mas te acerque hoy',
      complete: 'Enfocado en el corto plazo',
      optimal: 'Avance rapido paso a paso',
      roleInAura:
        'Te dice que habilidad o curso tomar ahora mismo para subir mas rapido tu nivel hacia el puesto.',
    },
    {
      code: 'a_estrella',
      name: 'Equilibrar Tiempo de Estudio y Meta',
      function: 'Suma horas de estudio + lo que falta para la meta',
      complete: 'Siempre encuentra ruta',
      optimal: 'El mejor balance tiempo/meta',
      roleInAura:
        'Equilibra las horas que dedicaras a estudiar con que tan cerca te deja cada curso del puesto.',
    },
    {
      code: 'gbfs',
      name: 'Ir Directo a la Meta mas Cercana',
      function: 'Se guia solo por que tan cerca queda el puesto',
      complete: 'Siempre encuentra ruta',
      optimal: 'Prioriza rapidez hacia el rol',
      roleInAura:
        'Elige siempre la actividad que mas se parezca a lo que pide el puesto, sin importar si dura un poco mas.',
    },
    {
      code: 'ucs',
      name: 'Invertir Menos Horas de Estudio',
      function: 'Suma solo las horas de dedicacion de cada paso',
      complete: 'Siempre encuentra ruta',
      optimal: 'Garantiza menos horas totales',
      roleInAura:
        'Ideal si tienes poco tiempo libre: busca el camino que requiera menos horas de estudio en total.',
    },
    {
      code: 'bfs',
      name: 'Llegar en Menos Etapas',
      function: 'Cuenta el numero de pasos o escalones',
      complete: 'Siempre encuentra ruta',
      optimal: 'Garantiza menos etapas',
      roleInAura:
        'Encuentra el camino con la menor cantidad de cursos o actividades intermedias.',
    },
    {
      code: 'dfs',
      name: 'Explorar Todas las Rutas Alternativas',
      function: 'Prueba un camino completo y regresa por mas opciones',
      complete: 'Hasta el limite de etapas',
      optimal: 'Muestra hasta 20 caminos',
      roleInAura:
        'Descubre todas las combinaciones posibles de cursos y habilidades para que tu compares y elijas.',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <section
        className="bubble-card card-stagger card-shimmer rounded-2xl p-5"
        aria-label="Tabla de avance paso a paso"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Table className="h-4 w-4 text-aura-400" aria-hidden="true" />
            <h5 className="hud-label text-bone">Tabla 1: Como avanzas paso a paso hacia el puesto</h5>
            <AuraInfoBubble
              title="Recorrido paso a paso"
              explanation="Muestra en orden cada etapa de tu ruta: donde estas, que tanto porcentaje de avance llevas y cual es el siguiente paso recomendado."
            />
          </div>
          <span className="text-xs text-graphite-400">Haz clic en cualquier fila para verla en el mapa</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black/50 font-mono text-[10px] uppercase tracking-wider text-graphite-400">
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Actividad actual</th>
                <th className="px-4 py-3">Lo que falta</th>
                <th className="px-4 py-3">Tu avance (%)</th>
                <th className="px-4 py-3">Siguiente paso recomendado</th>
                <th className="px-4 py-3">Mejora lograda</th>
                <th className="px-4 py-3">Ritmo por hora</th>
                <th className="px-4 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {hillSteps.map((step) => (
                <tr
                  key={step.step}
                  onClick={() => onSelectNode(step.current_id)}
                  className={`cursor-pointer transition ${
                    step.current_id === activeNodeId ? 'bg-aura-500/15' : 'bg-black/20 hover:bg-white/[0.03]'
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-aura-400">#{step.step}</td>
                  <td className="px-4 py-3 font-medium text-bone">{step.current_label}</td>
                  <td className="px-4 py-3 font-mono text-graphite-300">{step.current_h}</td>
                  <td className="px-4 py-3 font-mono text-amber-300">{step.current_altitude}%</td>
                  <td className="px-4 py-3 font-medium text-sky-300">{step.chosen_label ?? 'Meta alcanzada'}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">
                    {step.delta_h >= 0 ? `+${step.delta_h}` : step.delta_h}
                  </td>
                  <td className="px-4 py-3 font-mono text-graphite-300">{step.slope}%/h</td>
                  <td className="px-4 py-3">
                    <AuraBadge
                      tone={step.status === 'meta' ? 'success' : step.status === 'ascenso' ? 'info' : 'warning'}
                    >
                      {step.status === 'meta' ? 'Meta lista' : step.status === 'ascenso' ? 'Avance directo' : 'Preparacion'}
                    </AuraBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="bubble-card card-stagger card-shimmer rounded-2xl p-5"
        aria-label="Tabla de cercania por actividad"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-sky-400" aria-hidden="true" />
            <h5 className="hud-label text-bone">
              Tabla 2: Que tan cerca te deja cada habilidad o curso de tu meta
            </h5>
            <AuraInfoBubble
              title="Tabla de cercania a tu meta"
              explanation="Compara todas las actividades de tu mapa mostrando cuantas etapas faltan desde cada una y que porcentaje de avance representan."
            />
          </div>
          <span className="text-xs text-graphite-400">
            Comparativa por etapas y en linea directa
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black/50 font-mono text-[10px] uppercase tracking-wider text-graphite-400">
                <th className="px-4 py-3">Actividad</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Ubicacion en mapa</th>
                <th className="px-4 py-3">Etapas restantes</th>
                <th className="px-4 py-3">Diferencia de tema</th>
                <th className="px-4 py-3">Distancia paso a paso</th>
                <th className="px-4 py-3">Distancia en linea recta</th>
                <th className="px-4 py-3">Nivel de avance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {heuristics.map((n) => (
                <tr
                  key={n.node_id}
                  onClick={() => onSelectNode(n.node_id)}
                  className={`cursor-pointer transition ${
                    n.node_id === activeNodeId ? 'bg-aura-500/15' : 'bg-black/20 hover:bg-white/[0.03]'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-bone">{n.label}</td>
                  <td className="px-4 py-3 font-mono text-graphite-400">{n.node_type}</td>
                  <td className="px-4 py-3 font-mono text-graphite-300">
                    ({n.x}, {n.y})
                  </td>
                  <td className="px-4 py-3 font-mono text-aura-300">{n.dx}</td>
                  <td className="px-4 py-3 font-mono text-amber-300">{n.dy}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-aura-400">{n.manhattan}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-sky-300">{n.euclidean}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">{n.altitude ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="bubble-card card-stagger card-shimmer rounded-2xl p-5"
        aria-label="Guia de metodos de busqueda en lenguaje sencillo"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sigma className="h-4 w-4 text-amber-300" aria-hidden="true" />
            <h5 className="hud-label text-bone">
              Tabla 3: Guia Sencilla de Como Funciona cada Metodo (Clic para ver animacion)
            </h5>
            <AuraInfoBubble
              title="Cual metodo te conviene elegir"
              explanation="Revisa esta tabla para comparar de un vistazo que hace cada opcion y en que caso te conviene usarla."
            />
          </div>
          <span className="text-xs text-graphite-400">Haz clic en cualquier fila para abrir su animacion explicativa</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black/50 font-mono text-[10px] uppercase tracking-wider text-graphite-400">
                <th className="px-4 py-3">Nombre del metodo</th>
                <th className="px-4 py-3">Como toma decisiones</th>
                <th className="px-4 py-3">Alcance</th>
                <th className="px-4 py-3">Principal ventaja</th>
                <th className="px-4 py-3">Como te ayuda en tu carrera</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {algorithmRows.map((row) => (
                <tr
                  key={row.code}
                  onClick={() => onOpenAlgorithmModal(row.code)}
                  className={`cursor-pointer transition ${
                    row.code === activeAlgorithm ? 'bg-aura-500/15' : 'bg-black/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-bone">{row.name}</td>
                  <td className="px-4 py-3 text-aura-300">{row.function}</td>
                  <td className="px-4 py-3 text-graphite-300">{row.complete}</td>
                  <td className="px-4 py-3 text-amber-300">{row.optimal}</td>
                  <td className="px-4 py-3 leading-relaxed text-graphite-300">{row.roleInAura}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
})

const SearchCharts = memo(function SearchCharts({
  result,
  cursor,
}: {
  result: CareerSearchResult
  cursor: number
}) {
  const trace = useMemo(() => {
    const events = cursor >= 0 ? result.events.slice(0, cursor + 1) : result.events
    const visits = events.filter((event) => event.type === 'visit' || event.type === 'goal')
    const depthCounts = Array.from({ length: Math.max(1, result.max_depth + 1) }, (_, depth) =>
      visits.filter((event) => event.depth === depth).length,
    )
    const stride = Math.max(1, Math.ceil(visits.length / 36))
    const samples = visits.filter((_, index) => index % stride === 0 || index === visits.length - 1)
    return { depthCounts, samples }
  }, [result, cursor])

  const width = 520
  const height = 196
  const left = 36
  const right = 14
  const top = 20
  const bottom = 30
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const maxValue = Math.max(
    1,
    ...trace.samples.flatMap((event) => [
      event.g,
      event.h,
      event.h_manhattan ?? event.h,
      event.h_euclidean ?? event.h,
      event.f,
    ]),
  )
  const x = (index: number) =>
    left + (trace.samples.length <= 1 ? plotWidth / 2 : (index / (trace.samples.length - 1)) * plotWidth)
  const y = (value: number) => top + plotHeight - (value / maxValue) * plotHeight
  const series = [
    { key: 'g', label: 'g / costo recorrido', color: '#ff7a1a', getValue: (e: CareerSearchResult['events'][number]) => e.g },
    {
      key: 'h_manhattan',
      label: 'h Manhattan (L1)',
      color: '#ffd166',
      getValue: (e: CareerSearchResult['events'][number]) => e.h_manhattan ?? e.h,
    },
    {
      key: 'h_euclidean',
      label: 'h Euclidiana (L2)',
      color: '#38bdf8',
      getValue: (e: CareerSearchResult['events'][number]) => e.h_euclidean ?? e.h,
    },
    { key: 'f', label: 'f / prioridad activa', color: '#f4eee8', getValue: (e: CareerSearchResult['events'][number]) => e.f },
  ] as const
  const maxDepthCount = Math.max(1, ...trace.depthCounts)

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="bubble-card card-stagger card-shimmer min-w-0 rounded-2xl p-5" aria-label="Visitas por profundidad">
        <div className="mb-3 flex items-center gap-2">
          <ChartNoAxesCombined className="h-4 w-4 text-aura-400" aria-hidden="true" />
          <h5 className="hud-label text-bone">Exploracion por nivel de profundidad</h5>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Visitas por profundidad">
          <defs>
            <linearGradient id="career-depth-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffb547" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0.28" />
            </linearGradient>
          </defs>
          {trace.depthCounts.map((count, depth) => {
            const slot = plotWidth / trace.depthCounts.length
            const barWidth = Math.min(30, slot * 0.62)
            const barHeight = (count / maxDepthCount) * plotHeight
            const barX = left + depth * slot + (slot - barWidth) / 2
            const barY = top + plotHeight - barHeight
            return (
              <g key={depth}>
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={Math.max(count ? 3 : 0, barHeight)}
                  rx="6"
                  fill="url(#career-depth-fill)"
                  className="bar-grow"
                />
                {count > 0 && (
                  <text x={barX + barWidth / 2} y={barY - 5} textAnchor="middle" fill="#f4eee8" fontSize="10">
                    {count}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </section>

      <section className="bubble-card card-stagger card-shimmer min-w-0 rounded-2xl p-5" aria-label="Evolucion de g, h y f">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-aura-400" aria-hidden="true" />
          <h5 className="hud-label text-bone">Costo y heuristicas por paso (g, L1, L2, f)</h5>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Evolucion de g, h y f">
          {series.map(({ key, color, getValue }) => {
            const points = trace.samples.map((event, index) => `${x(index)},${y(getValue(event))}`).join(' ')
            const last = trace.samples.at(-1)
            return (
              <g key={key}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth={key === 'f' ? 2.5 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {last && (
                  <circle cx={x(trace.samples.length - 1)} cy={y(getValue(last))} r="4.5" fill={color} className="bubble-pop" />
                )}
              </g>
            )
          })}
        </svg>
      </section>
    </div>
  )
})

const SearchTree = memo(function SearchTree({
  result,
  cursor,
  path,
}: {
  result: CareerSearchResult
  cursor: number
  path: CareerPath
}) {
  const tree = useMemo(() => {
    const labels = new Map(path.nodes.map((node) => [node.id, node.label]))
    const nodes = new Map<string, { key: string; label: string; depth: number; order: number | null; cycle: boolean }>()
    const edges: { from: string; to: string; cycle: boolean }[] = []
    let visitOrder = 0
    const events = cursor >= 0 ? result.events.slice(0, cursor + 1) : result.events
    for (const event of events) {
      if (event.type === 'visit' || event.type === 'goal') {
        for (let depth = 0; depth < event.path.length; depth += 1) {
          const key = event.path.slice(0, depth + 1).join('>')
          const parent = depth > 0 ? event.path.slice(0, depth).join('>') : null
          const id = event.path[depth]
          if (!id) continue
          if (!nodes.has(key)) {
            nodes.set(key, {
              key,
              label:
                labels.get(id) ??
                (id === result.start_id ? result.start_label : id === result.goal_id ? result.goal_label : id),
              depth,
              order:
                depth === event.path.length - 1 && (event.type === 'visit' || event.type === 'goal')
                  ? ++visitOrder
                  : null,
              cycle: false,
            })
            if (parent) edges.push({ from: parent, to: key, cycle: false })
          }
        }
      }
    }
    const levels = new Map<number, number>()
    const positioned = [...nodes.values()].map((node) => {
      const row = levels.get(node.depth) ?? 0
      levels.set(node.depth, row + 1)
      return { ...node, x: 52 + node.depth * 165, y: 36 + row * 62 }
    })
    const positions = new Map(positioned.map((node) => [node.key, node]))
    return {
      nodes: positioned,
      edges,
      positions,
      width: Math.max(300, (Math.max(...positioned.map((n) => n.depth), 0) + 1) * 165),
      height: Math.max(140, Math.max(...positioned.map((n) => n.y), 0) + 48),
    }
  }, [result, cursor, path.nodes])

  return (
    <div className="bubble-card max-h-80 overflow-auto rounded-2xl p-5">
      <p className="hud-label mb-3 text-bone">Arbol de exploracion con nodos burbuja</p>
      <svg width={tree.width} height={Math.min(tree.height, 900)} className="max-w-none">
        {tree.edges.map((edge, index) => {
          const from = tree.positions.get(edge.from)!
          const to = tree.positions.get(edge.to)!
          return (
            <line
              key={`${edge.from}-${edge.to}-${index}`}
              x1={from.x + 48}
              y1={from.y}
              x2={to.x - 48}
              y2={to.y}
              stroke="#ff7a1a"
              strokeOpacity="0.45"
              strokeWidth="1.8"
            />
          )
        })}
        {tree.nodes.map((node, idx) => (
          <g key={node.key} style={{ '--b-delay': idx } as CSSProperties} className="bubble-pop">
            <circle
              cx={node.x}
              cy={node.y}
              r={24}
              fill="#17171c"
              stroke="#ffb547"
              strokeWidth="1.8"
            />
            <text x={node.x} y={node.y + 3} textAnchor="middle" fill="#f4eee8" fontSize="9">
              {node.order ? `${node.order}. ` : ''}
              {node.label.slice(0, 14)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
})

function Metric({ label, value }: { label: number | string; value: number }) {
  return (
    <div className="bubble-card card-stagger card-shimmer rounded-2xl p-4">
      <p className="text-[0.65rem] uppercase tracking-widest text-graphite-400">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold text-aura-400">{value}</p>
    </div>
  )
}
