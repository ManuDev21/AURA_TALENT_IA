import uuid
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.core.principal import Principal
from app.core.security import utcnow
from app.database.base import Base
from app.models import (
    CandidateLanguage,
    CandidateProfile,
    CandidateSkill,
    Certification,
    Education,
    Experience,
    ProfileLink,
    Project,
)
from app.repositories.candidate_repository import (
    ORDERING,
    CandidateProfileRepository,
    CandidateSkillRepository,
    OwnedItemRepository,
)
from app.repositories.skill_repository import SkillRepository
from app.schemas.candidate import (
    CandidateOverview,
    CertificationRead,
    EducationRead,
    ExperienceRead,
    LanguageRead,
    LinkRead,
    ProfileRead,
    ProfileUpdate,
)
from app.schemas.skills import CandidateSkillRead, CandidateSkillUpsert, IndicatorsRead
from app.services.audit_service import AuditService
from app.services.talent_indicators import compute_indicators


@dataclass(frozen=True)
class ItemKind:
    model: type[Base]
    read: type[BaseModel]
    label: str


ITEM_KINDS: dict[str, ItemKind] = {
    "education": ItemKind(Education, EducationRead, "educacion"),
    "experiences": ItemKind(Experience, ExperienceRead, "experiencia"),
    "certifications": ItemKind(Certification, CertificationRead, "certificacion"),
    "languages": ItemKind(CandidateLanguage, LanguageRead, "idioma"),
    "links": ItemKind(ProfileLink, LinkRead, "enlace"),
}

# Pesos de completitud del perfil (suman 100)
_COMPLETENESS = {
    "headline": 10,
    "summary": 15,
    "location": 5,
    "preferences": 5,
    "desired_roles": 10,
    "experiences": 15,
    "education": 10,
    "skills": 15,
    "languages": 5,
    "links": 5,
    "projects": 5,
}


class CandidateService:
    def __init__(self, session: AsyncSession, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit
        self.profiles = CandidateProfileRepository(session)

    # ------------------------------------------------------------- perfil
    async def get_profile(self) -> CandidateProfile:
        profile = await self.profiles.get_by_user(self.principal.id)
        if profile is None:
            if "ROLE_CANDIDATE" not in self.principal.role_codes:
                raise ForbiddenError("Esta cuenta no tiene perfil de candidato.", code="not_a_candidate")
            profile = self.profiles.add(CandidateProfile(user_id=self.principal.id))
            await self.session.flush()
        return profile

    def _items(self, model: type[Base], profile: CandidateProfile) -> OwnedItemRepository:
        return OwnedItemRepository(self.session, model, profile.id)

    async def overview(self) -> CandidateOverview:
        profile = await self.get_profile()

        async def listed(kind: str) -> list[Any]:
            model = ITEM_KINDS[kind].model
            rows = await self._items(model, profile).list(*ORDERING[model])
            return [ITEM_KINDS[kind].read.model_validate(r) for r in rows]

        skills = await CandidateSkillRepository(self.session, profile.id).list()
        return CandidateOverview(
            full_name=self.principal.user.full_name,
            email=self.principal.user.email,
            profile=ProfileRead.model_validate(profile),
            education=await listed("education"),
            experiences=await listed("experiences"),
            certifications=await listed("certifications"),
            languages=await listed("languages"),
            links=await listed("links"),
            skills=[CandidateSkillRead.model_validate(s) for s in skills],
            projects_count=await self._items(Project, profile).count(),
        )

    async def update_profile(self, data: ProfileUpdate) -> CandidateProfile:
        profile = await self.get_profile()
        changes = data.model_dump(exclude_unset=True)
        for field, value in changes.items():
            if value is None and field in {"desired_roles", "interests"}:
                value = []
            setattr(profile, field, value)
        await self._finish(
            profile, "candidates.profile_update", "candidate_profile", profile.id, sorted(changes)
        )
        return profile

    # ------------------------------------------------- entidades del perfil
    async def create_item(self, kind: str, data: BaseModel) -> Any:
        profile = await self.get_profile()
        spec = ITEM_KINDS[kind]
        item = spec.model(candidate_id=profile.id, **data.model_dump())
        self.session.add(item)
        await self._finish(profile, f"candidates.{kind}.create", kind, None, [], item=item)
        return item

    async def update_item(self, kind: str, item_id: uuid.UUID, data: BaseModel) -> Any:
        profile = await self.get_profile()
        item = await self._get_owned(kind, profile, item_id)
        for field, value in data.model_dump().items():
            setattr(item, field, value)
        await self._finish(profile, f"candidates.{kind}.update", kind, item_id, [], item=item)
        return item

    async def delete_item(self, kind: str, item_id: uuid.UUID) -> None:
        profile = await self.get_profile()
        item = await self._get_owned(kind, profile, item_id)
        if hasattr(item, "deleted_at"):
            item.deleted_at = utcnow()
        else:
            await self.session.delete(item)
        await self._finish(profile, f"candidates.{kind}.delete", kind, item_id, [])

    async def _get_owned(self, kind: str, profile: CandidateProfile, item_id: uuid.UUID) -> Any:
        spec = ITEM_KINDS[kind]
        item = await self._items(spec.model, profile).get(item_id)
        if item is None:
            raise NotFoundError(f"No se encontro el registro de {spec.label}.")
        return item

    # ------------------------------------------------------------- skills
    async def upsert_skill(self, skill_id: uuid.UUID, data: CandidateSkillUpsert) -> CandidateSkill:
        profile = await self.get_profile()
        if await SkillRepository(self.session).get(skill_id) is None:
            raise NotFoundError("La habilidad no existe en el catalogo.")
        repo = CandidateSkillRepository(self.session, profile.id)
        entry = await repo.get(skill_id)
        if entry is None:
            entry = CandidateSkill(candidate_id=profile.id, skill_id=skill_id, source="manual")
            self.session.add(entry)
        entry.proficiency = data.proficiency
        entry.years_experience = data.years_experience
        entry.last_used_year = data.last_used_year
        await self._finish(profile, "candidates.skills.upsert", "skill", skill_id, [])
        refreshed = await repo.get(skill_id)
        assert refreshed is not None
        await self.session.refresh(refreshed, ["skill"])
        return refreshed

    async def delete_skill(self, skill_id: uuid.UUID) -> None:
        profile = await self.get_profile()
        entry = await CandidateSkillRepository(self.session, profile.id).get(skill_id)
        if entry is None:
            raise NotFoundError("La habilidad no esta en tu perfil.")
        await self.session.delete(entry)
        await self._finish(profile, "candidates.skills.delete", "skill", skill_id, [])

    async def indicators(self) -> IndicatorsRead:
        profile = await self.get_profile()
        return compute_indicators(await CandidateSkillRepository(self.session, profile.id).list())

    # ------------------------------------------------------------ helpers
    async def recompute_completeness(self, profile: CandidateProfile) -> int:
        checks = await self.completeness_checks(profile)
        profile.completeness = sum(_COMPLETENESS[k] for k, ok in checks.items() if ok)
        return profile.completeness

    async def completeness_checks(self, profile: CandidateProfile) -> dict[str, bool]:
        counts = {
            kind: await self._items(model, profile).count()
            for kind, model in (
                ("experiences", Experience),
                ("education", Education),
                ("languages", CandidateLanguage),
                ("links", ProfileLink),
                ("projects", Project),
            )
        }
        skills = len(await CandidateSkillRepository(self.session, profile.id).list())
        return {
            "headline": bool(profile.headline),
            "summary": bool(profile.summary and len(profile.summary) >= 80),
            "location": bool(profile.location_city or profile.location_country),
            "preferences": bool(profile.availability and profile.work_modality),
            "desired_roles": bool(profile.desired_roles),
            "experiences": counts["experiences"] > 0,
            "education": counts["education"] > 0,
            "skills": skills >= 3,
            "languages": counts["languages"] > 0,
            "links": counts["links"] > 0,
            "projects": counts["projects"] > 0,
        }

    async def _finish(
        self,
        profile: CandidateProfile,
        action: str,
        entity_type: str,
        entity_id: uuid.UUID | None,
        fields: list[str],
        item: Any = None,
    ) -> None:
        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ConflictError("Ya existe un registro igual en tu perfil.", code="duplicate") from exc
        await self.recompute_completeness(profile)
        self.audit.record(
            module="candidates",
            action=action,
            result="success",
            actor_user_id=self.principal.id,
            entity_type=entity_type,
            entity_id=entity_id or (item.id if item is not None else None),
            changes={"fields": fields} if fields else None,
        )
        await self.session.commit()
        if item is not None:
            await self.session.refresh(item)
