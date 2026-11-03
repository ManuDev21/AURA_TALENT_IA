import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class AssessmentType(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "assessment_types"

    code: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)


class Assessment(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """AssessmentDefinition: instrumento de evaluacion."""

    __tablename__ = "assessments"

    type_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_types.id", ondelete="RESTRICT"))
    company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(CITEXT, unique=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    is_experimental: Mapped[bool] = mapped_column(Boolean, default=True)
    license_type: Mapped[str] = mapped_column(String(10), default="original")
    license_ref: Mapped[str | None] = mapped_column(String(200))
    is_clinical: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(10), default="draft")
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    type: Mapped[AssessmentType] = relationship(lazy="joined")


class PsychometricDimension(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "psychometric_dimensions"

    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_versions.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    construct_definition: Mapped[str | None] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0)


class PsychometricScale(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "psychometric_scales"

    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_versions.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(50))
    scale_type: Mapped[str] = mapped_column(String(10))
    min_value: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    max_value: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    labels: Mapped[dict[str, str]] = mapped_column(JSONB, default=dict)


class AssessmentOption(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "assessment_options"

    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_questions.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(Text)
    value: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    is_correct: Mapped[bool | None] = mapped_column(Boolean)
    rubric_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    rubric_rationale: Mapped[str | None] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class AssessmentQuestion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "assessment_questions"

    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_versions.id", ondelete="CASCADE"))
    dimension_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("psychometric_dimensions.id", ondelete="CASCADE")
    )
    scale_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("psychometric_scales.id", ondelete="RESTRICT")
    )
    skill_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("skills.id", ondelete="SET NULL"))
    question_type: Mapped[str] = mapped_column(String(20))
    stem: Mapped[str] = mapped_column(Text)
    context: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    explanation: Mapped[str | None] = mapped_column(Text)
    reverse_keyed: Mapped[bool] = mapped_column(Boolean, default=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("1"))
    difficulty: Mapped[int | None] = mapped_column(SmallInteger)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_attention_check: Mapped[bool] = mapped_column(Boolean, default=False)
    expected_value: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    options: Mapped[list[AssessmentOption]] = relationship(
        lazy="selectin", order_by="AssessmentOption.display_order", cascade="all, delete-orphan"
    )


class ScoringRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scoring_rules"

    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_versions.id", ondelete="CASCADE"))
    dimension_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("psychometric_dimensions.id", ondelete="CASCADE")
    )
    method: Mapped[str] = mapped_column(String(15))
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class InterpretationRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "interpretation_rules"

    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_versions.id", ondelete="CASCADE"))
    dimension_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("psychometric_dimensions.id", ondelete="CASCADE")
    )
    min_score: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    max_score: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    band: Mapped[str] = mapped_column(String(10))
    text_template: Mapped[str] = mapped_column(Text)
    recommendations: Mapped[list[str]] = mapped_column(JSONB, default=list)


class AssessmentVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "assessment_versions"

    assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"))
    version_no: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(10), default="draft")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    time_limit_seconds: Mapped[int | None] = mapped_column(Integer)
    instructions: Mapped[str | None] = mapped_column(Text)
    consent_text: Mapped[str | None] = mapped_column(Text)
    limitations_text: Mapped[str | None] = mapped_column(Text)
    disclaimer_text: Mapped[str | None] = mapped_column(Text)
    randomize_questions: Mapped[bool] = mapped_column(Boolean, default=False)
    checksum: Mapped[str | None] = mapped_column(String(64))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    assessment: Mapped[Assessment] = relationship(lazy="joined")
    dimensions: Mapped[list[PsychometricDimension]] = relationship(
        lazy="selectin", order_by="PsychometricDimension.display_order", cascade="all, delete-orphan"
    )
    scales: Mapped[list[PsychometricScale]] = relationship(lazy="selectin", cascade="all, delete-orphan")
    questions: Mapped[list[AssessmentQuestion]] = relationship(
        lazy="selectin", order_by="AssessmentQuestion.display_order", cascade="all, delete-orphan"
    )
    scoring_rules: Mapped[list[ScoringRule]] = relationship(lazy="selectin", cascade="all, delete-orphan")
    interpretation_rules: Mapped[list[InterpretationRule]] = relationship(
        lazy="selectin", cascade="all, delete-orphan"
    )


class AssessmentAssignment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "assessment_assignments"

    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_versions.id", ondelete="RESTRICT"))
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"))
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE")
    )
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), default="pending")


class AssessmentAnswer(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "assessment_answers"

    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_attempts.id", ondelete="CASCADE"))
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_questions.id", ondelete="RESTRICT"))
    option_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assessment_options.id", ondelete="RESTRICT")
    )
    numeric_value: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    text_value: Mapped[str | None] = mapped_column(Text)
    time_ms: Mapped[int | None] = mapped_column(Integer)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AssessmentAttempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "assessment_attempts"

    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_versions.id", ondelete="RESTRICT"))
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"))
    assignment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assessment_assignments.id", ondelete="SET NULL")
    )
    consent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("consents.id", ondelete="RESTRICT"))
    status: Mapped[str] = mapped_column(String(12), default="in_progress")
    random_seed: Mapped[int | None] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    quality_flags: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    share_with_company: Mapped[bool] = mapped_column(Boolean, default=False)

    version: Mapped[AssessmentVersion] = relationship(lazy="joined")
    answers: Mapped[list[AssessmentAnswer]] = relationship(lazy="selectin", cascade="all, delete-orphan")


class ResultDimensionScore(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "result_dimension_scores"

    result_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_results.id", ondelete="CASCADE"))
    dimension_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("psychometric_dimensions.id", ondelete="RESTRICT")
    )
    raw_score: Mapped[Decimal] = mapped_column(Numeric(8, 3))
    normalized_score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    band: Mapped[str] = mapped_column(String(10))
    interpretation: Mapped[str] = mapped_column(Text)
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)


class AssessmentResult(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "assessment_results"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessment_attempts.id", ondelete="CASCADE"), unique=True
    )
    overall_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    summary: Mapped[str | None] = mapped_column(Text)
    limitations: Mapped[str | None] = mapped_column(Text)
    disclaimer: Mapped[str] = mapped_column(Text)
    scoring_version: Mapped[str] = mapped_column(String(30))
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    dimension_scores: Mapped[list[ResultDimensionScore]] = relationship(
        lazy="selectin", cascade="all, delete-orphan"
    )
