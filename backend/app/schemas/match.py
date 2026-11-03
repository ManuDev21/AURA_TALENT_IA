import uuid
from datetime import datetime

from pydantic import BaseModel


class FactorRead(BaseModel):
    code: str
    label: str
    weight: float
    score: float
    detail: str
    evidence: list[str]


class RequirementRead(BaseModel):
    kind: str
    label: str
    status: str
    detail: str
    required: bool


class GapRead(BaseModel):
    kind: str
    name: str
    required: bool
    detail: str
    skill_id: str | None = None


class MatchExplanation(BaseModel):
    method: str
    data_used: list[str]
    not_used: list[str]
    limitations: list[str]


class MatchRead(BaseModel):
    job_id: uuid.UUID
    job_title: str
    company_name: str
    score: float
    score_low: float
    score_high: float
    label: str
    factors: list[FactorRead]
    requirements: list[RequirementRead]
    strengths: list[str]
    gaps: list[GapRead]
    recommendations: list[str]
    data_completeness: float
    explanation: MatchExplanation
    model_version: str
    computed_at: datetime
    disclaimer: str


class MatchBrief(BaseModel):
    job_id: uuid.UUID
    job_title: str
    company_name: str
    modality: str
    location: str | None
    score: float
    score_low: float
    score_high: float
    label: str
    required_met: int
    required_total: int
    top_gap: str | None


class ApplicantMatch(BaseModel):
    application_id: uuid.UUID
    score: float
    score_low: float
    score_high: float
    label: str
    required_met: int
    required_total: int


class AggregatedGap(BaseModel):
    name: str
    kind: str
    jobs_count: int
    jobs: list[str]
    required_in: int
    suggestion: str


class GapReport(BaseModel):
    analyzed_jobs: int
    gaps: list[AggregatedGap]
    strengths: list[str]
    note: str
