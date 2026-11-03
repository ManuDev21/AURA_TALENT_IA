import uuid

from fastapi import APIRouter, status

from app.core.deps import Audit, Authorized, DbSession
from app.schemas.portfolio import (
    PortfolioMe,
    PortfolioSettings,
    PortfolioUpdate,
    ProjectIn,
    ProjectRead,
    PublicPortfolio,
)
from app.services.portfolio_service import PortfolioService, public_portfolio

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

Reader = Authorized("profile:read_own")
Writer = Authorized("portfolio:write_own")


@router.get("/me", response_model=PortfolioMe)
async def my_portfolio(db: DbSession, principal: Reader, audit: Audit) -> PortfolioMe:
    return await PortfolioService(db, principal, audit).me()


@router.patch("/me", response_model=PortfolioSettings)
async def update_settings(
    data: PortfolioUpdate, db: DbSession, principal: Writer, audit: Audit
) -> PortfolioSettings:
    return await PortfolioService(db, principal, audit).update_settings(data)


@router.post("/me/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectIn, db: DbSession, principal: Writer, audit: Audit) -> ProjectRead:
    return await PortfolioService(db, principal, audit).create_project(data)


@router.put("/me/projects/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID, data: ProjectIn, db: DbSession, principal: Writer, audit: Audit
) -> ProjectRead:
    return await PortfolioService(db, principal, audit).update_project(project_id, data)


@router.delete("/me/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: uuid.UUID, db: DbSession, principal: Writer, audit: Audit) -> None:
    await PortfolioService(db, principal, audit).delete_project(project_id)


@router.get("/public/{slug}", response_model=PublicPortfolio)
async def public_view(slug: str, db: DbSession) -> PublicPortfolio:
    return await public_portfolio(db, slug)
