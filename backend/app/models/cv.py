import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.candidate import CandidateOwnedMixin


class Resume(UUIDPrimaryKeyMixin, CandidateOwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "resumes"

    name: Mapped[str] = mapped_column(String(150))
    target: Mapped[str] = mapped_column(String(15), default="general")
    template: Mapped[str] = mapped_column(String(50), default="aura-classic")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("resume_versions.id", ondelete="SET NULL", use_alter=True)
    )


class ResumeVersion(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "resume_versions"

    resume_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"))
    version_no: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    template: Mapped[str | None] = mapped_column(String(50))
    note: Mapped[str | None] = mapped_column(String(300))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sections: Mapped[list["ResumeSection"]] = relationship(
        lazy="selectin", order_by="ResumeSection.display_order", cascade="all, delete-orphan"
    )


class ResumeSection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "resume_sections"

    resume_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resume_versions.id", ondelete="CASCADE"))
    section_type: Mapped[str] = mapped_column(String(20))
    title: Mapped[str | None] = mapped_column(String(150))
    display_order: Mapped[int] = mapped_column(Integer)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class CvDocument(UUIDPrimaryKeyMixin, CandidateOwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "cv_documents"

    original_filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(300))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    parse_status: Mapped[str] = mapped_column(String(12), default="pending")
    parse_error: Mapped[str | None] = mapped_column(String)
    parsed_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
