import uuid
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.core.security import utcnow
from app.models import Notification
from app.schemas.jobs import NotificationList, NotificationRead


def notify(
    session: AsyncSession,
    user_id: uuid.UUID | None,
    kind: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    data: dict[str, Any] | None = None,
) -> None:
    """Agrega una notificacion interna a la transaccion en curso."""
    if user_id is None:
        return
    session.add(
        Notification(
            user_id=user_id, notification_type=kind, title=title, body=body, link=link, data=data or {}
        )
    )


class NotificationService:
    def __init__(self, session: AsyncSession, user_id: uuid.UUID) -> None:
        self.session = session
        self.user_id = user_id

    async def list_notifications(self, limit: int = 30) -> NotificationList:
        rows = (
            await self.session.scalars(
                select(Notification)
                .where(Notification.user_id == self.user_id)
                .order_by(Notification.created_at.desc())
                .limit(limit)
            )
        ).all()
        unread = await self.session.scalar(
            select(func.count()).where(Notification.user_id == self.user_id, Notification.read_at.is_(None))
        )
        return NotificationList(
            items=[NotificationRead.model_validate(n) for n in rows], unread=int(unread or 0)
        )

    async def mark_read(self, notification_id: uuid.UUID) -> None:
        notification = await self.session.get(Notification, notification_id)
        if notification is None or notification.user_id != self.user_id:
            raise NotFoundError("Notificacion no encontrada.")
        notification.read_at = notification.read_at or utcnow()
        await self.session.commit()

    async def mark_all_read(self) -> None:
        await self.session.execute(
            update(Notification)
            .where(Notification.user_id == self.user_id, Notification.read_at.is_(None))
            .values(read_at=utcnow())
        )
        await self.session.commit()
