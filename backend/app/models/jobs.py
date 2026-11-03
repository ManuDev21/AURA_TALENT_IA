import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import REAL, Boolean, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, CreatedAtMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.company import Company
from app.models.skills import Skill


class JobSkill(Base):
    __tablename__ = "job_skills"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("skills.id", ondelete="RESTRICT"), primary_key=True
    )
    importance: Mapped[str] = mapped_column(String(10), default="required")
    min_proficiency: Mapped[int] = mapped_column(SmallInteger, default=3)
    weight: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("1"))

    skill: Mapped[Skill] = relationship(lazy="joined")


class JobLanguage(Base):
    __tablename__ = "job_languages"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), primary_key=True
    )
    language_code: Mapped[str] = mapped_column(String(10), primary_key=True)
    min_level: Mapped[str] = mapped_column(String(6))
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)


class JobRequirement(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "job_requirements"

    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"))
    requirement_type: Mapped[str] = mapped_column(String(15))
    description: Mapped[str] = mapped_column(Text)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class JobPosting(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "job_postings"

    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(150))
    modality: Mapped[str] = mapped_column(String(10))
    employment_type: Mapped[str] = mapped_column(String(20), default="full_time")
    salary_min: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    salary_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    salary_currency: Mapped[str | None] = mapped_column(String(3))
    show_salary: Mapped[bool] = mapped_column(Boolean, default=False)
    experience_min_years: Mapped[Decimal] = mapped_column(Numeric(4, 1), default=Decimal("0"))
    education_level: Mapped[str | None] = mapped_column(String(20))
    responsibilities: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    benefits: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    schedule_description: Mapped[str | None] = mapped_column(String(300))
    response_sla_days: Mapped[int | None] = mapped_column(SmallInteger)
    process_estimate_days: Mapped[int | None] = mapped_column(SmallInteger)
    last_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_confirmed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(10), default="DRAFT")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(REAL))
    embedding_model: Mapped[str | None] = mapped_column(String(100))

    company: Mapped[Company] = relationship(lazy="joined")
    skills: Mapped[list[JobSkill]] = relationship(lazy="selectin", cascade="all, delete-orphan")
    languages: Mapped[list[JobLanguage]] = relationship(lazy="selectin", cascade="all, delete-orphan")
    requirements: Mapped[list[JobRequirement]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", order_by="JobRequirement.display_order"
    )


class ApplicationStage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "application_stages"

    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    display_order: Mapped[int] = mapped_column(SmallInteger)
    is_terminal: Mapped[bool] = mapped_column(Boolean, default=False)


class Application(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "applications"

    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="RESTRICT"))
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="RESTRICT"))
    # Lo fija un trigger a partir de la vacante (aislamiento multiempresa)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"))
    resume_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("resume_versions.id", ondelete="SET NULL")
    )
    cover_letter: Mapped[str | None] = mapped_column(Text)
    current_stage: Mapped[str] = mapped_column(String(20), default="APPLIED")
    status: Mapped[str] = mapped_column(String(10), default="active")
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    job: Mapped[JobPosting] = relationship(lazy="joined")


class ApplicationHistory(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "application_history"

    application_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"))
    from_stage: Mapped[str | None] = mapped_column(String(20))
    to_stage: Mapped[str] = mapped_column(String(20))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    actor_type: Mapped[str] = mapped_column(String(10))
    comment: Mapped[str | None] = mapped_column(Text)
    reason_code: Mapped[str | None] = mapped_column(String(50))


class ApplicationNote(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "application_notes"

    application_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"))
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    body: Mapped[str] = mapped_column(Text)
    visibility: Mapped[str] = mapped_column(String(10), default="team")


class Notification(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    notification_type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(300))
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
