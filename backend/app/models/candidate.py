import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import REAL, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class CandidateProfile(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "candidate_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    headline: Mapped[str | None] = mapped_column(String(200))
    summary: Mapped[str | None] = mapped_column(Text)
    location_city: Mapped[str | None] = mapped_column(String(100))
    location_country: Mapped[str | None] = mapped_column(String(100))
    availability: Mapped[str | None] = mapped_column(String(20))
    work_modality: Mapped[str | None] = mapped_column(String(10))
    desired_roles: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    salary_expectation: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    salary_currency: Mapped[str | None] = mapped_column(String(3))
    goals: Mapped[str | None] = mapped_column(Text)
    interests: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    is_discoverable: Mapped[bool] = mapped_column(Boolean, default=False)
    completeness: Mapped[int] = mapped_column(SmallInteger, default=0)
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(REAL))
    embedding_model: Mapped[str | None] = mapped_column(String(100))
    embedding_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CandidateOwnedMixin:
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"))


class Education(UUIDPrimaryKeyMixin, CandidateOwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "education"

    institution: Mapped[str] = mapped_column(String(200))
    degree: Mapped[str | None] = mapped_column(String(200))
    field_of_study: Mapped[str | None] = mapped_column(String(200))
    level: Mapped[str | None] = mapped_column(String(20))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(15), default="manual")


class Experience(UUIDPrimaryKeyMixin, CandidateOwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "experiences"

    company_name: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(200))
    employment_type: Mapped[str | None] = mapped_column(String(20))
    location: Mapped[str | None] = mapped_column(String(150))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text)
    achievements: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    source: Mapped[str] = mapped_column(String(15), default="manual")


class Certification(UUIDPrimaryKeyMixin, CandidateOwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "certifications"

    name: Mapped[str] = mapped_column(String(200))
    issuer: Mapped[str | None] = mapped_column(String(200))
    issued_at: Mapped[date | None] = mapped_column(Date)
    expires_at: Mapped[date | None] = mapped_column(Date)
    credential_id: Mapped[str | None] = mapped_column(String(150))
    credential_url: Mapped[str | None] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(15), default="manual")


class CandidateLanguage(UUIDPrimaryKeyMixin, CandidateOwnedMixin, TimestampMixin, Base):
    __tablename__ = "candidate_languages"

    language_code: Mapped[str] = mapped_column(String(10))
    level: Mapped[str] = mapped_column(String(6))
    is_certified: Mapped[bool] = mapped_column(Boolean, default=False)
    certificate_name: Mapped[str | None] = mapped_column(String(150))


class ProfileLink(UUIDPrimaryKeyMixin, CandidateOwnedMixin, TimestampMixin, Base):
    __tablename__ = "profile_links"

    link_type: Mapped[str] = mapped_column(String(15))
    url: Mapped[str] = mapped_column(String(500))
    label: Mapped[str | None] = mapped_column(String(100))
    display_order: Mapped[int] = mapped_column(Integer, default=0)
