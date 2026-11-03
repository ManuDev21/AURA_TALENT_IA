"""AURA Match: calcula, guarda y explica la compatibilidad estimada candidato-vacante.

La compatibilidad es un insumo para personas; nunca mueve, descarta ni ordena de forma decisoria.
Los resultados psicometricos NO participan en el calculo, aunque hayan sido compartidos.
"""

import uuid
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.core.errors import NotFoundError
from app.core.principal import Principal
from app.core.security import utcnow
from app.match.engine import (
    MODEL_VERSION,
    CandidateIn,
    CandidateSkillIn,
    JobIn,
    JobSkillIn,
    MatchOutcome,
    Period,
    compute_match,
)
from app.models import (
    Application,
    Assessment,
    AssessmentAssignment,
    AssessmentAttempt,
    AssessmentResult,
    AssessmentType,
    AssessmentVersion,
    CandidateLanguage,
    CandidateProfile,
    CandidateSkill,
    Certification,
    Education,
    Experience,
    JobPosting,
    MatchResult,
)
from app.schemas.match import (
    AggregatedGap,
    ApplicantMatch,
    GapReport,
    MatchBrief,
    MatchExplanation,
    MatchRead,
)
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService

DISCLAIMER = (
    "Compatibilidad estimada a partir de los datos registrados. Es un apoyo para decidir, no una decision: "
    "la evaluacion final siempre la realiza una persona."
)
NOT_USED = [
    "Edad, genero, estado civil, nacionalidad u origen",
    "Fotografia o datos biometricos",
    "Resultados psicometricos (orientacion)",
    "Expectativa salarial",
]
LIMITATIONS = [
    "Solo considera lo que esta registrado: una habilidad no declarada cuenta como ausente.",
    "Los niveles de habilidad son autodeclarados salvo que esten verificados.",
    "La similitud de texto compara terminos, no significado (se reemplazara por embeddings mas adelante).",
    "La experiencia se mide en anos totales, sin ponderar su relevancia para el puesto.",
]
SCORED_TYPES = ("technical", "situational")


def match_label(score: float) -> str:
    if score >= 75:
        return "Alta"
    if score >= 55:
        return "Media"
    return "Baja"


def _recommendations(outcome: MatchOutcome) -> list[str]:
    recs = []
    for gap in outcome.gaps[:5]:
        if gap["kind"] == "skill":
            recs.append(
                f"Refuerza {gap['name']}: un proyecto en tu portfolio que la use es la evidencia mas clara."
                if "No declarada" in str(gap["detail"])
                else f"Sube tu nivel en {gap['name']} ({gap['detail']}) con practica guiada o un curso breve."
            )
        elif gap["kind"] == "language":
            recs.append(f"{gap['name']}: {gap['detail']}. Una certificacion de idioma fortalece tu perfil.")
        elif gap["kind"] == "experience":
            recs.append(
                "Registra practicas, proyectos o voluntariados relevantes: tambien cuentan como experiencia."
            )
    if outcome.data_completeness < 1:
        recs.append("Completa tu perfil: con mas datos el rango de compatibilidad se vuelve mas preciso.")
    return recs


class MatchService:
    def __init__(self, session, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    # ---------------------------------------------------------- carga datos
    async def _candidate_input(
        self, profile: CandidateProfile, assessment_scores: list[float]
    ) -> CandidateIn:
        cid = profile.id
        skills = (
            await self.session.scalars(select(CandidateSkill).where(CandidateSkill.candidate_id == cid))
        ).all()
        exps = (
            await self.session.scalars(
                select(Experience).where(Experience.candidate_id == cid, Experience.deleted_at.is_(None))
            )
        ).all()
        edus = (
            await self.session.scalars(
                select(Education).where(Education.candidate_id == cid, Education.deleted_at.is_(None))
            )
        ).all()
        langs = (
            await self.session.scalars(select(CandidateLanguage).where(CandidateLanguage.candidate_id == cid))
        ).all()
        certs = (
            await self.session.scalars(
                select(Certification).where(
                    Certification.candidate_id == cid, Certification.deleted_at.is_(None)
                )
            )
        ).all()
        text = " ".join(
            [profile.headline or "", profile.summary or "", " ".join(profile.desired_roles or [])]
            + [f"{e.title} {e.description or ''} {' '.join(e.achievements or [])}" for e in exps]
            + [s.skill.name for s in skills]
        )
        return CandidateIn(
            skills=[CandidateSkillIn(str(s.skill_id), s.skill.name, s.proficiency) for s in skills],
            experiences=[Period(e.start_date, e.end_date, e.is_current) for e in exps],
            education_levels=[e.level for e in edus if e.level],
            languages={lang.language_code.lower(): lang.level for lang in langs},
            certifications=[c.name for c in certs],
            modality=profile.work_modality,
            text=text,
            assessment_scores=assessment_scores,
        )

    @staticmethod
    def _job_input(job: JobPosting) -> JobIn:
        return JobIn(
            skills=[
                JobSkillIn(str(s.skill_id), s.skill.name, s.importance, s.min_proficiency, float(s.weight))
                for s in job.skills
            ],
            experience_min_years=float(job.experience_min_years or 0),
            education_level=job.education_level,
            languages=[
                (lang.language_code.lower(), lang.min_level, lang.is_required) for lang in job.languages
            ],
            certification_requirements=[
                r.description
                for r in job.requirements
                if r.requirement_type == "certification" and r.is_required
            ],
            modality=job.modality,
            text=" ".join(
                [job.title, job.description, " ".join(job.responsibilities or [])]
                + [s.skill.name for s in job.skills]
            ),
        )

    async def _scores(self, candidate_id: uuid.UUID, application_id: uuid.UUID | None) -> list[float]:
        """Evaluaciones tecnicas/situacionales. Vista empresa: solo las compartidas de ESA postulacion."""
        query = (
            select(
                AssessmentVersion.assessment_id,
                AssessmentResult.overall_score,
                AssessmentAttempt.submitted_at,
            )
            .join(AssessmentAttempt, AssessmentAttempt.id == AssessmentResult.attempt_id)
            .join(AssessmentVersion, AssessmentVersion.id == AssessmentAttempt.version_id)
            .join(Assessment, Assessment.id == AssessmentVersion.assessment_id)
            .join(AssessmentType, AssessmentType.id == Assessment.type_id)
            .where(
                AssessmentAttempt.candidate_id == candidate_id,
                AssessmentAttempt.status == "scored",
                AssessmentType.code.in_(SCORED_TYPES),
                AssessmentResult.overall_score.is_not(None),
            )
            .order_by(AssessmentAttempt.submitted_at.desc())
        )
        if application_id is not None:
            query = query.join(
                AssessmentAssignment, AssessmentAssignment.id == AssessmentAttempt.assignment_id
            ).where(
                AssessmentAssignment.application_id == application_id,
                AssessmentAttempt.share_with_company.is_(True),
            )
        latest: dict[uuid.UUID, float] = {}
        for assessment_id, score, _ in (await self.session.execute(query)).all():
            latest.setdefault(assessment_id, float(score))
        return list(latest.values())

    # --------------------------------------------------------- calculo
    async def _compute(
        self, profile: CandidateProfile, job: JobPosting, scores: list[float]
    ) -> tuple[MatchOutcome, MatchResult]:
        outcome = compute_match(await self._candidate_input(profile, scores), self._job_input(job))
        explanation = {
            "method": (
                "Promedio ponderado de factores transparentes (reglas v1). Los factores que la vacante no "
                "pide se excluyen y su peso se redistribuye. El rango se amplia si faltan datos del perfil."
            ),
            "data_used": [
                "Habilidades y niveles declarados",
                "Experiencia (fechas y descripciones)",
                "Educacion, idiomas y certificaciones",
                "Modalidad preferida",
                "Evaluaciones tecnicas y situacionales"
                + (" compartidas" if scores else " (ninguna disponible)"),
                "Descripcion, responsabilidades y requisitos de la vacante",
            ],
            "not_used": NOT_USED,
            "limitations": LIMITATIONS,
        }
        values = {
            "score": Decimal(str(outcome.score)),
            "score_low": Decimal(str(outcome.score_low)),
            "score_high": Decimal(str(outcome.score_high)),
            "breakdown": {
                "factors": [f.__dict__ for f in outcome.factors],
                "requirements": [r.__dict__ for r in outcome.requirements],
                "data_completeness": outcome.data_completeness,
            },
            "strengths": outcome.strengths,
            "gaps": outcome.gaps,
            "explanation": explanation,
            "computed_at": utcnow(),
        }
        stmt = (
            insert(MatchResult)
            .values(candidate_id=profile.id, job_id=job.id, model_version=MODEL_VERSION, **values)
            .on_conflict_do_update(index_elements=["candidate_id", "job_id", "model_version"], set_=values)
            .returning(MatchResult)
        )
        row = (await self.session.scalars(stmt, execution_options={"populate_existing": True})).one()
        return outcome, row

    @staticmethod
    def _read(job: JobPosting, outcome: MatchOutcome, row: MatchResult) -> MatchRead:
        return MatchRead(
            job_id=job.id,
            job_title=job.title,
            company_name=job.company.name,
            score=outcome.score,
            score_low=outcome.score_low,
            score_high=outcome.score_high,
            label=match_label(outcome.score),
            factors=[f.__dict__ for f in outcome.factors],
            requirements=[r.__dict__ for r in outcome.requirements],
            strengths=outcome.strengths,
            gaps=outcome.gaps,
            recommendations=_recommendations(outcome),
            data_completeness=outcome.data_completeness,
            explanation=MatchExplanation(**row.explanation),
            model_version=outcome.model_version,
            computed_at=row.computed_at,
            disclaimer=DISCLAIMER,
        )

    @staticmethod
    def _required_counts(outcome: MatchOutcome) -> tuple[int, int]:
        req = [r for r in outcome.requirements if r.required]
        return sum(1 for r in req if r.status == "met"), len(req)

    # ======================================================== candidato
    async def my_profile(self) -> CandidateProfile:
        return await CandidateService(self.session, self.principal, self.audit).get_profile()

    async def _visible_job(self, job_id: uuid.UUID, profile_id: uuid.UUID) -> JobPosting:
        job = await self.session.get(JobPosting, job_id)
        if job is None or job.deleted_at is not None:
            raise NotFoundError("Vacante no encontrada.")
        if job.status != "PUBLISHED":
            applied = await self.session.scalar(
                select(Application.id).where(
                    Application.job_id == job_id, Application.candidate_id == profile_id
                )
            )
            if applied is None:
                raise NotFoundError("Vacante no encontrada.")
        return job

    async def my_match(self, job_id: uuid.UUID) -> MatchRead:
        profile = await self.my_profile()
        job = await self._visible_job(job_id, profile.id)
        outcome, row = await self._compute(profile, job, await self._scores(profile.id, None))
        await self.session.commit()
        return self._read(job, outcome, row)

    async def _published_jobs(self, limit: int = 60) -> list[JobPosting]:
        return list(
            (
                await self.session.scalars(
                    select(JobPosting)
                    .where(JobPosting.status == "PUBLISHED", JobPosting.deleted_at.is_(None))
                    .order_by(JobPosting.published_at.desc())
                    .limit(limit)
                )
            ).all()
        )

    async def all_for_me(self) -> list[tuple[JobPosting, MatchOutcome]]:
        profile = await self.my_profile()
        scores = await self._scores(profile.id, None)
        results = []
        for job in await self._published_jobs():
            outcome, _ = await self._compute(profile, job, scores)
            results.append((job, outcome))
        await self.session.commit()
        return results

    async def my_top(self, limit: int) -> list[MatchBrief]:
        ranked = sorted(await self.all_for_me(), key=lambda t: t[1].score, reverse=True)[:limit]
        out = []
        for job, o in ranked:
            met, total = self._required_counts(o)
            out.append(
                MatchBrief(
                    job_id=job.id,
                    job_title=job.title,
                    company_name=job.company.name,
                    modality=job.modality,
                    location=job.location,
                    score=o.score,
                    score_low=o.score_low,
                    score_high=o.score_high,
                    label=match_label(o.score),
                    required_met=met,
                    required_total=total,
                    top_gap=next((str(g["name"]) for g in o.gaps if g["required"]), None),
                )
            )
        return out

    async def my_gaps(self) -> GapReport:
        results = await self.all_for_me()
        buckets: dict[tuple[str, str], dict] = defaultdict(lambda: {"jobs": [], "required_in": 0})
        strengths: dict[str, int] = defaultdict(int)
        for job, o in results:
            for g in o.gaps:
                b = buckets[(str(g["kind"]), str(g["name"]))]
                b["jobs"].append(job.title)
                b["required_in"] += int(bool(g["required"]))
            for s in o.strengths:
                strengths[s] += 1
        gaps = []
        for (kind, name), b in sorted(
            buckets.items(), key=lambda kv: (-kv[1]["required_in"], -len(kv[1]["jobs"]))
        ):
            count = len(b["jobs"])
            suggestion = {
                "skill": f"Aprender o reforzar {name} mejoraria tu compatibilidad con {count} vacante(s).",
                "language": f"Mejorar tu nivel de {name.replace('Idioma ', '')} abriria {count} vacante(s).",
                "experience": "Suma experiencia registrable: practicas, proyectos o voluntariados.",
                "education": "Algunas vacantes piden un nivel educativo mayor al registrado.",
            }.get(kind, "")
            gaps.append(
                AggregatedGap(
                    name=name,
                    kind=kind,
                    jobs_count=len(b["jobs"]),
                    jobs=list(dict.fromkeys(b["jobs"]))[:5],
                    required_in=b["required_in"],
                    suggestion=suggestion,
                )
            )
        return GapReport(
            analyzed_jobs=len(results),
            gaps=gaps[:15],
            strengths=[s for s, _ in sorted(strengths.items(), key=lambda kv: -kv[1])][:8],
            note="Analisis sobre las vacantes publicadas hoy; cambia cuando el mercado o tu perfil cambian.",
        )

    # ========================================================== empresa
    async def application_match(self, application_id: uuid.UUID) -> MatchRead:
        application = await self.session.get(Application, application_id)
        if application is None or not self.principal.belongs_to_company(application.company_id):
            raise NotFoundError("Postulacion no encontrada.")
        profile = await self.session.get(CandidateProfile, application.candidate_id)
        outcome, row = await self._compute(
            profile, application.job, await self._scores(profile.id, application.id)
        )
        await self.session.commit()
        return self._read(application.job, outcome, row)

    async def job_applicants(self, job_id: uuid.UUID) -> list[ApplicantMatch]:
        job = await self.session.get(JobPosting, job_id)
        if job is None or job.deleted_at is not None or not self.principal.belongs_to_company(job.company_id):
            raise NotFoundError("Vacante no encontrada.")
        rows = (
            await self.session.execute(
                select(Application, CandidateProfile)
                .join(CandidateProfile, CandidateProfile.id == Application.candidate_id)
                .where(Application.job_id == job.id, Application.company_id == job.company_id)
            )
        ).all()
        out = []
        for application, profile in rows:
            o, _ = await self._compute(profile, job, await self._scores(profile.id, application.id))
            met, total = self._required_counts(o)
            out.append(
                ApplicantMatch(
                    application_id=application.id,
                    score=o.score,
                    score_low=o.score_low,
                    score_high=o.score_high,
                    label=match_label(o.score),
                    required_met=met,
                    required_total=total,
                )
            )
        await self.session.commit()
        return out
