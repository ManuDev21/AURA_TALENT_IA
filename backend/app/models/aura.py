import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, CreatedAtMixin, TimestampMixin, UUIDPrimaryKeyMixin


class AiCommand(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_commands"

    code: Mapped[str] = mapped_column(String(60), unique=True)
    intent: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(Text)
    required_permission: Mapped[str] = mapped_column(String(100))
    risk_level: Mapped[str] = mapped_column(String(6), default="low")
    requires_confirmation: Mapped[bool] = mapped_column(Boolean, default=False)
    allowed_roles: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    examples: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class AiInteraction(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "ai_interactions"

    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    channel: Mapped[str] = mapped_column(String(10))
    input_text: Mapped[str | None] = mapped_column(Text)
    detected_intent: Mapped[str | None] = mapped_column(String(60))
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    entities: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    command_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("ai_commands.id", ondelete="SET NULL"))
    tool_calls: Mapped[list[Any]] = mapped_column(JSONB, default=list)
    response_summary: Mapped[str | None] = mapped_column(Text)
    outcome: Mapped[str] = mapped_column(String(20))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    llm_used: Mapped[bool] = mapped_column(Boolean, default=False)
    llm_provider: Mapped[str | None] = mapped_column(String(50))


class AiPendingAction(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "ai_pending_actions"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    interaction_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ai_interactions.id", ondelete="SET NULL")
    )
    command_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ai_commands.id", ondelete="CASCADE"))
    arguments: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    summary: Mapped[str] = mapped_column(Text)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
