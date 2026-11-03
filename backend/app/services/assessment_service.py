"""Assessment Center: flujo START -> EXPLICACION -> CONSENTIMIENTO -> PREGUNTAS -> SCORING -> RESULTADOS.

Privacidad: los resultados psicometricos NUNCA se comparten con empresas sin una accion explicita
de la persona candidata. Las evaluaciones tecnicas o situacionales solicitadas por una empresa se
comparten con esa empresa, y se informa antes de empezar.
"""

import random
import uuid
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.errors import ConflictError, NotFoundError, ValidationFailedError
from app.core.principal import Principal
from app.core.security import utcnow
from app.models import (
    Application,
    Assessment,
    AssessmentAnswer,
    AssessmentAssignment,
    AssessmentAttempt,
    AssessmentQuestion,
    AssessmentResult,
    AssessmentVersion,
    CandidateProfile,
    Company,
    Consent,
    JobPosting,
    ResultDimensionScore,
)
from app.psychometrics import engine
from app.schemas.assessments import (
    AnswerIn,
    AssignableVersion,
    AssignmentCreate,
    AttemptResult,
    AttemptSession,
    AttemptStart,
    AttemptSummary,
    CatalogItem,
    CompanyAssessmentView,
    DimensionResult,
    LastAttempt,
    OptionOut,
    PendingAssignment,
    QuestionOut,
    ResultExplanation,
    SavedAnswer,
    ScaleOut,
    SharedResult,
    VersionIntro,
)
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService
from app.services.notification_service import notify

GRACE_SECONDS = 30
DEFAULT_DISCLAIMER = "Resultado orientativo basado unicamente en las respuestas de esta evaluacion."
PSYCHOMETRIC_DISCLAIMER = (
    "Este resultado representa unicamente las respuestas proporcionadas durante esta evaluacion "
    "y no constituye un diagnostico psicologico."
)
QUALITY_NOTES = {
    "straightlining": (
        "Todas las respuestas tienen el mismo valor; el resultado puede no reflejar tendencias reales."
    ),
    "attention_check_failed": (
        "Una pregunta de control no se respondio como se indicaba; interpreta el resultado con cautela."
    ),
    "too_fast": "Las respuestas fueron muy rapidas; el resultado podria ser menos representativo.",
}
METHODS = {
    "psychometric": (
        "Por cada dimension se promedian tus respuestas en la escala 1-5 (los items redactados en sentido "
        "contrario se invierten) y el promedio se lleva a una escala 0-100. La banda se asigna con rangos "
        "definidos en la version del instrumento."
    ),
    "situational": (
        "Cada opcion tiene un puntaje de rubrica definido de antemano segun buenas practicas. Se suman los "
        "puntos obtenidos y se comparan con el maximo posible."
    ),
}
DEFAULT_METHOD = "Porcentaje de respuestas correctas, ponderado por el peso de cada pregunta."


def _is_psychometric(version: AssessmentVersion) -> bool:
    return version.assessment.type.code in {"psychometric", "orientation"}


def _defs(
    version: AssessmentVersion,
) -> tuple[list[engine.QuestionDef], list[engine.RuleDef], list[engine.BandDef]]:
    scales = {s.id: s for s in version.scales}
    questions = []
    for q in version.questions:
        scale = scales.get(q.scale_id) if q.scale_id else None
        questions.append(
            engine.QuestionDef(
                id=str(q.id),
                question_type=q.question_type,
                stem=q.stem,
                dimension_id=str(q.dimension_id) if q.dimension_id else None,
                reverse_keyed=q.reverse_keyed,
                weight=float(q.weight),
                is_attention_check=q.is_attention_check,
                expected_value=float(q.expected_value) if q.expected_value is not None else None,
                scale_min=float(scale.min_value) if scale else 1,
                scale_max=float(scale.max_value) if scale else 5,
                scale_labels=scale.labels if scale else {},
                explanation=q.explanation,
                options=tuple(
                    engine.OptionDef(
                        id=str(o.id),
                        label=o.label,
                        is_correct=o.is_correct,
                        rubric_score=float(o.rubric_score) if o.rubric_score is not None else None,
                        rubric_rationale=o.rubric_rationale,
                    )
                    for o in q.options
                ),
            )
        )
    rules = [
        engine.RuleDef(str(r.dimension_id) if r.dimension_id else None, r.method, r.params)
        for r in version.scoring_rules
    ]
    bands = [
        engine.BandDef(
            str(b.dimension_id) if b.dimension_id else None,
            float(b.min_score),
            float(b.max_score),
            b.band,
            b.text_template,
            tuple(b.recommendations or []),
        )
        for b in version.interpretation_rules
    ]
    return questions, rules, bands


def _answers(attempt: AssessmentAttempt) -> dict[str, engine.AnswerDef]:
    return {
        str(a.question_id): engine.AnswerDef(
            option_id=str(a.option_id) if a.option_id else None,
            numeric_value=float(a.numeric_value) if a.numeric_value is not None else None,
            time_ms=a.time_ms,
        )
        for a in attempt.answers
    }


class AssessmentService:
    def __init__(self, session: AsyncSession, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    # ============================================================ candidato
    async def _profile_id(self) -> uuid.UUID:
        return (await CandidateService(self.session, self.principal, self.audit).get_profile()).id

    async def _published_versions(self) -> list[AssessmentVersion]:
        latest = (
            select(AssessmentVersion.assessment_id, func.max(AssessmentVersion.version_no).label("v"))
            .where(AssessmentVersion.status == "published")
            .group_by(AssessmentVersion.assessment_id)
            .subquery()
        )
        stmt = (
            select(AssessmentVersion)
            .join(
                latest,
                (latest.c.assessment_id == AssessmentVersion.assessment_id)
                & (latest.c.v == AssessmentVersion.version_no),
            )
            .join(Assessment, Assessment.id == AssessmentVersion.assessment_id)
            .where(
                Assessment.deleted_at.is_(None),
                Assessment.status == "published",
                Assessment.company_id.is_(None),
            )
        )
        return list((await self.session.scalars(stmt)).unique().all())

    async def catalog(self) -> list[CatalogItem]:
        candidate_id = await self._profile_id()
        versions = await self._published_versions()
        pending = await self._pending_assignments(candidate_id)
        attempts = (
            (
                await self.session.scalars(
                    select(AssessmentAttempt)
                    .where(AssessmentAttempt.candidate_id == candidate_id)
                    .order_by(AssessmentAttempt.created_at.desc())
                )
            )
            .unique()
            .all()
        )
        results = await self._results([a.id for a in attempts])
        by_assessment: dict[uuid.UUID, AssessmentAttempt] = {}
        for attempt in attempts:
            by_assessment.setdefault(attempt.version.assessment_id, attempt)

        items = []
        for v in versions:
            last = by_assessment.get(v.assessment_id)
            items.append(
                CatalogItem(
                    assessment_id=v.assessment_id,
                    version_id=v.id,
                    code=v.assessment.code,
                    title=v.assessment.title,
                    description=v.assessment.description,
                    type_code=v.assessment.type.code,
                    type_name=v.assessment.type.name,
                    is_experimental=v.assessment.is_experimental,
                    question_count=len(v.questions),
                    time_limit_seconds=v.time_limit_seconds,
                    last_attempt=LastAttempt(
                        id=last.id,
                        status=last.status,
                        overall_score=results[last.id].overall_score if last.id in results else None,
                        submitted_at=last.submitted_at,
                    )
                    if last
                    else None,
                    pending_assignments=[p for vid, p in pending if vid == v.id],
                )
            )
        return items

    async def intro(self, version_id: uuid.UUID) -> VersionIntro:
        version = await self._published_version(version_id)
        return VersionIntro(
            version_id=version.id,
            version_no=version.version_no,
            title=version.assessment.title,
            description=version.assessment.description,
            type_code=version.assessment.type.code,
            is_experimental=version.assessment.is_experimental,
            instructions=version.instructions,
            consent_text=version.consent_text,
            limitations_text=version.limitations_text,
            disclaimer_text=version.disclaimer_text,
            time_limit_seconds=version.time_limit_seconds,
            question_count=len(version.questions),
            requires_consent=_is_psychometric(version) or bool(version.consent_text),
        )

    async def start(self, data: AttemptStart) -> AttemptSession:
        candidate_id = await self._profile_id()
        version = await self._published_version(data.version_id)
        requires_consent = _is_psychometric(version) or bool(version.consent_text)
        if requires_consent and not data.consent:
            raise ValidationFailedError(
                "Debes leer y aceptar el consentimiento para comenzar.", code="consent_required"
            )

        assignment = None
        if data.assignment_id:
            assignment = await self.session.get(AssessmentAssignment, data.assignment_id)
            if (
                assignment is None
                or assignment.candidate_id != candidate_id
                or assignment.version_id != version.id
            ):
                raise NotFoundError("Asignacion no encontrada.")
            if assignment.status in {"completed", "cancelled", "expired"}:
                raise ConflictError(
                    "Esta evaluacion asignada ya no esta disponible.", code="assignment_closed"
                )

        existing = await self.session.scalar(
            select(AssessmentAttempt).where(
                AssessmentAttempt.candidate_id == candidate_id,
                AssessmentAttempt.version_id == version.id,
                AssessmentAttempt.status == "in_progress",
            )
        )
        if existing is not None:
            return await self._session_view(existing)

        consent_id = None
        if requires_consent:
            consent = Consent(
                user_id=self.principal.id,
                consent_type="psychometric" if _is_psychometric(version) else "privacy",
                policy_version=get_settings().policy_version,
                granted=True,
                granted_at=utcnow(),
            )
            self.session.add(consent)
            await self.session.flush()
            consent_id = consent.id

        attempt = AssessmentAttempt(
            version_id=version.id,
            candidate_id=candidate_id,
            assignment_id=assignment.id if assignment else None,
            consent_id=consent_id,
            status="in_progress",
            random_seed=random.randint(1, 2_000_000_000),
            # Las evaluaciones psicometricas nunca se comparten por defecto
            share_with_company=bool(assignment) and not _is_psychometric(version),
        )
        self.session.add(attempt)
        if assignment:
            assignment.status = "started"
        await self.session.flush()
        self._audit("assessments.attempt_start", attempt.id, {"version": str(version.id)})
        await self.session.commit()
        return await self._session_view(await self._own_attempt(attempt.id, candidate_id))

    async def session_view(self, attempt_id: uuid.UUID) -> AttemptSession:
        return await self._session_view(await self._own_attempt(attempt_id, await self._profile_id()))

    async def answer(self, attempt_id: uuid.UUID, data: AnswerIn) -> None:
        attempt = await self._own_attempt(attempt_id, await self._profile_id())
        if attempt.status != "in_progress":
            raise ConflictError("Esta evaluacion ya fue enviada.", code="attempt_closed")
        expires = self._expires_at(attempt)
        if expires and utcnow() > expires + timedelta(seconds=GRACE_SECONDS):
            raise ValidationFailedError("El tiempo de la evaluacion termino.", code="time_expired")

        question = next((q for q in attempt.version.questions if q.id == data.question_id), None)
        if question is None:
            raise ValidationFailedError("La pregunta no pertenece a esta evaluacion.")
        self._validate_answer(attempt.version, question, data)

        existing = next((a for a in attempt.answers if a.question_id == question.id), None)
        if existing is None:
            existing = AssessmentAnswer(attempt_id=attempt.id, question_id=question.id)
            attempt.answers.append(existing)
        existing.option_id = data.option_id
        existing.numeric_value = data.numeric_value
        existing.time_ms = data.time_ms
        existing.answered_at = utcnow()
        await self.session.commit()

    async def submit(self, attempt_id: uuid.UUID) -> AttemptResult:
        attempt = await self._own_attempt(attempt_id, await self._profile_id())
        if attempt.status != "in_progress":
            raise ConflictError("Esta evaluacion ya fue enviada.", code="attempt_closed")
        version = attempt.version
        questions, rules, bands = _defs(version)
        try:
            outcome = engine.score(questions, _answers(attempt), rules, bands)
        except engine.IncompleteAttemptError as exc:
            raise ValidationFailedError(
                "Responde todas las preguntas antes de enviar.", code="incomplete_attempt"
            ) from exc

        now = utcnow()
        attempt.status = "scored"
        attempt.submitted_at = now
        attempt.duration_seconds = int((now - attempt.started_at).total_seconds())
        attempt.quality_flags = outcome.quality_flags
        psychometric = _is_psychometric(version)
        result = AssessmentResult(
            attempt_id=attempt.id,
            overall_score=Decimal(str(outcome.overall_score)) if outcome.overall_score is not None else None,
            summary=outcome.overall_interpretation,
            limitations=version.limitations_text,
            disclaimer=version.disclaimer_text
            or (PSYCHOMETRIC_DISCLAIMER if psychometric else DEFAULT_DISCLAIMER),
            scoring_version=f"{engine.ENGINE_VERSION}/v{version.version_no}",
            dimension_scores=[
                ResultDimensionScore(
                    dimension_id=uuid.UUID(d.dimension_id),
                    raw_score=Decimal(str(d.raw)),
                    normalized_score=Decimal(str(d.normalized)),
                    band=d.band,
                    interpretation=d.interpretation,
                    evidence=d.evidence,
                )
                for d in outcome.dimensions
            ],
        )
        self.session.add(result)
        if attempt.assignment_id:
            assignment = await self.session.get(AssessmentAssignment, attempt.assignment_id)
            if assignment:
                assignment.status = "completed"
                notify(
                    self.session,
                    assignment.assigned_by,
                    "assessment_completed",
                    f"Evaluacion completada: {version.assessment.title}",
                    "La persona candidata termino la evaluacion asignada.",
                    "/company/candidates",
                    {"assignment_id": str(assignment.id)},
                )
        self._audit("assessments.attempt_submit", attempt.id, {"flags": sorted(outcome.quality_flags)})
        await self.session.commit()
        return await self.result(attempt.id)

    async def result(self, attempt_id: uuid.UUID) -> AttemptResult:
        attempt = await self._own_attempt(attempt_id, await self._profile_id())
        return await self._result_view(attempt)

    async def history(self) -> list[AttemptSummary]:
        candidate_id = await self._profile_id()
        attempts = (
            (
                await self.session.scalars(
                    select(AssessmentAttempt)
                    .where(AssessmentAttempt.candidate_id == candidate_id)
                    .order_by(AssessmentAttempt.created_at.desc())
                )
            )
            .unique()
            .all()
        )
        results = await self._results([a.id for a in attempts])
        companies = await self._assignment_companies([a.assignment_id for a in attempts if a.assignment_id])
        return [
            AttemptSummary(
                id=a.id,
                title=a.version.assessment.title,
                type_code=a.version.assessment.type.code,
                is_experimental=a.version.assessment.is_experimental,
                status=a.status,
                started_at=a.started_at,
                submitted_at=a.submitted_at,
                overall_score=results[a.id].overall_score if a.id in results else None,
                share_with_company=a.share_with_company,
                assignment_company=companies.get(a.assignment_id) if a.assignment_id else None,
            )
            for a in attempts
        ]

    async def set_sharing(self, attempt_id: uuid.UUID, share: bool) -> AttemptResult:
        attempt = await self._own_attempt(attempt_id, await self._profile_id())
        if attempt.assignment_id is None:
            raise ValidationFailedError(
                "Solo se comparten evaluaciones solicitadas por una empresa.", code="no_assignment"
            )
        attempt.share_with_company = share
        self._audit("assessments.sharing_update", attempt.id, {"share": share})
        await self.session.commit()
        return await self._result_view(attempt)

    # ============================================================== empresa
    async def assignable(self) -> list[AssignableVersion]:
        return [
            AssignableVersion(
                version_id=v.id,
                title=v.assessment.title,
                type_code=v.assessment.type.code,
                is_experimental=v.assessment.is_experimental,
                question_count=len(v.questions),
            )
            for v in await self._published_versions()
        ]

    async def assign(self, data: AssignmentCreate) -> CompanyAssessmentView:
        application = await self._company_application(data.application_id)
        if application.status != "active":
            raise ValidationFailedError("La postulacion ya no esta activa.")
        version = await self._published_version(data.version_id)
        duplicate = await self.session.scalar(
            select(AssessmentAssignment.id).where(
                AssessmentAssignment.application_id == application.id,
                AssessmentAssignment.version_id == version.id,
                AssessmentAssignment.status.in_(("pending", "started")),
            )
        )
        if duplicate:
            raise ConflictError("Esta evaluacion ya esta asignada a la persona.", code="already_assigned")
        assignment = AssessmentAssignment(
            version_id=version.id,
            candidate_id=application.candidate_id,
            application_id=application.id,
            assigned_by=self.principal.id,
            due_at=data.due_at,
            status="pending",
        )
        self.session.add(assignment)
        await self.session.flush()
        profile = await self.session.get(CandidateProfile, application.candidate_id)
        job = await self.session.get(JobPosting, application.job_id)
        company_name = job.company.name if job else "Una empresa"
        job_title = job.title if job else "su vacante"
        notify(
            self.session,
            profile.user_id if profile else None,
            "assessment_assigned",
            f"Nueva evaluacion: {version.assessment.title}",
            f"{company_name} te solicito esta evaluacion para {job_title}.",
            "/candidate/assessments",
            {"assignment_id": str(assignment.id)},
        )
        self.audit.record(
            module="assessments",
            action="assessments.assign",
            result="success",
            actor_user_id=self.principal.id,
            company_id=application.company_id,
            entity_type="assessment_assignment",
            entity_id=assignment.id,
            changes={"version": str(version.id), "application": str(application.id)},
        )
        await self.session.commit()
        return (await self.application_assessments(application.id))[-1]

    async def application_assessments(self, application_id: uuid.UUID) -> list[CompanyAssessmentView]:
        application = await self._company_application(application_id)
        assignments = (
            await self.session.scalars(
                select(AssessmentAssignment)
                .where(AssessmentAssignment.application_id == application.id)
                .order_by(AssessmentAssignment.created_at)
            )
        ).all()
        views = []
        for a in assignments:
            version = await self.session.get(AssessmentVersion, a.version_id)
            assert version is not None
            attempt = await self.session.scalar(
                select(AssessmentAttempt)
                .where(AssessmentAttempt.assignment_id == a.id)
                .order_by(AssessmentAttempt.created_at.desc())
            )
            shared = bool(attempt and attempt.share_with_company and attempt.status == "scored")
            result = None
            if shared and attempt:
                full = await self._result_view(attempt)
                result = SharedResult(
                    overall_score=full.overall_score,
                    overall_band=full.overall_band,
                    summary=full.summary,
                    dimensions=full.dimensions,
                    quality_notes=full.quality_notes,
                    disclaimer=full.disclaimer,
                )
            views.append(
                CompanyAssessmentView(
                    assignment_id=a.id,
                    version_id=a.version_id,
                    title=version.assessment.title,
                    type_code=version.assessment.type.code,
                    is_experimental=version.assessment.is_experimental,
                    status=a.status,
                    due_at=a.due_at,
                    created_at=a.created_at,
                    shared=shared,
                    result=result,
                )
            )
        return views

    # ============================================================= helpers
    async def _published_version(self, version_id: uuid.UUID) -> AssessmentVersion:
        version = await self.session.get(AssessmentVersion, version_id)
        if version is None or version.status != "published" or version.assessment.deleted_at is not None:
            raise NotFoundError("Evaluacion no disponible.")
        return version

    async def _own_attempt(self, attempt_id: uuid.UUID, candidate_id: uuid.UUID) -> AssessmentAttempt:
        attempt = await self.session.get(AssessmentAttempt, attempt_id, populate_existing=True)
        if attempt is None or attempt.candidate_id != candidate_id:
            raise NotFoundError("Intento no encontrado.")
        return attempt

    async def _company_application(self, application_id: uuid.UUID) -> Application:
        application = await self.session.get(Application, application_id)
        if application is None or not self.principal.belongs_to_company(application.company_id):
            raise NotFoundError("Postulacion no encontrada.")
        return application

    @staticmethod
    def _expires_at(attempt: AssessmentAttempt):  # noqa: ANN205
        limit = attempt.version.time_limit_seconds
        return attempt.started_at + timedelta(seconds=limit) if limit else None

    @staticmethod
    def _validate_answer(version: AssessmentVersion, question: AssessmentQuestion, data: AnswerIn) -> None:
        if question.question_type == "likert":
            scale = next((s for s in version.scales if s.id == question.scale_id), None)
            if data.numeric_value is None or scale is None:
                raise ValidationFailedError("Esta pregunta se responde con la escala.")
            if not (scale.min_value <= data.numeric_value <= scale.max_value) or data.numeric_value % 1 != 0:
                raise ValidationFailedError("Valor fuera de la escala.")
        elif data.option_id is None or all(o.id != data.option_id for o in question.options):
            raise ValidationFailedError("Selecciona una de las opciones de la pregunta.")

    async def _session_view(self, attempt: AssessmentAttempt) -> AttemptSession:
        version = attempt.version
        questions = list(version.questions)
        if version.randomize_questions and attempt.random_seed:
            random.Random(attempt.random_seed).shuffle(questions)
        scales = {s.id: s for s in version.scales}
        companies = await self._assignment_companies([attempt.assignment_id] if attempt.assignment_id else [])
        return AttemptSession(
            attempt_id=attempt.id,
            status=attempt.status,
            version_id=version.id,
            title=version.assessment.title,
            type_code=version.assessment.type.code,
            is_experimental=version.assessment.is_experimental,
            started_at=attempt.started_at,
            expires_at=self._expires_at(attempt),
            share_with_company=attempt.share_with_company,
            assignment_company=companies.get(attempt.assignment_id) if attempt.assignment_id else None,
            # Nunca se envian respuestas correctas, rubricas ni items invertidos al cliente
            questions=[
                QuestionOut(
                    id=q.id,
                    question_type=q.question_type,
                    stem=q.stem,
                    context=q.context,
                    options=[OptionOut(id=o.id, label=o.label) for o in q.options],
                    scale=ScaleOut(
                        min=int(scales[q.scale_id].min_value),
                        max=int(scales[q.scale_id].max_value),
                        labels=scales[q.scale_id].labels,
                    )
                    if q.scale_id in scales
                    else None,
                )
                for q in questions
            ],
            answers={
                str(a.question_id): SavedAnswer(option_id=a.option_id, numeric_value=a.numeric_value)
                for a in attempt.answers
            },
        )

    async def _result_view(self, attempt: AssessmentAttempt) -> AttemptResult:
        result = await self.session.scalar(
            select(AssessmentResult).where(AssessmentResult.attempt_id == attempt.id)
        )
        if result is None:
            raise NotFoundError("El resultado aun no esta disponible.")
        version = attempt.version
        type_code = version.assessment.type.code
        dims = {d.id: d for d in version.dimensions}
        bands = {
            (r.dimension_id, r.band): list(r.recommendations or []) for r in version.interpretation_rules
        }
        overall_band = next(
            (
                r.band
                for r in version.interpretation_rules
                if r.dimension_id is None
                and result.overall_score is not None
                and r.min_score <= round(result.overall_score, 2) <= r.max_score
            ),
            None,
        )
        questions, _, _ = _defs(version)
        review = [] if _is_psychometric(version) else engine.review(questions, _answers(attempt))
        limitations = [line for line in (version.limitations_text or "").split("\n") if line.strip()]
        limitations.append("El resultado no debe usarse como unico criterio para decisiones laborales.")
        companies = await self._assignment_companies([attempt.assignment_id] if attempt.assignment_id else [])
        return AttemptResult(
            attempt_id=attempt.id,
            title=version.assessment.title,
            type_code=type_code,
            is_experimental=version.assessment.is_experimental,
            version_no=version.version_no,
            submitted_at=attempt.submitted_at,
            duration_seconds=attempt.duration_seconds,
            overall_score=result.overall_score,
            overall_band=overall_band,
            summary=result.summary,
            recommendations=bands.get((None, overall_band), []) if overall_band else [],
            dimensions=[
                DimensionResult(
                    code=dims[s.dimension_id].code,
                    name=dims[s.dimension_id].name,
                    description=dims[s.dimension_id].description,
                    score=s.normalized_score,
                    band=s.band,
                    interpretation=s.interpretation,
                    evidence=s.evidence,
                    recommendations=bands.get((s.dimension_id, s.band), []),
                )
                for s in sorted(result.dimension_scores, key=lambda s: dims[s.dimension_id].display_order)
            ],
            review=review,
            quality_notes=[QUALITY_NOTES[f] for f in attempt.quality_flags if f in QUALITY_NOTES],
            disclaimer=result.disclaimer,
            explanation=ResultExplanation(
                method=METHODS.get(type_code, DEFAULT_METHOD),
                data_used=[
                    "Tus respuestas a esta evaluacion",
                    f"Version {version.version_no} del instrumento y sus reglas de puntuacion",
                ],
                limitations=limitations,
            ),
            share_with_company=attempt.share_with_company,
            assignment_company=companies.get(attempt.assignment_id) if attempt.assignment_id else None,
        )

    async def _results(self, attempt_ids: list[uuid.UUID]) -> dict[uuid.UUID, AssessmentResult]:
        if not attempt_ids:
            return {}
        rows = (
            (
                await self.session.scalars(
                    select(AssessmentResult).where(AssessmentResult.attempt_id.in_(attempt_ids))
                )
            )
            .unique()
            .all()
        )
        return {r.attempt_id: r for r in rows}

    async def _assignment_companies(self, assignment_ids: list[uuid.UUID | None]) -> dict[uuid.UUID, str]:
        ids = [i for i in assignment_ids if i]
        if not ids:
            return {}
        rows = (
            await self.session.execute(
                select(AssessmentAssignment.id, Company.name)
                .join(Application, Application.id == AssessmentAssignment.application_id)
                .join(Company, Company.id == Application.company_id)
                .where(AssessmentAssignment.id.in_(ids))
            )
        ).all()
        return dict(rows)

    async def _pending_assignments(
        self, candidate_id: uuid.UUID
    ) -> list[tuple[uuid.UUID, PendingAssignment]]:
        rows = (
            (
                await self.session.execute(
                    select(AssessmentAssignment, Company.name, JobPosting.title)
                    .join(Application, Application.id == AssessmentAssignment.application_id)
                    .join(Company, Company.id == Application.company_id)
                    .join(JobPosting, JobPosting.id == Application.job_id)
                    .where(
                        AssessmentAssignment.candidate_id == candidate_id,
                        AssessmentAssignment.status.in_(("pending", "started")),
                    )
                )
            )
            .unique()
            .all()
        )
        return [
            (a.version_id, PendingAssignment(id=a.id, company_name=company, job_title=title, due_at=a.due_at))
            for a, company, title in rows
        ]

    def _audit(self, action: str, attempt_id: uuid.UUID, changes: dict | None) -> None:
        self.audit.record(
            module="assessments",
            action=action,
            result="success",
            actor_user_id=self.principal.id,
            entity_type="assessment_attempt",
            entity_id=attempt_id,
            changes=changes,
        )
