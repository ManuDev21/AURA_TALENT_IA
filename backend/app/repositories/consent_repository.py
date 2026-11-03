import uuid

from sqlalchemy import select

from app.models import Consent
from app.repositories.base import BaseRepository


class ConsentRepository(BaseRepository[Consent]):
    model = Consent

    async def list_for_user(self, user_id: uuid.UUID) -> list[Consent]:
        stmt = select(Consent).where(Consent.user_id == user_id).order_by(Consent.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
