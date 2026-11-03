import uuid
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import ClientInfo
from app.models import AuditLog


class AuditService:
    def __init__(self, session: AsyncSession, client: ClientInfo | None = None) -> None:
        self.session = session
        self.client = client

    def record(
        self,
        *,
        module: str,
        action: str,
        result: Literal["success", "denied", "error"],
        actor_user_id: uuid.UUID | None = None,
        actor_type: Literal["human", "system", "ai"] = "human",
        company_id: uuid.UUID | None = None,
        entity_type: str | None = None,
        entity_id: uuid.UUID | None = None,
        changes: dict[str, Any] | None = None,
    ) -> None:
        self.session.add(
            AuditLog(
                actor_user_id=actor_user_id,
                actor_type=actor_type,
                company_id=company_id,
                module=module,
                action=action,
                result=result,
                entity_type=entity_type,
                entity_id=entity_id,
                changes=changes,
                ip=self.client.ip if self.client else None,
                user_agent=self.client.user_agent if self.client else None,
                request_id=self.client.request_id if self.client else None,
            )
        )
