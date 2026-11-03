import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, UUIDPrimaryKeyMixin


class MatchResult(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "match_results"

    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"))
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"))
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    score_low: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    score_high: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    model_version: Mapped[str] = mapped_column(String(50))
    breakdown: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    strengths: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    gaps: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    explanation: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
