from fastapi import APIRouter, Request

from app.analytics.ml_pipeline import run_full_ml_lab
from app.config import get_settings
from app.core.deps import Audit, Authorized, DbSession
from app.core.rate_limit import limiter
from app.llm.ollama import OllamaClient
from app.schemas.aura import (
    AuraCommandIn,
    AuraReply,
    MlLabRunIn,
    OllamaAutomateIn,
    OllamaAutomateOut,
    OllamaCreateModelIn,
    OllamaCreateModelOut,
    OllamaStatusOut,
    TokenIn,
)
from app.services.orchestrator_service import OrchestratorService

router = APIRouter(prefix="/aura", tags=["aura"])

Use = Authorized("aura:use")


def _ollama_client() -> OllamaClient:
    s = get_settings()
    return OllamaClient(
        base_url=s.ollama_base_url,
        model=s.ollama_model,
        base_model=s.ollama_base_model,
    )


@router.post("/command", response_model=AuraReply)
@limiter.limit("60/minute")
async def command(
    request: Request, data: AuraCommandIn, db: DbSession, principal: Use, audit: Audit
) -> AuraReply:
    return await OrchestratorService(db, principal, audit).handle(data)


@router.post("/confirm", response_model=AuraReply)
async def confirm(data: TokenIn, db: DbSession, principal: Use, audit: Audit) -> AuraReply:
    return await OrchestratorService(db, principal, audit).confirm(data.token)


@router.post("/cancel", response_model=AuraReply)
async def cancel(data: TokenIn, db: DbSession, principal: Use, audit: Audit) -> AuraReply:
    return await OrchestratorService(db, principal, audit).cancel(data.token)


@router.get("/ollama/status", response_model=OllamaStatusOut)
async def ollama_status(_principal: Use) -> OllamaStatusOut:
    status_data = await _ollama_client().status()
    return OllamaStatusOut(**status_data)


@router.post("/ollama/create-model", response_model=OllamaCreateModelOut)
async def ollama_create_model(
    data: OllamaCreateModelIn, _principal: Use, audit: Audit
) -> OllamaCreateModelOut:
    res = await _ollama_client().create_custom_model(data.base_model)
    audit.record(
        module="aura",
        action="ollama.create_model",
        result="success",
        actor_user_id=_principal.id,
        entity_type="ai_model",
        changes={"model": res["model"], "base_model": res["base_model"], "created": res["created"]},
    )
    return OllamaCreateModelOut(**res)


@router.post("/ollama/automate", response_model=OllamaAutomateOut)
@limiter.limit("30/minute")
async def ollama_automate(
    request: Request, data: OllamaAutomateIn, _principal: Use, audit: Audit
) -> OllamaAutomateOut:
    res = await _ollama_client().automate(data.task, data.prompt, data.role_hint)
    audit.record(
        module="aura",
        action=f"ollama.automate.{data.task}",
        result="success",
        actor_user_id=_principal.id,
        entity_type="ai_automation",
        changes={"engine": res["engine"], "latency_ms": res["latency_ms"]},
    )
    return OllamaAutomateOut(**res)


@router.get("/ml-lab/overview")
async def ml_lab_overview(_principal: Use) -> dict:
    """Devuelve el laboratorio completo (Practicas 01, 02 y 03) con valores por defecto."""
    return run_full_ml_lab()


@router.post("/ml-lab/simulate")
async def ml_lab_simulate(data: MlLabRunIn, _principal: Use, audit: Audit) -> dict:
    """Evalua un caso nuevo y recalcula las Practicas 01 a 05."""
    result = run_full_ml_lab(
        horas_estudio=data.horas_estudio,
        asistencia=data.asistencia,
        actividades_entregadas=data.actividades_entregadas,
        participacion=data.participacion,
        min_horas_rule=data.min_horas_rule,
        min_asistencia_rule=data.min_asistencia_rule,
        min_actividades_rule=data.min_actividades_rule,
        max_depth=data.max_depth,
        knn_neighbors=data.knn_neighbors,
        rf_estimators=data.rf_estimators,
        dt_max_depth=data.dt_max_depth,
    )
    audit.record(
        module="aura",
        action="ml_lab.simulate",
        result="success",
        actor_user_id=_principal.id,
        entity_type="ml_simulation",
        changes={
            "horas_estudio": data.horas_estudio,
            "asistencia": data.asistencia,
            "actividades_entregadas": data.actividades_entregadas,
            "participacion": data.participacion,
            "knn_neighbors": data.knn_neighbors,
            "rf_estimators": data.rf_estimators,
            "dt_max_depth": data.dt_max_depth,
        },
    )
    return result

