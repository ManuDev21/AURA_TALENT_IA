import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.base import Base


class BaseRepository[ModelT: Base]:
    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _active(self) -> Any:
        stmt = select(self.model)
        deleted_at = getattr(self.model, "deleted_at", None)
        if deleted_at is not None:
            stmt = stmt.where(deleted_at.is_(None))
        return stmt

    async def get(self, entity_id: uuid.UUID) -> ModelT | None:
        result = await self.session.execute(self._active().where(self.model.id == entity_id))  # type: ignore[attr-defined]
        return result.scalar_one_or_none()

    def add(self, entity: ModelT) -> ModelT:
        self.session.add(entity)
        return entity
