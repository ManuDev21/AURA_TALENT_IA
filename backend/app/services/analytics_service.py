"""Analitica agregada de empresa y personal.

Las metricas de empresa son agregadas: no exponen datos personales nuevos y avisan cuando el grupo es
demasiado pequeno para sacar conclusiones (menos de 5 postulaciones).
"""

import uuid
from collections import Counter

from sqlalchemy import func, select

from app.analytics.metrics import (
    MIN_GROUP,
    STAGE_NAMES,
    AppRow,
    HistoryRow,
    funnel,
    outcomes,
    stage_durations,
    weekly,
)
from app.core.errors import NotFoundError
from app.core.principal import Principal
from app.core.security import utcnow
from app.models import (
    Application,
    ApplicationHistory,
    AssessmentAssignment,
    AssessmentAttempt,
    AssessmentResult,
    CandidateSkill,
    CareerPath,
    JobPosting,
    MatchResult,
    Recommendation,
    Skill,
)
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService


class AnalyticsService:
    def __init__(self, session, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    # ============================================================ empresa
    async def company(self, job_id: uuid.UUID | None = None) -> dict:
        companies = list(self.principal.company_ids)
        if not companies:
            raise NotFoundError("No perteneces a ninguna empresa.")
        jobs_q = select(JobPosting).where(
            JobPosting.company_id.in_(companies), JobPosting.deleted_at.is_(None)
        )
        jobs = list((await self.session.scalars(jobs_q)).all())
        if job_id is not None:
            jobs = [j for j in jobs if j.id == job_id]
            if not jobs:
                raise NotFoundError("Vacante no encontrada.")
        job_ids = [j.id for j in jobs]
        apps = (
            list(
                (await self.session.scalars(select(Application).where(Application.job_id.in_(job_ids)))).all()
            )
            if job_ids
            else []
        )
        app_ids = [a.id for a in apps]
        hist = (
            list(
                (
                    await self.session.scalars(
                        select(ApplicationHistory).where(ApplicationHistory.application_id.in_(app_ids))
                    )
                ).all()
            )
            if app_ids
            else []
        )

        rows = [AppRow(str(a.id), a.applied_at, a.current_stage, a.status) for a in apps]
        hrows = [HistoryRow(str(h.application_id), h.to_stage, h.created_at) for h in hist]
        now = utcnow()

        # Habilidades de los postulantes y brechas frente a habilidades requeridas
        candidate_ids = {a.candidate_id for a in apps}
        skills_by_candidate: dict[uuid.UUID, set[uuid.UUID]] = {}
        names: dict[uuid.UUID, str] = {}
        if candidate_ids:
            for cs, name in (
                await self.session.execute(
                    select(CandidateSkill, Skill.name)
                    .join(Skill, Skill.id == CandidateSkill.skill_id)
                    .where(CandidateSkill.candidate_id.in_(candidate_ids))
                )
            ).all():
                skills_by_candidate.setdefault(cs.candidate_id, set()).add(cs.skill_id)
                names[cs.skill_id] = name
        required = {j.id: [s for s in j.skills if s.importance == "required"] for j in jobs}
        have, gaps = Counter(), Counter()
        for a in apps:
            owned = skills_by_candidate.get(a.candidate_id, set())
            for sid in owned:
                have[names[sid]] += 1
            for js in required.get(a.job_id, []):
                if js.skill_id not in owned:
                    gaps[js.skill.name] += 1

        assigned = completed = 0
        if app_ids:
            assigned = (
                await self.session.scalar(
                    select(func.count())
                    .select_from(AssessmentAssignment)
                    .where(AssessmentAssignment.application_id.in_(app_ids))
                )
                or 0
            )
            completed = (
                await self.session.scalar(
                    select(func.count())
                    .select_from(AssessmentAssignment)
                    .where(
                        AssessmentAssignment.application_id.in_(app_ids),
                        AssessmentAssignment.status == "completed",
                    )
                )
                or 0
            )

        avg_match = None
        if apps:
            pairs = [(a.candidate_id, a.job_id) for a in apps]
            scores = (
                await self.session.execute(
                    select(MatchResult.candidate_id, MatchResult.job_id, MatchResult.score).where(
                        MatchResult.job_id.in_(job_ids)
                    )
                )
            ).all()
            vals = [float(s) for c, j, s in scores if (c, j) in set(pairs)]
            avg_match = round(sum(vals) / len(vals), 1) if vals else None

        by_job = Counter(a.job_id for a in apps)
        status_counts = Counter(j.status for j in jobs)
        return {
            "scope": {"job_id": job_id, "job_title": jobs[0].title if job_id else None, "jobs": len(jobs)},
            "kpis": {
                "jobs_published": status_counts.get("PUBLISHED", 0),
                "applications": len(apps),
                **outcomes(rows),
                "avg_match": avg_match,
                "assessments_assigned": assigned,
                "assessments_completed": completed,
            },
            "funnel": funnel(rows, hrows),
            "stage_durations": stage_durations(rows, hrows, now),
            "weekly": weekly(rows, now),
            "top_skills": [{"name": n, "count": c} for n, c in have.most_common(8)],
            "top_gaps": [{"name": n, "count": c} for n, c in gaps.most_common(8)],
            "jobs": sorted(
                [
                    {"id": j.id, "title": j.title, "status": j.status, "applications": by_job.get(j.id, 0)}
                    for j in jobs
                ],
                key=lambda x: -x["applications"],
            ),
            "small_sample": len(apps) < MIN_GROUP,
            "explanation": {
                "method": "Conteos agregados sobre postulaciones e historial de etapas de tu empresa.",
                "data_used": [
                    "Postulaciones y etapas",
                    "Habilidades declaradas por postulantes",
                    "Evaluaciones asignadas",
                ],
                "limitations": [
                    f"Con menos de {MIN_GROUP} postulaciones las proporciones no son representativas.",
                    "Las brechas comparan habilidades declaradas, no verificadas.",
                    "El embudo cuenta etapas alcanzadas; un proceso concluido no implica falta de merito.",
                ],
            },
        }

    # ========================================================== personal
    async def personal(self) -> dict:
        candidates = CandidateService(self.session, self.principal, self.audit)
        profile = await candidates.get_profile()
        completeness = await candidates.recompute_completeness(profile)
        apps = list(
            (
                await self.session.scalars(select(Application).where(Application.candidate_id == profile.id))
            ).all()
        )
        stage = Counter(a.current_stage for a in apps if a.status == "active")
        results = (
            (
                await self.session.execute(
                    select(AssessmentResult.overall_score)
                    .join(AssessmentAttempt, AssessmentAttempt.id == AssessmentResult.attempt_id)
                    .where(AssessmentAttempt.candidate_id == profile.id, AssessmentAttempt.status == "scored")
                )
            )
            .scalars()
            .all()
        )
        scores = [float(s) for s in results if s is not None]
        matches = (
            (
                await self.session.execute(
                    select(MatchResult.score).where(MatchResult.candidate_id == profile.id)
                )
            )
            .scalars()
            .all()
        )
        paths = (
            await self.session.scalars(
                select(CareerPath).where(
                    CareerPath.candidate_id == profile.id, CareerPath.deleted_at.is_(None)
                )
            )
        ).all()
        path_progress = []
        for p in paths:
            steps = [n for n in p.nodes if n.node_type in ("skill", "course", "project")]
            done = sum(
                1.0 if n.status == "acquired" else 0.5 if n.status == "in_progress" else 0 for n in steps
            )
            path_progress.append(
                {"title": p.title, "progress": round(done / len(steps) * 100, 1) if steps else 0}
            )
        recs = Counter(
            (
                await self.session.execute(
                    select(Recommendation.status).where(Recommendation.user_id == self.principal.id)
                )
            )
            .scalars()
            .all()
        )
        skills = await self.session.scalar(
            select(func.count()).select_from(CandidateSkill).where(CandidateSkill.candidate_id == profile.id)
        )
        await self.session.commit()
        return {
            "kpis": {
                "completeness": completeness,
                "skills": skills or 0,
                "applications": len(apps),
                "active_applications": sum(
                    1 for a in apps if a.status == "active" and a.current_stage not in ("HIRED", "CLOSED")
                ),
                "assessments_completed": len(scores),
                "avg_assessment": round(sum(scores) / len(scores), 1) if scores else None,
                "best_match": round(max(float(m) for m in matches), 1) if matches else None,
                "recommendations_acted": recs.get("acted", 0),
            },
            "applications_by_stage": [
                {"stage": s, "label": STAGE_NAMES.get(s, s), "count": c} for s, c in stage.items()
            ],
            "career_paths": path_progress,
        }
