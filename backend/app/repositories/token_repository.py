import uuid
from datetime import datetime

from sqlalchemy import select, update

from app.models import RefreshToken, UserToken
from app.repositories.base import BaseRepository


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    model = RefreshToken

    async def get_by_hash_for_update(self, token_hash: str) -> RefreshToken | None:
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def revoke_family(self, family_id: uuid.UUID, when: datetime) -> None:
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=when)
        )

    async def revoke_all_for_user(self, user_id: uuid.UUID, when: datetime) -> None:
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=when)
        )


class UserTokenRepository(BaseRepository[UserToken]):
    model = UserToken

    async def get_valid(self, token_hash: str, purpose: str, now: datetime) -> UserToken | None:
        stmt = (
            select(UserToken)
            .where(
                UserToken.token_hash == token_hash,
                UserToken.purpose == purpose,
                UserToken.used_at.is_(None),
                UserToken.expires_at > now,
            )
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def invalidate_pending(self, user_id: uuid.UUID, purpose: str, when: datetime) -> None:
        await self.session.execute(
            update(UserToken)
            .where(UserToken.user_id == user_id, UserToken.purpose == purpose, UserToken.used_at.is_(None))
            .values(used_at=when)
        )
