import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import HttpUrlStr, ORMModel

SkillType = Literal[
    "technical", "programming_language", "framework", "tool", "platform", "methodology", "soft"
]


class SkillCategoryRead(ORMModel):
    code: str
    name: str


class SkillRead(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    skill_type: str
    category: SkillCategoryRead | None


class SkillCreate(ORMModel):
    name: str = Field(min_length=1, max_length=100)
    category_code: str
    skill_type: SkillType
    aliases: list[str] = Field(default_factory=list, max_length=10)


class CandidateSkillUpsert(ORMModel):
    proficiency: int = Field(ge=1, le=5)
    years_experience: Decimal | None = Field(default=None, ge=0, le=60)
    last_used_year: int | None = Field(default=None, ge=1970, le=2100)


class CandidateSkillRead(ORMModel):
    skill: SkillRead
    proficiency: int
    years_experience: Decimal | None
    last_used_year: int | None
    source: str
    is_verified: bool


class SkillEvidenceIn(ORMModel):
    skill_id: uuid.UUID
    evidence_type: Literal["project", "credential", "certificate", "work_sample", "other"]
    title: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    evidence_url: HttpUrlStr = None
    issuer: str | None = Field(default=None, max_length=200)
    credential_ref: str | None = Field(default=None, max_length=300)
    share_with_companies: bool = False


class SkillEvidenceShare(BaseModel):
    share_with_companies: bool


class OpenBadgeImportIn(BaseModel):
    skill_id: uuid.UUID
    credential_title: str = Field(min_length=2, max_length=200)
    issuer: str | None = Field(default=None, max_length=200)
    credential_ref: str | None = Field(default=None, max_length=300)
    credential_url: HttpUrlStr = None
    evidence_url: HttpUrlStr = None
    description: str | None = Field(default=None, max_length=2000)
    share_with_companies: bool = False


class SkillEvidenceRead(ORMModel):
    id: uuid.UUID
    skill_id: uuid.UUID
    skill: SkillRead
    evidence_type: str
    title: str
    description: str | None
    evidence_url: str | None
    issuer: str | None
    credential_ref: str | None
    source: str
    share_with_companies: bool
    created_at: datetime


class IndicatorFactor(ORMModel):
    skill: str
    proficiency: int
    years_experience: Decimal | None


class Indicator(ORMModel):
    category_code: str
    category_name: str
    score: int
    skills_count: int
    factors: list[IndicatorFactor]


class IndicatorsRead(ORMModel):
    indicators: list[Indicator]
    method: str
    data_used: list[str]
    limitations: list[str]
    disclaimer: str
