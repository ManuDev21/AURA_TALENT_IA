import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import REAL, Boolean, Column, DateTime, ForeignKey, Numeric, String, Table, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, CreatedAtMixin, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.skills import Skill

learning_resource_skills = Table(
    "learning_resource_skills",
    Base.metadata,
    Column(
        "resource_id",
        UUID(as_uuid=True),
        ForeignKey("learning_resources.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("skill_id", UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
)


class LearningResource(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "learning_resources"

    title: Mapped[str] = mapped_column(String(250))
    provider: Mapped[str | None] = mapped_column(String(150))
    url: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    level: Mapped[str | None] = mapped_column(String(15))
    duration_hours: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))
    cost_type: Mapped[str | None] = mapped_column(String(10))
    language_code: Mapped[str] = mapped_column(String(10), default="es")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    skills: Mapped[list[Skill]] = relationship(secondary=learning_resource_skills, lazy="selectin")


class Recommendation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "recommendations"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rec_type: Mapped[str] = mapped_column(String(15))
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    target_label: Mapped[str | None] = mapped_column(String(250))
    score: Mapped[Decimal] = mapped_column(Numeric(6, 4))
    reason: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    strategy: Mapped[str] = mapped_column(String(10))
    model_version: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(10), default="active")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RecommendationFeedback(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "recommendation_feedback"

    recommendation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("recommendations.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    action: Mapped[str] = mapped_column(String(10))


class CareerNode(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "career_nodes"

    path_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("career_paths.id", ondelete="CASCADE"))
    node_type: Mapped[str] = mapped_column(String(10))
    ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    label: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(12), default="target")
    pos_x: Mapped[float] = mapped_column(REAL, default=0)
    pos_y: Mapped[float] = mapped_column(REAL, default=0)
    pos_z: Mapped[float] = mapped_column(REAL, default=0)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class CareerEdge(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "career_edges"

    path_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("career_paths.id", ondelete="CASCADE"))
    source_node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("career_nodes.id", ondelete="CASCADE"))
    target_node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("career_nodes.id", ondelete="CASCADE"))
    edge_type: Mapped[str] = mapped_column(String(10), default="leads_to")
    weight: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("1"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CareerPath(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "career_paths"

    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    goal_role: Mapped[str | None] = mapped_column(String(200))
    generated_by: Mapped[str] = mapped_column(String(5), default="user")
    status: Mapped[str] = mapped_column(String(10), default="active")

    nodes: Mapped[list[CareerNode]] = relationship(lazy="selectin", cascade="all, delete-orphan")
    edges: Mapped[list[CareerEdge]] = relationship(lazy="selectin", cascade="all, delete-orphan")
