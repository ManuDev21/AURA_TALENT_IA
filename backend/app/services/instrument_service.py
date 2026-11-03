"""Administracion de instrumentos: versiones inmutables, publicacion, retiro, clonacion e importacion."""

import hashlib
import json
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.core.principal import Principal
from app.models import (
    Assessment,
    AssessmentAttempt,
    AssessmentOption,
    AssessmentQuestion,
    AssessmentType,
    AssessmentVersion,
    InterpretationRule,
    PsychometricDimension,
    PsychometricScale,
    ScoringRule,
)
from app.schemas.assessments import ImportVersion, InstrumentImport, InstrumentSummary, VersionBrief
from app.services.audit_service import AuditService

LIKERT5 = {
    "1": "Totalmente en desacuerdo",
    "2": "En desacuerdo",
    "3": "Neutral",
    "4": "De acuerdo",
    "5": "Totalmente de acuerdo",
}


def _definition(version: AssessmentVersion) -> dict[str, Any]:
    dims = {d.id: d.code for d in version.dimensions}
    return {
        "time_limit_seconds": version.time_limit_seconds,
        "instructions": version.instructions,
        "consent_text": version.consent_text,
        "limitations_text": version.limitations_text,
        "disclaimer_text": version.disclaimer_text,
        "randomize_questions": version.randomize_questions,
        "dimensions": [
            {
                "code": d.code,
                "name": d.name,
                "description": d.description,
                "construct_definition": d.construct_definition,
            }
            for d in version.dimensions
        ],
        "questions": [
            {
                "dimension_code": dims.get(q.dimension_id) if q.dimension_id else None,
                "question_type": q.question_type,
                "stem": q.stem,
                "reverse_keyed": q.reverse_keyed,
                "weight": str(q.weight),
                "is_attention_check": q.is_attention_check,
                "expected_value": str(q.expected_value) if q.expected_value is not None else None,
                "explanation": q.explanation,
                "options": [
                    {
                        "label": o.label,
                        "is_correct": o.is_correct,
                        "rubric_score": str(o.rubric_score) if o.rubric_score is not None else None,
                        "rubric_rationale": o.rubric_rationale,
                    }
                    for o in q.options
                ],
            }
            for q in version.questions
        ],
        "scoring": [
            {
                "dimension_code": dims.get(r.dimension_id) if r.dimension_id else None,
                "method": r.method,
                "params": r.params,
            }
            for r in version.scoring_rules
        ],
        "interpretation": [
            {
                "dimension_code": dims.get(b.dimension_id) if b.dimension_id else None,
                "min_score": str(b.min_score),
                "max_score": str(b.max_score),
                "band": b.band,
                "text_template": b.text_template,
                "recommendations": b.recommendations,
            }
            for b in version.interpretation_rules
        ],
    }


class InstrumentService:
    def __init__(self, session: AsyncSession, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    async def list_instruments(self) -> list[InstrumentSummary]:
        instruments = (
            (
                await self.session.scalars(
                    select(Assessment).where(Assessment.deleted_at.is_(None)).order_by(Assessment.title)
                )
            )
            .unique()
            .all()
        )
        out = []
        for inst in instruments:
            versions = (
                (
                    await self.session.scalars(
                        select(AssessmentVersion)
                        .where(AssessmentVersion.assessment_id == inst.id)
                        .order_by(AssessmentVersion.version_no.desc())
                    )
                )
                .unique()
                .all()
            )
            counts = dict(
                (
                    await self.session.execute(
                        select(AssessmentAttempt.version_id, func.count())
                        .where(AssessmentAttempt.version_id.in_([v.id for v in versions]))
                        .group_by(AssessmentAttempt.version_id)
                    )
                ).all()
            )
            out.append(
                InstrumentSummary(
                    id=inst.id,
                    code=inst.code,
                    title=inst.title,
                    type_code=inst.type.code,
                    is_experimental=inst.is_experimental,
                    license_type=inst.license_type,
                    versions=[
                        VersionBrief(
                            id=v.id,
                            version_no=v.version_no,
                            status=v.status,
                            published_at=v.published_at,
                            question_count=len(v.questions),
                            attempts=counts.get(v.id, 0),
                        )
                        for v in versions
                    ],
                )
            )
        return out

    async def version_detail(self, version_id: uuid.UUID) -> dict[str, Any]:
        version = await self._version(version_id)
        return {
            "id": str(version.id),
            "version_no": version.version_no,
            "status": version.status,
            "instrument": {"code": version.assessment.code, "title": version.assessment.title},
            "checksum": version.checksum,
            "definition": _definition(version),
        }

    async def publish(self, version_id: uuid.UUID) -> dict[str, Any]:
        version = await self._version(version_id)
        if version.status != "draft":
            raise ValidationFailedError("Solo se publican versiones en borrador.", code="not_draft")
        if not version.questions or not version.scoring_rules:
            raise ValidationFailedError("La version necesita preguntas y reglas de puntuacion.")
        definition = _definition(version)
        version.checksum = hashlib.sha256(
            json.dumps(definition, sort_keys=True, default=str).encode()
        ).hexdigest()
        # Se retiran versiones publicadas anteriores: los intentos previos conservan su version
        for previous in (
            await self.session.scalars(
                select(AssessmentVersion).where(
                    AssessmentVersion.assessment_id == version.assessment_id,
                    AssessmentVersion.status == "published",
                )
            )
        ).unique():
            previous.status = "retired"
        await self.session.flush()
        version.status = "published"
        version.assessment.status = "published"
        self._audit("psychometrics.version_publish", version.id)
        await self.session.commit()
        return await self.version_detail(version.id)

    async def retire(self, version_id: uuid.UUID) -> dict[str, Any]:
        version = await self._version(version_id)
        if version.status != "published":
            raise ValidationFailedError("Solo se retiran versiones publicadas.")
        version.status = "retired"
        self._audit("psychometrics.version_retire", version.id)
        await self.session.commit()
        return await self.version_detail(version.id)

    async def clone(self, version_id: uuid.UUID) -> dict[str, Any]:
        """Nueva version en borrador con el mismo contenido (asi se modifica un instrumento publicado)."""
        source = await self._version(version_id)
        draft = await self.session.scalar(
            select(AssessmentVersion.id).where(
                AssessmentVersion.assessment_id == source.assessment_id, AssessmentVersion.status == "draft"
            )
        )
        if draft:
            raise ConflictError("Ya existe una version en borrador de este instrumento.", code="draft_exists")
        definition = ImportVersion.model_validate(_definition(source))
        version = await self._build_version(source.assessment, definition)
        self._audit("psychometrics.version_clone", version.id)
        await self.session.commit()
        return await self.version_detail(version.id)

    async def import_instrument(self, data: InstrumentImport) -> dict[str, Any]:
        if await self.session.scalar(select(Assessment.id).where(Assessment.code == data.code)):
            raise ConflictError("Ya existe un instrumento con ese codigo.", code="code_taken")
        type_ = await self.session.scalar(select(AssessmentType).where(AssessmentType.code == data.type_code))
        if type_ is None:
            raise ValidationFailedError("Tipo de evaluacion desconocido.")
        assessment = Assessment(
            type_id=type_.id,
            code=data.code,
            title=data.title,
            description=data.description,
            is_experimental=data.is_experimental,
            license_type=data.license_type,
            license_ref=data.license_ref,
            status="draft",
            created_by=self.principal.id,
        )
        self.session.add(assessment)
        await self.session.flush()
        await self.session.refresh(assessment, ["type"])
        version = await self._build_version(assessment, data.version)
        self._audit("psychometrics.instrument_import", version.id)
        await self.session.commit()
        return await self.version_detail(version.id)

    async def _build_version(self, assessment: Assessment, data: Any) -> AssessmentVersion:
        last = await self.session.scalar(
            select(func.coalesce(func.max(AssessmentVersion.version_no), 0)).where(
                AssessmentVersion.assessment_id == assessment.id
            )
        )
        version = AssessmentVersion(
            assessment_id=assessment.id,
            version_no=int(last or 0) + 1,
            status="draft",
            time_limit_seconds=data.time_limit_seconds,
            instructions=data.instructions,
            consent_text=data.consent_text,
            limitations_text=data.limitations_text,
            disclaimer_text=data.disclaimer_text,
            randomize_questions=data.randomize_questions,
            created_by=self.principal.id,
        )
        self.session.add(version)
        await self.session.flush()
        dims: dict[str, PsychometricDimension] = {}
        for i, d in enumerate(data.dimensions):
            dims[d.code] = PsychometricDimension(
                version_id=version.id,
                code=d.code,
                name=d.name,
                description=d.description,
                construct_definition=d.construct_definition,
                display_order=i,
            )
            self.session.add(dims[d.code])
        scale = None
        if any(q.question_type == "likert" for q in data.questions):
            scale = PsychometricScale(
                version_id=version.id,
                code="LIKERT5",
                scale_type="likert5",
                min_value=1,
                max_value=5,
                labels=LIKERT5,
            )
            self.session.add(scale)
        await self.session.flush()
        for i, q in enumerate(data.questions):
            question = AssessmentQuestion(
                version_id=version.id,
                dimension_id=dims[q.dimension_code].id if q.dimension_code else None,
                scale_id=scale.id if scale and q.question_type == "likert" else None,
                question_type=q.question_type,
                stem=q.stem,
                reverse_keyed=q.reverse_keyed,
                weight=q.weight,
                is_attention_check=q.is_attention_check,
                expected_value=q.expected_value,
                explanation=q.explanation,
                display_order=i + 1,
            )
            question.options = [
                AssessmentOption(
                    label=o.label,
                    is_correct=o.is_correct,
                    rubric_score=o.rubric_score,
                    rubric_rationale=o.rubric_rationale,
                    display_order=k + 1,
                )
                for k, o in enumerate(q.options)
            ]
            self.session.add(question)
        for r in data.scoring:
            self.session.add(
                ScoringRule(
                    version_id=version.id,
                    dimension_id=dims[r.dimension_code].id if r.dimension_code else None,
                    method=r.method,
                    params=r.params,
                )
            )
        for b in data.interpretation:
            self.session.add(
                InterpretationRule(
                    version_id=version.id,
                    dimension_id=dims[b.dimension_code].id if b.dimension_code else None,
                    min_score=b.min_score,
                    max_score=b.max_score,
                    band=b.band,
                    text_template=b.text_template,
                    recommendations=b.recommendations,
                )
            )
        await self.session.flush()
        return version

    async def _version(self, version_id: uuid.UUID) -> AssessmentVersion:
        version = await self.session.get(AssessmentVersion, version_id, populate_existing=True)
        if version is None:
            raise NotFoundError("Version no encontrada.")
        return version

    def _audit(self, action: str, version_id: uuid.UUID) -> None:
        self.audit.record(
            module="psychometrics",
            action=action,
            result="success",
            actor_user_id=self.principal.id,
            entity_type="assessment_version",
            entity_id=version_id,
        )
