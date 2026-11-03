import uuid
from datetime import date

from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, Table, Text
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.candidate import CandidateOwnedMixin
from app.models.skills import Skill

project_skills = Table(
    "project_skills",
    Base.metadata,
    Column("project_id", UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", UUID(as_uuid=True), ForeignKey("skills.id", ondelete="RESTRICT"), primary_key=True),
)


class Project(UUIDPrimaryKeyMixin, CandidateOwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "projects"

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str | None] = mapped_column(String(150))
    repo_url: Mapped[str | None] = mapped_column(String(500))
    demo_url: Mapped[str | None] = mapped_column(String(500))
    docs_url: Mapped[str | None] = mapped_column(String(500))
    started_at: Mapped[date | None] = mapped_column(Date)
    ended_at: Mapped[date | None] = mapped_column(Date)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    skills: Mapped[list[Skill]] = relationship(secondary=project_skills, lazy="selectin")


class Portfolio(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "portfolios"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), unique=True
    )
    slug: Mapped[str] = mapped_column(CITEXT, unique=True)
    title: Mapped[str | None] = mapped_column(String(200))
    visibility: Mapped[str] = mapped_column(String(10), default="private")
    theme: Mapped[str] = mapped_column(String(50), default="aura-dark")
