import uuid

import anyio
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.core.principal import Principal
from app.core.security import utcnow
from app.database.session import SessionLocal
from app.models import (
    CandidateLanguage,
    CandidateSkill,
    Certification,
    CvDocument,
    Education,
    Experience,
    ProfileLink,
    Skill,
    SkillAlias,
)
from app.nlp.cv_parser import CvParser, build_skill_terms
from app.nlp.text_extraction import extract_text
from app.repositories.candidate_repository import CandidateSkillRepository, OwnedItemRepository
from app.schemas.cv import ConfirmResult, CvConfirm, DocumentRead
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService
from app.services.storage import DOCX_MIME, LocalStorage, detect_document_type, sha256_hex

log = structlog.get_logger(__name__)


class CvDocumentService:
    def __init__(self, session: AsyncSession, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit
        self.candidates = CandidateService(session, principal, audit)
        self.storage = LocalStorage()

    async def upload(self, filename: str, data: bytes) -> CvDocument:
        profile = await self.candidates.get_profile()
        mime = detect_document_type(data)
        key = self.storage.save(f"cv/{profile.id}", data, "docx" if mime == DOCX_MIME else "pdf")
        document = CvDocument(
            candidate_id=profile.id,
            original_filename=(filename or "cv")[:255],
            storage_key=key,
            mime_type=mime,
            size_bytes=len(data),
            sha256=sha256_hex(data),
            parse_status="pending",
        )
        self.session.add(document)
        await self.session.flush()
        self._audit("cv.document_upload", document.id, {"mime": mime, "size": len(data)})
        await self.session.commit()
        return document

    async def list_documents(self) -> list[CvDocument]:
        profile = await self.candidates.get_profile()
        repo = OwnedItemRepository(self.session, CvDocument, profile.id)
        return (await repo.list(CvDocument.created_at.desc()))[:10]

    async def get(self, document_id: uuid.UUID) -> CvDocument:
        profile = await self.candidates.get_profile()
        document = await OwnedItemRepository(self.session, CvDocument, profile.id).get(document_id)
        if document is None:
            raise NotFoundError("Documento no encontrado.")
        return document

    async def delete(self, document_id: uuid.UUID) -> None:
        document = await self.get(document_id)
        self.storage.delete(document.storage_key)
        document.deleted_at = utcnow()
        document.parsed_data = None
        self._audit("cv.document_delete", document.id, None)
        await self.session.commit()

    async def confirm(self, document_id: uuid.UUID, data: CvConfirm) -> ConfirmResult:
        document = await self.get(document_id)
        if document.parse_status != "done":
            raise ValidationFailedError("El documento aun no termina de analizarse.")
        if document.confirmed_at is not None:
            raise ConflictError("Estos datos ya se guardaron en tu perfil.", code="already_confirmed")

        profile = await self.candidates.get_profile()
        created = dict.fromkeys(
            ("experiences", "education", "certifications", "languages", "links", "skills"), 0
        )
        skipped = dict.fromkeys(("languages", "links", "skills"), 0)

        if data.headline:
            profile.headline = data.headline
        if data.summary:
            profile.summary = data.summary
        for item in data.experiences:
            self.session.add(Experience(candidate_id=profile.id, source="cv_parsed", **item.model_dump()))
            created["experiences"] += 1
        for item in data.education:
            self.session.add(Education(candidate_id=profile.id, source="cv_parsed", **item.model_dump()))
            created["education"] += 1
        for item in data.certifications:
            self.session.add(Certification(candidate_id=profile.id, source="cv_parsed", **item.model_dump()))
            created["certifications"] += 1

        existing_langs = {
            lang.language_code
            for lang in await OwnedItemRepository(self.session, CandidateLanguage, profile.id).list()
        }
        for item in data.languages:
            if item.language_code in existing_langs:
                skipped["languages"] += 1
                continue
            existing_langs.add(item.language_code)
            self.session.add(CandidateLanguage(candidate_id=profile.id, **item.model_dump()))
            created["languages"] += 1

        existing_urls = {
            link.url.lower()
            for link in await OwnedItemRepository(self.session, ProfileLink, profile.id).list()
        }
        for item in data.links:
            if item.url and item.url.lower() in existing_urls:
                skipped["links"] += 1
                continue
            existing_urls.add((item.url or "").lower())
            self.session.add(ProfileLink(candidate_id=profile.id, **item.model_dump()))
            created["links"] += 1

        existing_skills = {
            cs.skill_id for cs in await CandidateSkillRepository(self.session, profile.id).list()
        }
        valid_ids = set(
            (
                await self.session.scalars(
                    select(Skill.id).where(Skill.id.in_([s.skill_id for s in data.skills]))
                )
            ).all()
        )
        for item in data.skills:
            if item.skill_id in existing_skills or item.skill_id not in valid_ids:
                skipped["skills"] += 1
                continue
            existing_skills.add(item.skill_id)
            self.session.add(
                CandidateSkill(
                    candidate_id=profile.id,
                    skill_id=item.skill_id,
                    proficiency=item.proficiency,
                    source="cv_parsed",
                )
            )
            created["skills"] += 1

        document.confirmed_at = utcnow()
        await self.session.flush()
        await self.candidates.recompute_completeness(profile)
        self._audit("cv.document_confirm", document.id, {"created": created, "skipped": skipped})
        await self.session.commit()
        return ConfirmResult(created=created, skipped=skipped)

    def _audit(self, action: str, entity_id: uuid.UUID, changes: dict | None) -> None:
        self.audit.record(
            module="cv",
            action=action,
            result="success",
            actor_user_id=self.principal.id,
            entity_type="cv_document",
            entity_id=entity_id,
            changes=changes,
        )


async def _skill_catalog(session: AsyncSession) -> list[dict]:
    skills = (await session.scalars(select(Skill).where(Skill.is_active.is_(True)))).all()
    aliases: dict[uuid.UUID, list[str]] = {}
    for alias in (await session.scalars(select(SkillAlias))).all():
        aliases.setdefault(alias.skill_id, []).append(alias.alias)
    return [
        {
            "id": s.id,
            "name": s.name,
            "category": s.category.name if s.category else None,
            "aliases": aliases.get(s.id, []),
        }
        for s in skills
    ]


async def process_document(document_id: uuid.UUID) -> None:
    """Analiza el documento fuera del ciclo de la peticion (tarea en segundo plano)."""
    async with SessionLocal() as session:
        document = await session.get(CvDocument, document_id)
        if document is None:
            return
        document.parse_status = "processing"
        await session.commit()
        try:
            data = LocalStorage().read(document.storage_key)
            text, pages = await anyio.to_thread.run_sync(extract_text, data, document.mime_type)
            parser = CvParser(build_skill_terms(await _skill_catalog(session)))
            document.parsed_data = await anyio.to_thread.run_sync(parser.parse, text, pages)
            document.parse_status = "done"
            document.parse_error = None
        except Exception:
            log.exception("cv_parse_failed", document_id=str(document_id))
            document.parse_status = "failed"
            document.parse_error = (
                "No fue posible leer el documento. Verifica que no este protegido o danado."
            )
        await session.commit()


def to_read(document: CvDocument) -> DocumentRead:
    return DocumentRead.model_validate(document)
