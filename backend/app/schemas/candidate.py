import uuid
from datetime import date
from decimal import Decimal
from typing import Literal, Self

from pydantic import Field, field_validator, model_validator

from app.schemas.common import HttpUrlStr, OptStr, ORMModel, TagList, check_date_range
from app.schemas.skills import CandidateSkillRead

Availability = Literal["immediate", "two_weeks", "one_month", "negotiable", "not_available"]
WorkModality = Literal["remote", "hybrid", "onsite", "any"]
EducationLevel = Literal[
    "secondary", "technical", "bachelor", "master", "doctorate", "bootcamp", "certificate", "other"
]
EmploymentType = Literal[
    "full_time", "part_time", "contract", "internship", "freelance", "temporary", "volunteer"
]
LanguageLevel = Literal["A1", "A2", "B1", "B2", "C1", "C2", "native"]
LinkType = Literal["github", "linkedin", "website", "gitlab", "behance", "other"]


# ------------------------------------------------------------------- perfil
class ProfileUpdate(ORMModel):
    headline: OptStr = Field(default=None, max_length=200)
    summary: OptStr = Field(default=None, max_length=3000)
    location_city: OptStr = Field(default=None, max_length=100)
    location_country: OptStr = Field(default=None, max_length=100)
    availability: Availability | None = None
    work_modality: WorkModality | None = None
    desired_roles: TagList | None = None
    salary_expectation: Decimal | None = Field(default=None, ge=0, le=10_000_000)
    salary_currency: str | None = Field(default=None, pattern=r"^[A-Za-z]{3}$")
    goals: OptStr = Field(default=None, max_length=2000)
    interests: TagList | None = None
    is_discoverable: bool | None = None

    @field_validator("salary_currency")
    @classmethod
    def _upper(cls, value: str | None) -> str | None:
        return value.upper() if value else value


class ProfileRead(ORMModel):
    id: uuid.UUID
    headline: str | None
    summary: str | None
    location_city: str | None
    location_country: str | None
    availability: str | None
    work_modality: str | None
    desired_roles: list[str]
    salary_expectation: Decimal | None
    salary_currency: str | None
    goals: str | None
    interests: list[str]
    is_discoverable: bool
    completeness: int


# ---------------------------------------------------------------- educacion
class EducationIn(ORMModel):
    institution: str = Field(min_length=1, max_length=200)
    degree: OptStr = Field(default=None, max_length=200)
    field_of_study: OptStr = Field(default=None, max_length=200)
    level: EducationLevel | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool = False
    description: OptStr = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _dates(self) -> Self:
        if self.is_current:
            self.end_date = None
        check_date_range(self.start_date, self.end_date)
        return self


class EducationRead(EducationIn):
    id: uuid.UUID
    source: str


# -------------------------------------------------------------- experiencia
class ExperienceIn(ORMModel):
    company_name: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    employment_type: EmploymentType | None = None
    location: OptStr = Field(default=None, max_length=150)
    start_date: date
    end_date: date | None = None
    is_current: bool = False
    description: OptStr = Field(default=None, max_length=3000)
    achievements: list[str] = Field(default_factory=list, max_length=12)

    @field_validator("achievements")
    @classmethod
    def _clean(cls, values: list[str]) -> list[str]:
        return [v.strip()[:500] for v in values if v.strip()]

    @model_validator(mode="after")
    def _dates(self) -> Self:
        if self.is_current:
            self.end_date = None
        check_date_range(self.start_date, self.end_date)
        return self


class ExperienceRead(ExperienceIn):
    id: uuid.UUID
    source: str


# ----------------------------------------------------------- certificaciones
class CertificationIn(ORMModel):
    name: str = Field(min_length=1, max_length=200)
    issuer: OptStr = Field(default=None, max_length=200)
    issued_at: date | None = None
    expires_at: date | None = None
    credential_id: OptStr = Field(default=None, max_length=150)
    credential_url: HttpUrlStr = None

    @model_validator(mode="after")
    def _dates(self) -> Self:
        check_date_range(self.issued_at, self.expires_at, "La fecha de expiracion")
        return self


class CertificationRead(CertificationIn):
    id: uuid.UUID
    source: str


# ------------------------------------------------------------------ idiomas
class LanguageIn(ORMModel):
    language_code: str = Field(min_length=2, max_length=10, pattern=r"^[a-zA-Z-]+$")
    level: LanguageLevel
    is_certified: bool = False
    certificate_name: OptStr = Field(default=None, max_length=150)

    @field_validator("language_code")
    @classmethod
    def _lower(cls, value: str) -> str:
        return value.lower()


class LanguageRead(LanguageIn):
    id: uuid.UUID


# ------------------------------------------------------------------ enlaces
class LinkIn(ORMModel):
    link_type: LinkType
    url: HttpUrlStr
    label: OptStr = Field(default=None, max_length=100)
    display_order: int = Field(default=0, ge=0, le=100)

    @model_validator(mode="after")
    def _required(self) -> Self:
        if not self.url:
            raise ValueError("La URL es obligatoria")
        return self


class LinkRead(LinkIn):
    id: uuid.UUID


# ------------------------------------------------------------------ resumen
class CandidateOverview(ORMModel):
    full_name: str
    email: str
    profile: ProfileRead
    education: list[EducationRead]
    experiences: list[ExperienceRead]
    certifications: list[CertificationRead]
    languages: list[LanguageRead]
    links: list[LinkRead]
    skills: list[CandidateSkillRead]
    projects_count: int
