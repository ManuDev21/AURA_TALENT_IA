from fastapi import APIRouter, Request

from app.config import get_settings
from app.core.deps import Audit, Authorized, DbSession
from app.core.rate_limit import limiter
from app.llm.ollama import OllamaClient
from app.schemas.aura import (
    AuraCommandIn,
    AuraReply,
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
