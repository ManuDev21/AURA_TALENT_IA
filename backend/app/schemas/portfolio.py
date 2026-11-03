import uuid
from datetime import date
from typing import Literal, Self

from pydantic import Field, model_validator

from app.schemas.candidate import LinkRead
from app.schemas.common import HttpUrlStr, OptStr, ORMModel, check_date_range
from app.schemas.skills import SkillRead

Visibility = Literal["private", "link", "public"]


class ProjectIn(ORMModel):
    title: str = Field(min_length=1, max_length=200)
    description: OptStr = Field(default=None, max_length=4000)
    role: OptStr = Field(default=None, max_length=150)
    repo_url: HttpUrlStr = None
    demo_url: HttpUrlStr = None
    docs_url: HttpUrlStr = None
    started_at: date | None = None
    ended_at: date | None = None
    is_featured: bool = False
    display_order: int = Field(default=0, ge=0, le=1000)
    skill_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def _dates(self) -> Self:
        check_date_range(self.started_at, self.ended_at)
        return self


class ProjectRead(ORMModel):
    id: uuid.UUID
    title: str
    description: str | None
    role: str | None
    repo_url: str | None
    demo_url: str | None
    docs_url: str | None
    started_at: date | None
    ended_at: date | None
    is_featured: bool
    display_order: int
    skills: list[SkillRead]


class PortfolioSettings(ORMModel):
    slug: str
    title: str | None
    visibility: str


class PortfolioUpdate(ORMModel):
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$")
    title: OptStr = Field(default=None, max_length=200)
    visibility: Visibility | None = None


class PortfolioMe(ORMModel):
    settings: PortfolioSettings
    projects: list[ProjectRead]


class PublicSkill(ORMModel):
    name: str
    category: str | None
    proficiency: int


class PublicPortfolio(ORMModel):
    full_name: str
    title: str | None
    headline: str | None
    summary: str | None
    location: str | None
    projects: list[ProjectRead]
    skills: list[PublicSkill]
    links: list[LinkRead]
