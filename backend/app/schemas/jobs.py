import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, Self

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.candidate import (
    CertificationRead,
    EducationRead,
    ExperienceRead,
    LanguageLevel,
    LanguageRead,
    LinkRead,
)
from app.schemas.common import OptStr, ORMModel
from app.schemas.cv import SectionRead
from app.schemas.skills import CandidateSkillRead, SkillEvidenceRead, SkillRead

JobStatus = Literal["DRAFT", "PUBLISHED", "PAUSED", "CLOSED"]
Modality = Literal["remote", "hybrid", "onsite"]
EmploymentType = Literal["full_time", "part_time", "contract", "internship", "temporary"]
JobEducation = Literal["none", "secondary", "technical", "bachelor", "master", "doctorate"]
Stage = Literal["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "FINAL_REVIEW", "HIRED", "CLOSED"]


# ------------------------------------------------------------------ vacantes
class JobSkillIn(BaseModel):
    skill_id: uuid.UUID
    importance: Literal["required", "preferred"] = "required"
    min_proficiency: int = Field(default=3, ge=1, le=5)
    weight: Decimal = Field(default=Decimal("1"), gt=0, le=5)


class JobLanguageIn(BaseModel):
    language_code: str = Field(min_length=2, max_length=10)
    min_level: LanguageLevel
    is_required: bool = True

    @field_validator("language_code")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()


class JobRequirementIn(BaseModel):
    requirement_type: Literal["certification", "education", "experience", "other"] = "other"
    description: str = Field(min_length=2, max_length=500)
    is_required: bool = True


class JobIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=20, max_length=8000)
    location: OptStr = Field(default=None, max_length=150)
    modality: Modality
    employment_type: EmploymentType = "full_time"
    salary_min: Decimal | None = Field(default=None, ge=0)
    salary_max: Decimal | None = Field(default=None, ge=0)
    salary_currency: str | None = Field(default=None, pattern=r"^[A-Za-z]{3}$")
    show_salary: bool = False
    experience_min_years: Decimal = Field(default=Decimal("0"), ge=0, le=40)
    education_level: JobEducation | None = None
    responsibilities: list[str] = Field(default_factory=list, max_length=20)
    benefits: list[str] = Field(default_factory=list, max_length=20)
    schedule_description: str | None = Field(default=None, max_length=300)
    response_sla_days: int | None = Field(default=None, ge=1, le=30)
    process_estimate_days: int | None = Field(default=None, ge=1, le=180)
    closes_at: datetime | None = None
    skills: list[JobSkillIn] = Field(default_factory=list, max_length=40)
    languages: list[JobLanguageIn] = Field(default_factory=list, max_length=10)
    requirements: list[JobRequirementIn] = Field(default_factory=list, max_length=20)

    @field_validator("responsibilities", "benefits")
    @classmethod
    def _clean_lists(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(v.strip()[:500] for v in values if v.strip()))

    @field_validator("salary_currency")
    @classmethod
    def _upper(cls, v: str | None) -> str | None:
        return v.upper() if v else v

    @model_validator(mode="after")
    def _checks(self) -> Self:
        if self.salary_min and self.salary_max and self.salary_max < self.salary_min:
            raise ValueError("El salario maximo no puede ser menor al minimo")
        if len({s.skill_id for s in self.skills}) != len(self.skills):
            raise ValueError("Hay habilidades repetidas en la vacante")
        if len({lang.language_code for lang in self.languages}) != len(self.languages):
            raise ValueError("Hay idiomas repetidos en la vacante")
        return self


class JobStatusChange(BaseModel):
    status: JobStatus


class JobImportBatch(BaseModel):
    items: list[JobIn] = Field(min_length=1, max_length=25)


class JobImportResult(BaseModel):
    created: int
    job_ids: list[uuid.UUID]


class CompanyBrief(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    sector: str | None
    location: str | None


class JobSkillRead(ORMModel):
    skill: SkillRead
    importance: str
    min_proficiency: int
    weight: Decimal


class JobLanguageRead(ORMModel):
    language_code: str
    min_level: str
    is_required: bool


class JobRequirementRead(ORMModel):
    id: uuid.UUID
    requirement_type: str
    description: str
    is_required: bool


class JobRead(ORMModel):
    id: uuid.UUID
    title: str
    description: str
    location: str | None
    modality: str
    employment_type: str
    salary_min: Decimal | None
    salary_max: Decimal | None
    salary_currency: str | None
    show_salary: bool
    experience_min_years: Decimal
    education_level: str | None
    responsibilities: list[str]
    benefits: list[str] = Field(default_factory=list)
    schedule_description: str | None = None
    response_sla_days: int | None = None
    process_estimate_days: int | None = None
    last_confirmed_at: datetime | None = None
    transparency_score: int = 0
    transparent_fields: list[str] = Field(default_factory=list)
    missing_transparency_fields: list[str] = Field(default_factory=list)
    status: str
    published_at: datetime | None
    closes_at: datetime | None
    created_at: datetime
    updated_at: datetime
    company: CompanyBrief
    skills: list[JobSkillRead]
    languages: list[JobLanguageRead]
    requirements: list[JobRequirementRead]


class JobCompanyItem(JobRead):
    applications_count: int = 0
    stage_counts: dict[str, int] = Field(default_factory=dict)


class MyApplicationBrief(BaseModel):
    id: uuid.UUID
    current_stage: str
    status: str
    applied_at: datetime


class JobPublic(JobRead):
    my_application: MyApplicationBrief | None = None


class JobPage(BaseModel):
    items: list[JobPublic]
    total: int
    limit: int
    offset: int


# ----------------------------------------------------------- postulaciones
class ApplicationCreate(BaseModel):
    job_id: uuid.UUID
    resume_id: uuid.UUID | None = None
    cover_letter: str | None = Field(default=None, max_length=4000)


class StageTransition(BaseModel):
    to_stage: Stage
    comment: str | None = Field(default=None, max_length=2000)
    reason_code: str | None = Field(default=None, max_length=50)
    confirm: bool = False


class HistoryEntry(ORMModel):
    id: uuid.UUID
    from_stage: str | None
    to_stage: str
    actor_type: str
    comment: str | None
    created_at: datetime


class CandidateTimelineEntry(BaseModel):
    to_stage: str
    created_at: datetime


class MyApplication(BaseModel):
    id: uuid.UUID
    job: JobRead
    current_stage: str
    status: str
    applied_at: datetime
    withdrawn_at: datetime | None
    last_update_at: datetime | None = None
    estimated_next_update_at: datetime | None = None
    timeline: list[CandidateTimelineEntry]


class ApplicantBrief(BaseModel):
    application_id: uuid.UUID
    candidate_id: uuid.UUID
    full_name: str
    headline: str | None
    location: str | None
    completeness: int
    top_skills: list[str]
    current_stage: str
    status: str
    applied_at: datetime


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    visibility: Literal["team", "private"] = "team"


class NoteRead(ORMModel):
    id: uuid.UUID
    author_id: uuid.UUID | None
    author_name: str | None = None
    body: str
    visibility: str
    created_at: datetime


class ApplicantProfile(BaseModel):
    full_name: str
    email: str
    headline: str | None
    summary: str | None
    location: str | None
    availability: str | None
    work_modality: str | None
    experiences: list[ExperienceRead]
    education: list[EducationRead]
    certifications: list[CertificationRead]
    languages: list[LanguageRead]
    links: list[LinkRead]
    skills: list[CandidateSkillRead]
    shared_skill_evidence: list[SkillEvidenceRead] = Field(default_factory=list)


class ApplicationDetail(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    job_title: str
    current_stage: str
    status: str
    applied_at: datetime
    cover_letter: str | None
    allowed_transitions: list[str]
    candidate: ApplicantProfile
    resume_sections: list[SectionRead]
    history: list[HistoryEntry]
    notes: list[NoteRead]


# ---------------------------------------------------------- notificaciones
class NotificationRead(ORMModel):
    id: uuid.UUID
    notification_type: str
    title: str
    body: str | None
    link: str | None
    data: dict[str, Any]
    read_at: datetime | None
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationRead]
    unread: int
