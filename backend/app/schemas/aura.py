import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AuraContext(BaseModel):
    module: str | None = Field(default=None, max_length=40)
    job_id: uuid.UUID | None = None


class AuraCommandIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    channel: Literal["text", "voice", "gesture"] = "text"
    area: Literal["candidate", "company", "admin"] = "candidate"
    context: AuraContext = Field(default_factory=AuraContext)
    session_id: uuid.UUID | None = None


class AuraAction(BaseModel):
    type: Literal["navigate"]
    path: str


class AuraConfirmation(BaseModel):
    token: str
    summary: str
    expires_at: datetime


class AuraReply(BaseModel):
    interaction_id: uuid.UUID
    intent: str
    confidence: float
    outcome: Literal["ok", "denied", "needs_confirmation", "unknown", "cancelled"]
    reply: str
    details: list[str] = []
    action: AuraAction | None = None
    confirmation: AuraConfirmation | None = None
    llm_used: bool = False


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=100)


class OllamaStatusOut(BaseModel):
    online: bool
    provider: str
    endpoint: str
    configured_model: str
    base_model: str
    active_model: str
    installed_models: list[str]
    custom_model_ready: bool
    latency_ms: int
    modelfile: str
    cli_command: str


class OllamaCreateModelIn(BaseModel):
    base_model: str = Field(default="qwen2.5:3b", min_length=2, max_length=80)


class OllamaCreateModelOut(BaseModel):
    created: bool
    model: str
    base_model: str
    message: str
    modelfile: str


class OllamaAutomateIn(BaseModel):
    task: Literal[
        "cv_optimization",
        "job_generator",
        "interview_coach",
        "candidate_synthesis",
        "workflow_automation",
    ] = "workflow_automation"
    prompt: str = Field(min_length=2, max_length=2000)
    role_hint: str = Field(default="", max_length=120)


class OllamaAutomateOut(BaseModel):
    task: str
    engine: str
    ollama_live: bool
    latency_ms: int
    output: str
    actions: list[str]


class MlLabRunIn(BaseModel):
    horas_estudio: float = Field(default=6.0, ge=0.0, le=80.0)
    asistencia: float = Field(default=80.0, ge=0.0, le=100.0)
    actividades_entregadas: float = Field(default=75.0, ge=0.0, le=100.0)
    participacion: float = Field(default=7.5, ge=0.0, le=10.0)
    min_horas_rule: float = Field(default=5.0, ge=0.0, le=40.0)
    min_asistencia_rule: float = Field(default=70.0, ge=0.0, le=100.0)
    min_actividades_rule: float = Field(default=65.0, ge=0.0, le=100.0)
    max_depth: int = Field(default=3, ge=1, le=5)
    knn_neighbors: int = Field(default=7, ge=1, le=25)
    rf_estimators: int = Field(default=100, ge=10, le=500)
    dt_max_depth: int = Field(default=5, ge=1, le=15)

