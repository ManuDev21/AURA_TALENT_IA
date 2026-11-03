from typing import Any, Literal

from pydantic import BaseModel

AlgorithmName = Literal["bfs", "dfs", "ucs", "gbfs", "a_estrella", "hill_climbing", "genetico"]
SearchMode = Literal["primera", "todas"]
HeuristicName = Literal["manhattan", "euclidiana", "saltos"]


class SearchPathRead(BaseModel):
    node_ids: list[str]
    labels: list[str]
    cost: float


class SearchEventRead(BaseModel):
    type: Literal["visit", "goal", "cycle", "backtrack", "prune"]
    node: str
    path: list[str]
    g: float
    h: float
    h_manhattan: float = 0.0
    h_euclidean: float = 0.0
    f: float
    depth: int


class NodeHeuristicRead(BaseModel):
    node_id: str
    label: str
    node_type: str
    x: float
    y: float
    z: float
    goal_x: float
    goal_y: float
    dx: float
    dy: float
    manhattan: float
    euclidean: float
    hops: float
    h: float
    altitude: float = 0.0


class HillNeighborEvalRead(BaseModel):
    node_id: str
    label: str
    h: float
    altitude: float
    cost: float
    delta_h: float
    slope: float
    decision: Literal[
        "seleccionado",
        "descartado_menor_pendiente",
        "descartado_descenso",
        "ciclo",
    ]


class HillClimbingStepRead(BaseModel):
    step: int
    current_id: str
    current_label: str
    current_h: float
    current_altitude: float
    chosen_id: str | None = None
    chosen_label: str | None = None
    chosen_h: float | None = None
    chosen_altitude: float | None = None
    delta_h: float
    slope: float
    status: Literal["ascenso", "meseta", "optimo_local", "meta"]
    neighbors: list[HillNeighborEvalRead] = []


class HillDistributionItemRead(BaseModel):
    category: str
    key: str
    count: int
    percentage: float
    color: str
    hours: float | None = None


class HillElevationItemRead(BaseModel):
    node_id: str
    label: str
    node_type: str
    h: float
    manhattan: float
    euclidean: float
    altitude: float
    cost: float
    on_best_path: bool


class HillClimbingSummaryRead(BaseModel):
    reached_global_optimum: bool
    local_optima_count: int
    plateaus_count: int
    steepest_gain: float
    average_slope: float
    total_neighbors_evaluated: int
    steps: list[HillClimbingStepRead] = []
    outcome_distribution: list[HillDistributionItemRead] = []
    node_type_distribution: list[HillDistributionItemRead] = []
    elevation_profile: list[HillElevationItemRead] = []


class CareerSearchRead(BaseModel):
    algorithm: AlgorithmName
    mode: SearchMode
    heuristic_type: HeuristicName = "manhattan"
    heuristic_formula: str = "h(n) = |x1 - x2| + |y1 - y2|"
    start_id: str
    goal_id: str
    start_label: str
    goal_label: str
    order_exploration: list[str]
    order_labels: list[str]
    events: list[SearchEventRead]
    paths: list[SearchPathRead]
    cycles_avoided: list[list[str]]
    backtracks: int
    max_depth: int
    explored: int
    heuristic: dict[str, float]
    heuristic_manhattan: dict[str, float] = {}
    heuristic_euclidean: dict[str, float] = {}
    heuristic_hops: dict[str, float] = {}
    node_heuristics: list[NodeHeuristicRead] = []
    hill_climbing: HillClimbingSummaryRead | None = None
    genetic: dict[str, Any] | None = None
    cost_unit: str
    limitation: str
