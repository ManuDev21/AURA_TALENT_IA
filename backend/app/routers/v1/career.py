import uuid

from fastapi import APIRouter, status

from app.core.deps import Audit, Authorized, CurrentPrincipal, DbSession
from app.schemas.career import (
    CareerRolesRead,
    FeedbackIn,
    NodeStatusUpdate,
    PathCreate,
    PathRead,
    PathSummary,
    RecommendationSet,
    ResourceRead,
)
from app.schemas.career_search import AlgorithmName, CareerSearchRead, HeuristicName, SearchMode
from app.services.career_service import CareerService
from app.services.recommendation_service import RecommendationService

router = APIRouter(tags=["career"])

CareerWrite = Authorized("career:write_own")
RecsRead = Authorized("recommendations:read_own")


@router.get("/career/roles", response_model=CareerRolesRead)
async def roles(db: DbSession, principal: CareerWrite, audit: Audit) -> CareerRolesRead:
    return await CareerService(db, principal, audit).roles()


@router.get("/career/paths", response_model=list[PathSummary])
async def list_paths(db: DbSession, principal: CareerWrite, audit: Audit) -> list[PathSummary]:
    return await CareerService(db, principal, audit).list_paths()


@router.post("/career/paths", response_model=PathRead, status_code=status.HTTP_201_CREATED)
async def create_path(data: PathCreate, db: DbSession, principal: CareerWrite, audit: Audit) -> PathRead:
    return await CareerService(db, principal, audit).create_path(data)


@router.get("/career/paths/{path_id}", response_model=PathRead)
async def get_path(path_id: uuid.UUID, db: DbSession, principal: CareerWrite, audit: Audit) -> PathRead:
    return await CareerService(db, principal, audit).get_path(path_id)


@router.get("/career/paths/{path_id}/search/{algorithm}", response_model=CareerSearchRead)
async def search_path(
    path_id: uuid.UUID,
    algorithm: AlgorithmName,
    db: DbSession,
    principal: CareerWrite,
    audit: Audit,
    mode: SearchMode = "primera",
    limit: int = 8,
    heuristic: HeuristicName = "manhattan",
) -> CareerSearchRead:
    if not 1 <= limit <= 20:
        from app.core.errors import ValidationFailedError

        raise ValidationFailedError("El limite de profundidad debe estar entre 1 y 20.")
    if mode == "todas" and algorithm != "dfs":
        from app.core.errors import ValidationFailedError

        raise ValidationFailedError("El modo de enumerar todas las rutas solo esta disponible para DFS.")
    return await CareerService(db, principal, audit).search_path(path_id, algorithm, mode, limit, heuristic)


@router.patch("/career/paths/{path_id}/nodes/{node_id}", response_model=PathRead)
async def update_node(
    path_id: uuid.UUID,
    node_id: uuid.UUID,
    data: NodeStatusUpdate,
    db: DbSession,
    principal: CareerWrite,
    audit: Audit,
) -> PathRead:
    return await CareerService(db, principal, audit).update_node(path_id, node_id, data)


@router.delete("/career/paths/{path_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_path(path_id: uuid.UUID, db: DbSession, principal: CareerWrite, audit: Audit) -> None:
    await CareerService(db, principal, audit).delete_path(path_id)


@router.get("/learning/resources", response_model=list[ResourceRead], tags=["learning"])
async def resources(
    db: DbSession, principal: CurrentPrincipal, audit: Audit, skill_id: uuid.UUID | None = None
) -> list[ResourceRead]:
    return await CareerService(db, principal, audit).list_resources(skill_id)


@router.get("/recommendations/me", response_model=RecommendationSet, tags=["recommendations"])
async def my_recommendations(db: DbSession, principal: RecsRead, audit: Audit) -> RecommendationSet:
    service = RecommendationService(db, principal, audit)
    current = await service.current()
    return current if current.items else await service.generate()


@router.post("/recommendations/me/refresh", response_model=RecommendationSet, tags=["recommendations"])
async def refresh(db: DbSession, principal: RecsRead, audit: Audit) -> RecommendationSet:
    return await RecommendationService(db, principal, audit).generate()


@router.post(
    "/recommendations/{rec_id}/feedback", status_code=status.HTTP_204_NO_CONTENT, tags=["recommendations"]
)
async def feedback(
    rec_id: uuid.UUID, data: FeedbackIn, db: DbSession, principal: RecsRead, audit: Audit
) -> None:
    await RecommendationService(db, principal, audit).feedback(rec_id, data)
