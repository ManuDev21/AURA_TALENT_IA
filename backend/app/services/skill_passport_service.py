"""Pasaporte portable de habilidades y evidencias aportadas por la persona.

El sistema nunca cambia una evidencia a verificada por recibir una URL o un archivo Open Badge.
La persona candidata controla si cada evidencia se comparte con las empresas a las que se postula.
"""

import uuid
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationFailedError
from app.core.principal import Principal
from app.models import CandidateSkill, SkillEvidence
from app.repositories.candidate_repository import CandidateSkillRepository
from app.schemas.skills import OpenBadgeImportIn, SkillEvidenceIn, SkillEvidenceRead
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService


class SkillPassportService:
    def __init__(self, session: AsyncSession, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    async def _candidate_id(self) -> uuid.UUID:
        return (await CandidateService(self.session, self.principal, self.audit).get_profile()).id

    async def list_evidence(self) -> list[SkillEvidenceRead]:
        candidate_id = await self._candidate_id()
        rows = (
            await self.session.scalars(
                select(SkillEvidence)
                .where(SkillEvidence.candidate_id == candidate_id, SkillEvidence.deleted_at.is_(None))
                .order_by(SkillEvidence.created_at.desc())
            )
        ).all()
        return [SkillEvidenceRead.model_validate(row) for row in rows]

    async def add(self, data: SkillEvidenceIn, source: str = "candidate_submitted") -> SkillEvidenceRead:
        candidate_id = await self._candidate_id()
        owned = await self.session.get(CandidateSkill, (candidate_id, data.skill_id))
        if owned is None:
            raise ValidationFailedError("Agrega primero esta habilidad a tu perfil para adjuntar evidencia.")
        evidence = SkillEvidence(
            candidate_id=candidate_id,
            skill_id=data.skill_id,
            evidence_type=data.evidence_type,
            title=data.title.strip(),
            description=data.description,
            evidence_url=data.evidence_url,
            issuer=data.issuer,
            credential_ref=data.credential_ref,
            source=source,
            share_with_companies=data.share_with_companies,
        )
        self.session.add(evidence)
        await self.session.flush()
        self.audit.record(
            module="skills_passport",
            action="evidence_added",
            result="success",
            actor_user_id=self.principal.id,
            entity_type="skill_evidence",
            entity_id=evidence.id,
            changes={"skill_id": str(data.skill_id), "source": source},
        )
        await self.session.commit()
        await self.session.refresh(evidence, ["skill"])
        return SkillEvidenceRead.model_validate(evidence)

    async def import_open_badge(self, data: OpenBadgeImportIn) -> SkillEvidenceRead:
        payload = SkillEvidenceIn(
            skill_id=data.skill_id,
            evidence_type="credential",
            title=data.credential_title,
            description=data.description,
            evidence_url=data.evidence_url or data.credential_url,
            issuer=data.issuer,
            credential_ref=data.credential_ref,
            share_with_companies=data.share_with_companies,
        )
        return await self.add(payload, source="open_badge_import")

    async def set_sharing(self, evidence_id: uuid.UUID, share: bool) -> SkillEvidenceRead:
        evidence = await self._owned_evidence(evidence_id)
        evidence.share_with_companies = share
        self.audit.record(
            module="skills_passport",
            action="evidence_sharing_changed",
            result="success",
            actor_user_id=self.principal.id,
            entity_type="skill_evidence",
            entity_id=evidence.id,
            changes={"share_with_companies": share},
        )
        await self.session.commit()
        await self.session.refresh(evidence, ["skill"])
        return SkillEvidenceRead.model_validate(evidence)

    async def remove(self, evidence_id: uuid.UUID) -> None:
        evidence = await self._owned_evidence(evidence_id)
        from app.core.security import utcnow

        evidence.deleted_at = utcnow()
        self.audit.record(
            module="skills_passport",
            action="evidence_deleted",
            result="success",
            actor_user_id=self.principal.id,
            entity_type="skill_evidence",
            entity_id=evidence.id,
        )
        await self.session.commit()

    async def export(self) -> dict:
        candidate_id = await self._candidate_id()
        skills = await CandidateSkillRepository(self.session, candidate_id).list()
        evidence_rows = (
            await self.session.scalars(
                select(SkillEvidence)
                .where(SkillEvidence.candidate_id == candidate_id, SkillEvidence.deleted_at.is_(None))
                .order_by(SkillEvidence.created_at)
            )
        ).all()
        by_skill: dict[uuid.UUID, list[SkillEvidence]] = defaultdict(list)
        for item in evidence_rows:
            by_skill[item.skill_id].append(item)
        return {
            "schema": "aura.skills-passport.v1",
            "exported_at": datetime.now(UTC).isoformat(),
            "credential_compatibility": (
                "Portable AURA JSON summary; it is not a cryptographically signed Open Badge."
            ),
            "notice": (
                "Las habilidades y evidencias fueron aportadas por la persona. AURA no valida firmas, "
                "emisores ni autenticidad de credenciales importadas."
            ),
            "skills": [
                {
                    "id": str(entry.skill_id),
                    "name": entry.skill.name,
                    "slug": entry.skill.slug,
                    "proficiency_self_reported": entry.proficiency,
                    "years_experience_self_reported": float(entry.years_experience)
                    if entry.years_experience is not None
                    else None,
                    "last_used_year_self_reported": entry.last_used_year,
                    "evidence": [
                        {
                            "type": evidence.evidence_type,
                            "title": evidence.title,
                            "description": evidence.description,
                            "url": evidence.evidence_url,
                            "issuer_claimed": evidence.issuer,
                            "credential_reference": evidence.credential_ref,
                            "source": evidence.source,
                            "shared_with_companies": evidence.share_with_companies,
                            "verification": "not_independently_verified",
                        }
                        for evidence in by_skill[entry.skill_id]
                    ],
                }
                for entry in skills
            ],
        }

    async def shared_for_candidate(self, candidate_id: uuid.UUID) -> list[SkillEvidenceRead]:
        rows = (
            await self.session.scalars(
                select(SkillEvidence)
                .where(
                    SkillEvidence.candidate_id == candidate_id,
                    SkillEvidence.share_with_companies.is_(True),
                    SkillEvidence.deleted_at.is_(None),
                )
                .order_by(SkillEvidence.created_at.desc())
            )
        ).all()
        return [SkillEvidenceRead.model_validate(row) for row in rows]

    async def _owned_evidence(self, evidence_id: uuid.UUID) -> SkillEvidence:
        candidate_id = await self._candidate_id()
        evidence = await self.session.get(SkillEvidence, evidence_id)
        if evidence is None or evidence.deleted_at is not None or evidence.candidate_id != candidate_id:
            raise NotFoundError("Evidencia no encontrada.")
        return evidence
