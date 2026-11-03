"""Consulta del registro de auditoria.

- Administrador del sistema: ve todo.
- Administrador de empresa: solo eventos de su empresa.
El registro es de solo lectura: no existe ningun endpoint para modificarlo o borrarlo.
"""

from datetime import datetime

from sqlalchemy import func, or_, select

from app.core.principal import Principal
from app.models import AuditLog, User

PAGE_SIZE = 50


class AuditQueryService:
    def __init__(self, session, principal: Principal) -> None:
        self.session = session
        self.principal = principal

    async def search(
        self,
        module: str | None,
        result: str | None,
        q: str | None,
        since: datetime | None,
        page: int,
    ) -> dict:
        stmt = select(AuditLog, User.email).outerjoin(User, User.id == AuditLog.actor_user_id)
        if "ROLE_SYSTEM_ADMIN" not in self.principal.role_codes:
            stmt = stmt.where(AuditLog.company_id.in_(self.principal.company_ids or [None]))
        if module:
            stmt = stmt.where(AuditLog.module == module)
        if result:
            stmt = stmt.where(AuditLog.result == result)
        if since:
            stmt = stmt.where(AuditLog.created_at >= since)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                or_(AuditLog.action.ilike(like), User.email.ilike(like), AuditLog.request_id == q)
            )
        total = await self.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = (
            await self.session.execute(
                stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
            )
        ).all()
        modules = (
            (await self.session.execute(select(AuditLog.module).distinct().order_by(AuditLog.module)))
            .scalars()
            .all()
        )
        return {
            "total": total,
            "page": page,
            "page_size": PAGE_SIZE,
            "modules": list(modules),
            "items": [
                {
                    "id": log.id,
                    "created_at": log.created_at,
                    "actor": email,
                    "actor_type": log.actor_type,
                    "module": log.module,
                    "action": log.action,
                    "result": log.result,
                    "entity_type": log.entity_type,
                    "entity_id": log.entity_id,
                    "ip": str(log.ip) if log.ip else None,
                    "request_id": log.request_id,
                }
                for log, email in rows
            ],
        }
