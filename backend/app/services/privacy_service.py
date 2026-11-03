"""Consentimientos revocables por la propia persona (camara, voz, uso de IA externa, visibilidad).

Cada cambio crea una fila nueva: el historial completo queda como evidencia y el estado vigente es la
ultima fila de cada tipo.
"""

from typing import Literal

from sqlalchemy import select

from app.config import get_settings
from app.core.principal import Principal
from app.core.security import utcnow
from app.models import AiInteraction, Consent
from app.services.application_service import ApplicationService
from app.services.assessment_service import AssessmentService
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService
from app.services.skill_passport_service import SkillPassportService

UserConsentType = Literal["camera", "voice", "external_ai_processing", "discoverable"]
USER_CONSENT_TYPES: tuple[str, ...] = ("camera", "voice", "external_ai_processing", "discoverable")


class PrivacyService:
    def __init__(self, session, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    async def current(self) -> dict[str, dict]:
        rows = (
            await self.session.scalars(
                select(Consent)
                .where(Consent.user_id == self.principal.id, Consent.consent_type.in_(USER_CONSENT_TYPES))
                .order_by(Consent.created_at.desc())
            )
        ).all()
        state: dict[str, dict] = {t: {"granted": False, "updated_at": None} for t in USER_CONSENT_TYPES}
        seen: set[str] = set()
        for row in rows:
            if row.consent_type in seen:
                continue
            seen.add(row.consent_type)
            state[row.consent_type] = {"granted": row.granted, "updated_at": row.created_at}
        return state

    async def export(self) -> dict:
        """Derecho de acceso: todos los datos personales de la cuenta en un archivo legible por maquina."""
        user = self.principal.user
        data: dict = {
            "exported_at": utcnow().isoformat(),
            "account": {
                "email": user.email,
                "full_name": user.full_name,
                "created_at": user.created_at.isoformat(),
            },
            "roles": sorted(self.principal.role_codes),
        }
        consents = (
            await self.session.scalars(
                select(Consent).where(Consent.user_id == user.id).order_by(Consent.created_at)
            )
        ).all()
        if "ROLE_CANDIDATE" in self.principal.role_codes:
            data["skills_passport"] = await SkillPassportService(
                self.session, self.principal, self.audit
            ).export()
        data["consents"] = [
            {
                "type": c.consent_type,
                "granted": c.granted,
                "policy_version": c.policy_version,
                "at": c.created_at.isoformat(),
            }
            for c in consents
        ]
        interactions = (
            await self.session.scalars(
                select(AiInteraction)
                .where(AiInteraction.user_id == user.id)
                .order_by(AiInteraction.created_at)
            )
        ).all()
        data["aura_interactions"] = [
            {
                "at": i.created_at.isoformat(),
                "channel": i.channel,
                "text": i.input_text,
                "intent": i.detected_intent,
                "outcome": i.outcome,
            }
            for i in interactions
        ]
        if "ROLE_CANDIDATE" in self.principal.role_codes:
            data["profile"] = (
                await CandidateService(self.session, self.principal, self.audit).overview()
            ).model_dump(mode="json")
            data["applications"] = [
                a.model_dump(mode="json")
                for a in await ApplicationService(self.session, self.principal, self.audit).my_applications()
            ]
            data["assessments"] = [
                a.model_dump(mode="json")
                for a in await AssessmentService(self.session, self.principal, self.audit).history()
            ]
        self.audit.record(module="privacy", action="data_export", result="success", actor_user_id=user.id)
        await self.session.commit()
        return data

    async def set(self, consent_type: UserConsentType, granted: bool) -> dict[str, dict]:
        now = utcnow()
        client = self.audit.client
        self.session.add(
            Consent(
                user_id=self.principal.id,
                consent_type=consent_type,
                policy_version=get_settings().policy_version,
                granted=granted,
                granted_at=now if granted else None,
                revoked_at=None if granted else now,
                ip=client.ip if client else None,
                user_agent=client.user_agent if client else None,
            )
        )
        self.audit.record(
            module="privacy",
            action=f"consent_{'granted' if granted else 'revoked'}:{consent_type}",
            result="success",
            actor_user_id=self.principal.id,
        )
        await self.session.commit()
        return await self.current()
