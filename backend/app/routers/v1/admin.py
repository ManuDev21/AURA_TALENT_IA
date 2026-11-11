from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from app.analytics.ml_pipeline import MODEL_VERSION as ML_CART_VERSION
from app.career.roles import CATALOG_VERSION
from app.core.deps import Authorized, DbSession, require_permissions
from app.core.principal import Principal
from app.match.engine import MODEL_VERSION as MATCH_VERSION
from app.repositories.user_repository import RoleRepository
from app.schemas.user import RoleRead
from app.services.audit_query_service import AuditQueryService
from app.services.recommendation_service import MODEL_VERSION as RECS_VERSION

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/audit")
async def audit_log(
    db: DbSession,
    principal: Authorized("audit:read"),
    module: str | None = Query(default=None, max_length=50),
    result: Literal["success", "denied", "error"] | None = None,
    q: str | None = Query(default=None, max_length=100),
    since: datetime | None = None,
    page: int = Query(default=1, ge=1, le=1000),
) -> dict:
    return await AuditQueryService(db, principal).search(module, result, q, since, page)


@router.get("/models")
async def model_registry(db: DbSession, _: Authorized("admin:ml_models")) -> dict:
    """Motores de decision en uso: version, metodo y limitaciones (transparencia para auditoria)."""
    engines = [
        {
            "name": "AURA Match",
            "version": MATCH_VERSION,
            "task": "Compatibilidad candidato-vacante",
            "method": "Promedio ponderado de factores explicables con rango de incertidumbre.",
            "limitations": "Sin atributos protegidos ni psicometria. Similitud de texto por terminos.",
        },
        {
            "name": "Recomendaciones",
            "version": RECS_VERSION,
            "task": "Vacantes, habilidades, cursos, rutas",
            "method": "Hibrido de reglas y contenido; respeta lo descartado por la persona.",
            "limitations": "Sin filtrado colaborativo; catalogo de recursos inicial.",
        },
        {
            "name": "Career Map",
            "version": CATALOG_VERSION,
            "task": "Cobertura de roles y rutas",
            "method": "Catalogo editorial de roles comparado con habilidades declaradas.",
            "limitations": "Referencias generales de rol; niveles autodeclarados.",
        },
        {
            "name": "Orquestador AURA",
            "version": "intents-rules-v1",
            "task": "Comandos de texto y voz",
            "method": "Reglas de intencion en espanol sobre el catalogo ai_commands.",
            "limitations": "Frases predefinidas; sin LLM mientras no se configure GEMINI_API_KEY.",
        },
        {
            "name": "Vision y gestos",
            "version": "mediapipe-tasks-1.0.1",
            "task": "Presencia y control por gestos",
            "method": "Modelos MediaPipe ejecutados en el navegador.",
            "limitations": "No identifica personas ni emociones; nada se envia al servidor.",
        },
        {
            "name": "Calidad de Datos y Arbol CART vs Reglas",
            "version": ML_CART_VERSION,
            "task": "Auditoria de calidad tabular y comparativa Reglas Fijas vs Arbol CART",
            "method": "Limpieza auditable (nulos, duplicados, rangos), split 70/30 y CART.",
            "limitations": "Fines analiticos y formativos; nunca toma decisiones automaticas.",
        },
    ]
    rows = (
        await db.execute(
            text(
                "SELECT name, version, task, status, metrics, trained_at "
                "FROM ml_models ORDER BY created_at DESC"
            )
        )
    ).mappings()
    return {"engines": engines, "registered": [dict(r) for r in rows]}


@router.get("/roles", response_model=list[RoleRead])
async def list_roles(
    db: DbSession, _: Annotated[Principal, Depends(require_permissions("admin:roles"))]
) -> list[RoleRead]:
    roles = await RoleRepository(db).list_all()
    return [RoleRead.model_validate(r) for r in roles]
