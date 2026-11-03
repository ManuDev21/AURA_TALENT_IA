from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.deps import Audit, CurrentPrincipal, DbSession
from app.services.privacy_service import PrivacyService, UserConsentType

router = APIRouter(prefix="/privacy", tags=["privacy"])


class ConsentState(BaseModel):
    granted: bool
    updated_at: datetime | None


class ConsentIn(BaseModel):
    consent_type: UserConsentType
    granted: bool


@router.get("/consents/me", response_model=dict[str, ConsentState])
async def my_consents(db: DbSession, principal: CurrentPrincipal, audit: Audit) -> dict[str, dict]:
    return await PrivacyService(db, principal, audit).current()


@router.get("/export")
async def export_my_data(db: DbSession, principal: CurrentPrincipal, audit: Audit) -> JSONResponse:
    data = await PrivacyService(db, principal, audit).export()
    return JSONResponse(
        data,
        headers={
            "Content-Disposition": 'attachment; filename="mis-datos-aura.json"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/consents/me", response_model=dict[str, ConsentState])
async def set_consent(
    data: ConsentIn, db: DbSession, principal: CurrentPrincipal, audit: Audit
) -> dict[str, dict]:
    return await PrivacyService(db, principal, audit).set(data.consent_type, data.granted)
