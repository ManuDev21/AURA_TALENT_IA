import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class RoleCoverageRead(BaseModel):
    code: str
    title: str
    description: str
    coverage: float
    met: list[str]
    partial: list[str]
    missing: list[str]


class CareerRolesRead(BaseModel):
    catalog_version: str
    roles: list[RoleCoverageRead]
    note: str


class PathCreate(BaseModel):
    role_code: str = Field(min_length=2, max_length=40)


class NodeRead(BaseModel):
    id: uuid.UUID
    node_type: str
    label: str
    status: str
    ref_id: uuid.UUID | None
    position: tuple[float, float, float]
    meta: dict[str, Any]


class EdgeRead(BaseModel):
    source: uuid.UUID
    target: uuid.UUID
    edge_type: str


class PathRead(BaseModel):
    id: uuid.UUID
    title: str
    goal_role: str | None
    generated_by: str
    created_at: datetime
    progress: float
    nodes: list[NodeRead]
    edges: list[EdgeRead]
    explanation: dict[str, Any]


class PathSummary(BaseModel):
    id: uuid.UUID
    title: str
    goal_role: str | None
    progress: float
    created_at: datetime


class NodeStatusUpdate(BaseModel):
    status: Literal["acquired", "in_progress", "gap", "target"]


class ResourceRead(BaseModel):
    id: uuid.UUID
    title: str
    provider: str | None
    url: str
    description: str | None
    level: str | None
    duration_hours: float | None
    cost_type: str | None
    language_code: str
    skills: list[str]


class RecommendationRead(BaseModel):
    id: uuid.UUID
    rec_type: str
    target_id: uuid.UUID | None
    target_label: str | None
    score: float
    reason: dict[str, Any]
    strategy: str
    model_version: str | None
    status: str
    created_at: datetime


class RecommendationSet(BaseModel):
    generated_at: datetime | None
    items: list[RecommendationRead]
    explanation: dict[str, Any]


class FeedbackIn(BaseModel):
    action: Literal["view", "click", "save", "dismiss", "apply"]
