export type NodeStatus = 'acquired' | 'in_progress' | 'gap' | 'target'
export type SearchAlgorithm = 'bfs' | 'dfs' | 'ucs' | 'gbfs' | 'a_estrella' | 'hill_climbing' | 'genetico'
export type SearchMode = 'primera' | 'todas'
export type HeuristicType = 'manhattan' | 'euclidiana' | 'saltos'

export interface CareerSearchEvent {
  type: 'visit' | 'goal' | 'cycle' | 'backtrack' | 'prune'
  node: string
  path: string[]
  g: number
  h: number
  h_manhattan?: number
  h_euclidean?: number
  f: number
  depth: number
}

export interface CareerSearchPath {
  node_ids: string[]
  labels: string[]
  cost: number
}

export interface NodeHeuristic {
  node_id: string
  label: string
  node_type: string
  x: number
  y: number
  z: number
  goal_x: number
  goal_y: number
  dx: number
  dy: number
  manhattan: number
  euclidean: number
  hops: number
  h: number
  altitude?: number
}

export interface HillNeighborEval {
  node_id: string
  label: string
  h: number
  altitude: number
  cost: number
  delta_h: number
  slope: number
  decision: 'seleccionado' | 'descartado_menor_pendiente' | 'descartado_descenso' | 'ciclo'
}

export interface HillClimbingStep {
  step: number
  current_id: string
  current_label: string
  current_h: number
  current_altitude: number
  chosen_id: string | null
  chosen_label: string | null
  chosen_h: number | null
  chosen_altitude: number | null
  delta_h: number
  slope: number
  status: 'ascenso' | 'meseta' | 'optimo_local' | 'meta'
  neighbors: HillNeighborEval[]
}

export interface HillDistributionItem {
  category: string
  key: string
  count: number
  percentage: number
  color: string
  hours?: number | null
}

export interface HillElevationItem {
  node_id: string
  label: string
  node_type: string
  h: number
  manhattan: number
  euclidean: number
  altitude: number
  cost: number
  on_best_path: boolean
}

export interface HillClimbingSummary {
  reached_global_optimum: boolean
  local_optima_count: number
  plateaus_count: number
  steepest_gain: number
  average_slope: number
  total_neighbors_evaluated: number
  steps: HillClimbingStep[]
  outcome_distribution: HillDistributionItem[]
  node_type_distribution: HillDistributionItem[]
  elevation_profile: HillElevationItem[]
}

export interface GeneticComponentItem {
  number: number
  id: string
  title: string
  concept: string
  application: string
  example: string
  score_pct: number
}

export interface GeneticIndividual {
  id: string
  binary: string
  numeric: number[]
  labels: string[]
  fitness: number
  cost: number
  reached_goal: boolean
}

export interface GeneticGeneration {
  generation: number
  best_fitness: number
  avg_fitness: number
  worst_fitness: number
  diversity: number
  best_binary: string
  best_labels: string[]
  individuals: GeneticIndividual[]
}

export interface GeneticCrossoverEvent {
  generation: number
  parent_a_id: string
  parent_a_binary: string
  parent_a_labels: string[]
  parent_b_id: string
  parent_b_binary: string
  parent_b_labels: string[]
  cut_point: number
  child_id: string
  child_binary: string
  child_labels: string[]
  child_fitness: number
}

export interface GeneticMutationEvent {
  generation: number
  individual_id: string
  before_binary: string
  after_binary: string
  mutated_bit: number
  mutated_gene_label: string
  fitness_before: number
  fitness_after: number
}

export interface GeneticSummary {
  population_size: number
  generations_count: number
  mutation_rate: number
  crossover_rate: number
  fitness_formula: string
  best_individual: GeneticIndividual
  components: GeneticComponentItem[]
  generations: GeneticGeneration[]
  crossover_events: GeneticCrossoverEvent[]
  mutation_events: GeneticMutationEvent[]
  operator_distribution: HillDistributionItem[]
}

export interface CareerSearchResult {
  algorithm: SearchAlgorithm
  mode: SearchMode
  heuristic_type?: HeuristicType
  heuristic_formula?: string
  start_id: string
  goal_id: string
  start_label: string
  goal_label: string
  order_exploration: string[]
  order_labels: string[]
  events: CareerSearchEvent[]
  paths: CareerSearchPath[]
  cycles_avoided: [string, string][]
  backtracks: number
  max_depth: number
  explored: number
  heuristic: Record<string, number>
  heuristic_manhattan?: Record<string, number>
  heuristic_euclidean?: Record<string, number>
  heuristic_hops?: Record<string, number>
  node_heuristics?: NodeHeuristic[]
  hill_climbing?: HillClimbingSummary | null
  genetic?: GeneticSummary | null
  cost_unit: string
  limitation: string
}
export type NodeType = 'profile' | 'skill' | 'role' | 'course' | 'project' | 'milestone'

export interface RoleCoverage {
  code: string
  title: string
  description: string
  coverage: number
  met: string[]
  partial: string[]
  missing: string[]
}

export interface CareerNode {
  id: string
  node_type: NodeType
  label: string
  status: NodeStatus
  ref_id: string | null
  position: [number, number, number]
  meta: { url?: string; hours?: number; level?: string; required_level?: number; current_level?: number; core?: boolean; hint?: string }
}

export interface CareerPath {
  id: string
  title: string
  goal_role: string | null
  generated_by: string
  created_at: string
  progress: number
  nodes: CareerNode[]
  edges: { source: string; target: string; edge_type: 'requires' | 'leads_to' | 'related' }[]
  explanation: { method: string; data_used: string[]; limitations: string[] }
}

export interface PathSummary {
  id: string
  title: string
  goal_role: string | null
  progress: number
  created_at: string
}

export type RecType = 'job' | 'skill' | 'course' | 'project' | 'career_path' | 'opportunity'

export interface Recommendation {
  id: string
  rec_type: RecType
  target_id: string | null
  target_label: string | null
  score: number
  reason: { summary?: string; factors?: string[]; gaps?: string[]; url?: string; skill?: string; role_code?: string; saved?: boolean }
  strategy: string
  model_version: string | null
  status: string
  created_at: string
}

export interface RecommendationSet {
  generated_at: string | null
  items: Recommendation[]
  explanation: { method: string; data_used: string[]; limitations: string[] }
}
