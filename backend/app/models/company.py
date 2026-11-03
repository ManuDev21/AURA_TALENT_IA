import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Company(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(150))
    slug: Mapped[str] = mapped_column(CITEXT)
    description: Mapped[str | None] = mapped_column(Text)
    sector: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(150))
    website: Mapped[str | None] = mapped_column(String(300))
    size_range: Mapped[str | None] = mapped_column(String(20))
    culture: Mapped[str | None] = mapped_column(Text)
    benefits: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    contact_email: Mapped[str | None] = mapped_column(CITEXT)
    logo_key: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class CompanyUser(TimestampMixin, Base):
    __tablename__ = "company_users"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="active")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
