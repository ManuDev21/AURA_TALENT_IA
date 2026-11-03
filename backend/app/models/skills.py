import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import REAL, Boolean, DateTime, ForeignKey, Numeric, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class SkillCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skill_categories"

    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)


class Skill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(CITEXT, unique=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("skill_categories.id", ondelete="SET NULL")
    )
    skill_type: Mapped[str] = mapped_column(String(25))
    description: Mapped[str | None] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(REAL))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped[SkillCategory | None] = relationship(lazy="joined")


class SkillAlias(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "skill_aliases"

    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"))
    alias: Mapped[str] = mapped_column(CITEXT, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CandidateSkill(TimestampMixin, Base):
    __tablename__ = "candidate_skills"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("skills.id", ondelete="RESTRICT"), primary_key=True
    )
    proficiency: Mapped[int] = mapped_column(SmallInteger, default=3)
    years_experience: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    last_used_year: Mapped[int | None] = mapped_column(SmallInteger)
    source: Mapped[str] = mapped_column(String(15), default="manual")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    skill: Mapped[Skill] = relationship(lazy="joined")


class SkillEvidence(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "skill_evidence"

    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"))
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="RESTRICT"))
    evidence_type: Mapped[str] = mapped_column(String(25))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    evidence_url: Mapped[str | None] = mapped_column(String(500))
    issuer: Mapped[str | None] = mapped_column(String(200))
    credential_ref: Mapped[str | None] = mapped_column(String(300))
    source: Mapped[str] = mapped_column(String(20), default="candidate_submitted")
    share_with_companies: Mapped[bool] = mapped_column(Boolean, default=False)
    skill: Mapped[Skill] = relationship(lazy="joined")
