from fastapi import APIRouter, Request

from app.analytics.ml_pipeline import run_full_ml_lab
from app.analytics.ml_talent_bigdata import (
    evaluate_candidate_dossier,
    run_talent_intelligence_suite,
    simulate_cnn_candidate_trajectory,
)
from app.analytics.ml_unsupervised import run_advanced_ml_lab
from app.config import get_settings
from app.core.deps import Audit, Authorized, DbSession
from app.core.rate_limit import limiter
from app.llm.ollama import OllamaClient
from app.schemas.aura import (
    AuraCommandIn,
    AuraReply,
    MlCandidateDossierIn,
    MlCnnTrajectoryIn,
    MlLabAdvancedIn,
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


@router.post("/ml-lab/advanced")
@limiter.limit("15/minute")
async def ml_lab_advanced(
    request: Request, data: MlLabAdvancedIn, _principal: Use, audit: Audit
) -> dict:
    """Ejecuta las Practicas 06-09: optimizacion de hiperparametros (Grid vs
    Random Search), segmentacion K-Means, estabilidad/atipicos y PCA."""
    result = run_advanced_ml_lab(
        kmeans_k=data.kmeans_k,
        horas_estudio=data.horas_estudio,
        asistencia=data.asistencia,
        actividades_entregadas=data.actividades_entregadas,
        participacion=data.participacion,
    )
    audit.record(
        module="aura",
        action="ml_lab.advanced",
        result="success",
        actor_user_id=_principal.id,
        entity_type="ml_simulation",
        changes={
            "kmeans_k": data.kmeans_k,
            "horas_estudio": data.horas_estudio,
            "asistencia": data.asistencia,
            "actividades_entregadas": data.actividades_entregadas,
            "participacion": data.participacion,
        },
    )
    return result


@router.get("/ml-lab/talent-suite")
async def ml_lab_talent_suite(_principal: Use) -> dict:
    """Devuelve el motor PySpark de 100,000 evaluaciones de talento, el
    benchmark de CNN 1D vs Random Forest y el Expediente Integral de
    Competencias del candidato."""
    return run_talent_intelligence_suite()


@router.post("/ml-lab/cnn-trajectory")
async def ml_lab_cnn_trajectory(
    data: MlCnnTrajectoryIn, _principal: Use, audit: Audit
) -> dict:
    """Simula en tiempo real la CNN 1D de Regresion (estima Etapa 3 STAR a
    partir de Etapas 1 y 2) y la CNN 1D de Clasificacion de Trayectoria."""
    result = simulate_cnn_candidate_trajectory(
        etapa1_cv=data.etapa1_cv,
        etapa2_tecnica=data.etapa2_tecnica,
        constancia_e1=data.constancia_e1,
        constancia_e2=data.constancia_e2,
        etapa3_observada=data.etapa3_observada,
        constancia_e3=data.constancia_e3,
    )
    audit.record(
        module="aura",
        action="ml_lab.cnn_trajectory",
        result="success",
        actor_user_id=_principal.id,
        entity_type="ml_simulation",
        changes={
            "etapa1_cv": data.etapa1_cv,
            "etapa2_tecnica": data.etapa2_tecnica,
            "constancia_e1": data.constancia_e1,
            "constancia_e2": data.constancia_e2,
        },
    )
    return result


@router.post("/ml-lab/evaluate-dossier")
async def ml_lab_evaluate_dossier(
    data: MlCandidateDossierIn, _principal: Use, audit: Audit
) -> dict:
    """Evalua el expediente de competencias de un candidato con Random Forest,
    K-Means, PCA y el motor de 6 reglas de empleabilidad."""
    comp_list = (
        [c.model_dump() for c in data.competencias]
        if data.competencias is not None
        else None
    )
    result = evaluate_candidate_dossier(
        id_candidato=data.id_candidato,
        nombre_completo=data.nombre_completo,
        rol_objetivo=data.rol_objetivo,
        seniority=data.seniority,
        modalidad=data.modalidad,
        horas_practica=data.horas_practica,
        evidencias_entregadas=data.evidencias_entregadas,
        participacion_pct=data.participacion_pct,
        competencias_tabla=comp_list,
    )
    audit.record(
        module="aura",
        action="ml_lab.evaluate_dossier",
        result="success",
        actor_user_id=_principal.id,
        entity_type="ml_dossier",
        changes={
            "id_candidato": data.id_candidato,
            "rol_objetivo": data.rol_objetivo,
            "horas_practica": data.horas_practica,
        },
    )
    return result


