import uuid
from datetime import datetime

from sqlalchemy import DateTime, FetchedValue, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    # Recupera con RETURNING los valores generados por la BD (defaults y trigger de updated_at);
    # evita cargas perezosas implicitas que no estan permitidas en modo async.
    __mapper_args__ = {"eager_defaults": True}


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )


class CreatedAtMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TimestampMixin(CreatedAtMixin):
    # updated_at lo mantiene un trigger en PostgreSQL
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), server_onupdate=FetchedValue()
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
