import uuid
from datetime import datetime
from typing import Any, Literal, Self

from pydantic import BaseModel, Field, ValidationError, create_model, model_validator

from app.schemas.candidate import CertificationIn, EducationIn, ExperienceIn, LanguageIn, LinkIn
from app.schemas.common import ORMModel

ResumeTarget = Literal["general", "frontend", "backend", "data", "internship", "software", "custom"]
Template = Literal["aura-classic", "aura-modern"]
SectionType = Literal[
    "header",
    "summary",
    "education",
    "experience",
    "projects",
    "skills",
    "certifications",
    "languages",
    "portfolio",
    "links",
    "custom",
]

Short = Field(default=None, max_length=200)
MonthStr = Field(default=None, pattern=r"^\d{4}-\d{2}$")


# ------------------------------------------------ contenido de las secciones
class _Content(BaseModel):
    model_config = {"extra": "ignore"}


class LinkEntry(_Content):
    label: str = Field(max_length=60)
    url: str = Field(max_length=500)


class HeaderContent(_Content):
    full_name: str = Field(default="", max_length=150)
    headline: str | None = Short
    email: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=40)
    location: str | None = Short
    links: list[LinkEntry] = Field(default_factory=list, max_length=8)


class TextContent(_Content):
    text: str = Field(default="", max_length=5000)


class ExperienceEntry(_Content):
    title: str = Field(max_length=200)
    company: str = Field(default="", max_length=200)
    location: str | None = Short
    start: str | None = MonthStr
    end: str | None = MonthStr
    current: bool = False
    description: str | None = Field(default=None, max_length=3000)
    achievements: list[str] = Field(default_factory=list, max_length=15)


class EducationEntry(_Content):
    institution: str = Field(max_length=200)
    degree: str | None = Short
    field: str | None = Short
    start: str | None = MonthStr
    end: str | None = MonthStr
    current: bool = False
    description: str | None = Field(default=None, max_length=2000)


class ProjectEntry(_Content):
    title: str = Field(max_length=200)
    role: str | None = Short
    description: str | None = Field(default=None, max_length=3000)
    url: str | None = Field(default=None, max_length=500)
    technologies: list[str] = Field(default_factory=list, max_length=25)


class SkillGroup(_Content):
    category: str = Field(max_length=80)
    skills: list[str] = Field(default_factory=list, max_length=50)


class CertificationEntry(_Content):
    name: str = Field(max_length=200)
    issuer: str | None = Short
    date: str | None = MonthStr
    url: str | None = Field(default=None, max_length=500)


class LanguageEntry(_Content):
    language: str = Field(max_length=60)
    level: str = Field(default="", max_length=60)


def _items(model: type[_Content]) -> type[_Content]:
    return create_model(
        f"{model.__name__}List",
        __base__=_Content,
        items=(list[model], Field(default_factory=list, max_length=40)),  # type: ignore[valid-type]
    )


class SkillsContent(_Content):
    groups: list[SkillGroup] = Field(default_factory=list, max_length=15)


CONTENT_MODELS: dict[str, type[_Content]] = {
    "header": HeaderContent,
    "summary": TextContent,
    "custom": TextContent,
    "experience": _items(ExperienceEntry),
    "education": _items(EducationEntry),
    "projects": _items(ProjectEntry),
    "certifications": _items(CertificationEntry),
    "languages": _items(LanguageEntry),
    "links": _items(LinkEntry),
    "portfolio": _items(LinkEntry),
    "skills": SkillsContent,
}


def validate_content(section_type: str, content: dict[str, Any]) -> dict[str, Any]:
    return CONTENT_MODELS[section_type].model_validate(content).model_dump(mode="json")


# ------------------------------------------------------------------ API
class SectionIn(BaseModel):
    section_type: SectionType
    title: str | None = Field(default=None, max_length=150)
    is_visible: bool = True
    content: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _content(self) -> Self:
        try:
            self.content = validate_content(self.section_type, self.content)
        except ValidationError as exc:
            first = exc.errors()[0]
            where = ".".join(str(p) for p in first["loc"])
            raise ValueError(
                f"Contenido invalido en la seccion {self.section_type} ({where}): {first['msg']}"
            ) from exc
        return self


class SectionsReplace(BaseModel):
    sections: list[SectionIn] = Field(max_length=20)

    @model_validator(mode="after")
    def _single_header(self) -> Self:
        if sum(s.section_type == "header" for s in self.sections) > 1:
            raise ValueError("Un CV solo puede tener un encabezado")
        return self


class SectionRead(ORMModel):
    id: uuid.UUID
    section_type: str
    title: str | None
    display_order: int
    is_visible: bool
    content: dict[str, Any]


class ResumeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    target: ResumeTarget = "general"
    template: Template = "aura-classic"


class ResumeDuplicate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    target: ResumeTarget | None = None


class ResumeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    target: ResumeTarget | None = None
    template: Template | None = None
    is_default: bool | None = None


class ResumeSummary(BaseModel):
    id: uuid.UUID
    name: str
    target: str
    template: str
    is_default: bool
    version_no: int
    sections_count: int
    updated_at: datetime


class ResumeDetail(ResumeSummary):
    sections: list[SectionRead]


class VersionCreate(BaseModel):
    note: str | None = Field(default=None, max_length=300)


class VersionRead(BaseModel):
    id: uuid.UUID
    version_no: int
    note: str | None
    created_at: datetime
    is_current: bool
    sections_count: int


# ---------------------------------------------------------- CV Analyzer
class DocumentRead(ORMModel):
    id: uuid.UUID
    original_filename: str
    mime_type: str
    size_bytes: int
    parse_status: str
    parse_error: str | None
    parsed_data: dict[str, Any] | None
    confirmed_at: datetime | None
    created_at: datetime


class ConfirmedSkill(BaseModel):
    skill_id: uuid.UUID
    proficiency: int = Field(default=3, ge=1, le=5)


class CvConfirm(BaseModel):
    """Solo se guarda lo que la persona reviso y confirmo."""

    headline: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=3000)
    experiences: list[ExperienceIn] = Field(default_factory=list, max_length=30)
    education: list[EducationIn] = Field(default_factory=list, max_length=20)
    certifications: list[CertificationIn] = Field(default_factory=list, max_length=30)
    languages: list[LanguageIn] = Field(default_factory=list, max_length=15)
    links: list[LinkIn] = Field(default_factory=list, max_length=10)
    skills: list[ConfirmedSkill] = Field(default_factory=list, max_length=80)


class ConfirmResult(BaseModel):
    created: dict[str, int]
    skipped: dict[str, int]
