"""Career Map: cobertura de roles objetivo y rutas profesionales editables por la persona."""

import uuid

from sqlalchemy import select

from app.career.planner import OwnedSkill, Resource, build_plan, rank_roles
from app.career.roles import CATALOG_VERSION, ROLES
from app.career.search import GraphEdge, GraphNode, SearchResult, search
from app.core.errors import NotFoundError, ValidationFailedError
from app.core.principal import Principal
from app.core.security import utcnow
from app.models import CandidateSkill, CareerEdge, CareerNode, CareerPath, LearningResource, Skill
from app.schemas.career import (
    CareerRolesRead,
    EdgeRead,
    NodeRead,
    NodeStatusUpdate,
    PathCreate,
    PathRead,
    PathSummary,
    ResourceRead,
    RoleCoverageRead,
)
from app.schemas.career_search import AlgorithmName, CareerSearchRead, HeuristicName, SearchMode
from app.services.audit_service import AuditService
from app.services.candidate_service import CandidateService

PATH_EXPLANATION = {
    "method": (
        "La ruta compara tus habilidades declaradas con el perfil de referencia del rol (catalogo editorial "
        f"{CATALOG_VERSION}). Cada brecha se enlaza con un recurso gratuito y todo converge en un proyecto."
    ),
    "data_used": [
        "Habilidades y niveles declarados en tu perfil",
        "Catalogo de roles",
        "Recursos de aprendizaje",
    ],
    "limitations": [
        "Los perfiles de rol son referencias generales; cada empresa pide combinaciones distintas.",
        "Los niveles son autodeclarados.",
        "Tu decides la ruta: puedes marcar avances o descartarla cuando quieras.",
    ],
}


def resource_read(r: LearningResource) -> ResourceRead:
    return ResourceRead(
        id=r.id,
        title=r.title,
        provider=r.provider,
        url=r.url,
        description=r.description,
        level=r.level,
        duration_hours=float(r.duration_hours) if r.duration_hours is not None else None,
        cost_type=r.cost_type,
        language_code=r.language_code,
        skills=[s.name for s in r.skills],
    )


class CareerService:
    def __init__(self, session, principal: Principal, audit: AuditService) -> None:
        self.session = session
        self.principal = principal
        self.audit = audit

    async def _profile_id(self) -> uuid.UUID:
        return (await CandidateService(self.session, self.principal, self.audit).get_profile()).id

    async def owned_and_names(self, candidate_id: uuid.UUID) -> tuple[dict[str, OwnedSkill], dict[str, str]]:
        rows = (
            await self.session.scalars(
                select(CandidateSkill).where(CandidateSkill.candidate_id == candidate_id)
            )
        ).all()
        owned = {r.skill.slug: OwnedSkill(r.skill.slug, r.skill.name, r.proficiency) for r in rows}
        names = dict((await self.session.execute(select(Skill.slug, Skill.name))).tuples().all())
        return owned, names

    async def resources(self) -> list[Resource]:
        rows = (
            await self.session.scalars(select(LearningResource).where(LearningResource.is_active.is_(True)))
        ).all()
        return [
            Resource(
                str(r.id),
                r.title,
                r.url,
                r.level,
                float(r.duration_hours) if r.duration_hours else None,
                tuple(s.slug for s in r.skills),
            )
            for r in rows
        ]

    # ------------------------------------------------------------- roles
    async def roles(self) -> CareerRolesRead:
        owned, names = await self.owned_and_names(await self._profile_id())
        return CareerRolesRead(
            catalog_version=CATALOG_VERSION,
            roles=[RoleCoverageRead(**c.__dict__) for c in rank_roles(owned, names)],
            note="Cobertura = cuanto de tu perfil coincide con la referencia del rol. No mide tu potencial.",
        )

    # ------------------------------------------------------------- rutas
    async def create_path(self, data: PathCreate, generated_by: str = "user") -> PathRead:
        role = ROLES.get(data.role_code)
        if role is None:
            raise ValidationFailedError("Rol desconocido en el catalogo.")
        candidate_id = await self._profile_id()
        owned, names = await self.owned_and_names(candidate_id)
        plan_nodes, plan_edges = build_plan(role, owned, names, await self.resources())
        path = CareerPath(
            candidate_id=candidate_id,
            title=f"Ruta hacia {role.title}",
            goal_role=role.title,
            generated_by=generated_by,
        )
        self.session.add(path)
        await self.session.flush()
        ids: dict[str, CareerNode] = {}
        for n in plan_nodes:
            ref = None
            if n.node_type == "course" and n.ref:
                ref = uuid.UUID(n.ref)
            node = CareerNode(
                path_id=path.id,
                node_type=n.node_type,
                label=n.label[:200],
                status=n.status,
                ref_id=ref,
                pos_x=n.pos[0],
                pos_y=n.pos[1],
                pos_z=n.pos[2],
                meta={**n.meta, "key": n.key},
            )
            self.session.add(node)
            ids[n.key] = node
        await self.session.flush()
        seen = set()
        for e in plan_edges:
            pair = (e.source, e.target, e.edge_type)
            if pair in seen or e.source not in ids or e.target not in ids:
                continue
            seen.add(pair)
            self.session.add(
                CareerEdge(
                    path_id=path.id,
                    source_node_id=ids[e.source].id,
                    target_node_id=ids[e.target].id,
                    edge_type=e.edge_type,
                )
            )
        self.audit.record(
            module="career",
            action="path_created",
            result="success",
            actor_user_id=self.principal.id,
            actor_type="ai" if generated_by == "aura" else "human",
            entity_type="career_path",
            entity_id=path.id,
        )
        await self.session.commit()
        return await self.get_path(path.id)

    async def _own_path(self, path_id: uuid.UUID) -> CareerPath:
        path = await self.session.get(CareerPath, path_id, populate_existing=True)
        if path is None or path.deleted_at is not None or path.candidate_id != await self._profile_id():
            raise NotFoundError("Ruta no encontrada.")
        return path

    @staticmethod
    def _progress(path: CareerPath) -> float:
        steps = [n for n in path.nodes if n.node_type in ("skill", "course", "project")]
        if not steps:
            return 0.0
        done = sum(1.0 if n.status == "acquired" else 0.5 if n.status == "in_progress" else 0 for n in steps)
        return round(done / len(steps) * 100, 1)

    async def get_path(self, path_id: uuid.UUID) -> PathRead:
        path = await self._own_path(path_id)
        return PathRead(
            id=path.id,
            title=path.title,
            goal_role=path.goal_role,
            generated_by=path.generated_by,
            created_at=path.created_at,
            progress=self._progress(path),
            nodes=[
                NodeRead(
                    id=n.id,
                    node_type=n.node_type,
                    label=n.label,
                    status=n.status,
                    ref_id=n.ref_id,
                    position=(n.pos_x, n.pos_y, n.pos_z),
                    meta=n.meta,
                )
                for n in path.nodes
            ],
            edges=[
                EdgeRead(source=e.source_node_id, target=e.target_node_id, edge_type=e.edge_type)
                for e in path.edges
            ],
            explanation=PATH_EXPLANATION,
        )

    async def list_paths(self) -> list[PathSummary]:
        cid = await self._profile_id()
        paths = (
            await self.session.scalars(
                select(CareerPath)
                .where(CareerPath.candidate_id == cid, CareerPath.deleted_at.is_(None))
                .order_by(CareerPath.created_at.desc())
            )
        ).all()
        return [
            PathSummary(
                id=p.id,
                title=p.title,
                goal_role=p.goal_role,
                progress=self._progress(p),
                created_at=p.created_at,
            )
            for p in paths
        ]

    async def search_path(
        self,
        path_id: uuid.UUID,
        algorithm: AlgorithmName,
        mode: SearchMode,
        max_depth: int,
        heuristic: HeuristicName = "manhattan",
    ) -> CareerSearchRead:
        path = await self._own_path(path_id)
        nodes = [
            GraphNode(
                id=str(node.id),
                label=node.label,
                node_type=node.node_type,
                hours=float(node.meta["hours"])
                if isinstance(node.meta.get("hours"), (int, float)) and node.meta["hours"] > 0
                else None,
                pos_x=float(node.pos_x),
                pos_y=float(node.pos_y),
                pos_z=float(node.pos_z),
            )
            for node in path.nodes
        ]
        edges = [
            GraphEdge(
                source=str(edge.source_node_id),
                target=str(edge.target_node_id),
                cost=float(edge.weight),
            )
            for edge in path.edges
        ]
        start = next((node for node in nodes if node.node_type == "profile"), None)
        goal = next((node for node in reversed(nodes) if node.node_type == "role"), None)
        if start is None or goal is None:
            raise ValidationFailedError("La ruta debe tener un perfil inicial y un rol objetivo.")
        result: SearchResult = search(
            nodes,
            edges,
            start.id,
            goal.id,
            algorithm,
            mode,
            max_depth=max_depth,
            max_routes=20,
            heuristic=heuristic,
        )
        labels = {node.id: node.label for node in nodes}
        return CareerSearchRead(
            algorithm=result.algorithm,
            mode=result.mode,
            heuristic_type=result.heuristic_type,
            heuristic_formula=result.heuristic_formula,
            start_id=result.start,
            goal_id=result.goal,
            start_label=labels[result.start],
            goal_label=labels[result.goal],
            order_exploration=list(result.order),
            order_labels=[labels[node_id] for node_id in result.order],
            events=result.events,
            paths=[
                {
                    "node_ids": list(route.nodes),
                    "labels": [labels[node_id] for node_id in route.nodes],
                    "cost": route.cost,
                }
                for route in result.paths
            ],
            cycles_avoided=[list(pair) for pair in result.cycles_avoided],
            backtracks=result.backtracks,
            max_depth=result.max_depth,
            explored=result.explored,
            heuristic=result.heuristic,
            heuristic_manhattan=result.heuristic_manhattan or {},
            heuristic_euclidean=result.heuristic_euclidean or {},
            heuristic_hops=result.heuristic_hops or {},
            node_heuristics=[item.__dict__ for item in result.node_heuristics],
            hill_climbing=result.hill_climbing,
            genetic=result.genetic,
            cost_unit="horas de estudio estimadas",
            limitation=(
                "Este mapa muestra sugerencias basadas en tu perfil actual para orientarte paso a paso. "
                "Las horas de estudio y distancias son estimaciones de apoyo para ayudarte a elegir que "
                "aprender primero, pero tu decides libremente el orden de tu preparacion."
            ),
        )

    async def update_node(self, path_id: uuid.UUID, node_id: uuid.UUID, data: NodeStatusUpdate) -> PathRead:
        path = await self._own_path(path_id)
        node = next((n for n in path.nodes if n.id == node_id), None)
        if node is None or node.node_type in ("profile", "role", "milestone"):
            raise NotFoundError("Paso no encontrado.")
        node.status = data.status
        await self.session.commit()
        return await self.get_path(path_id)

    async def delete_path(self, path_id: uuid.UUID) -> None:
        path = await self._own_path(path_id)
        path.deleted_at = utcnow()
        await self.session.commit()

    # --------------------------------------------------------- recursos
    async def list_resources(self, skill_id: uuid.UUID | None) -> list[ResourceRead]:
        query = (
            select(LearningResource)
            .where(LearningResource.is_active.is_(True))
            .order_by(LearningResource.title)
        )
        rows = (await self.session.scalars(query)).all()
        if skill_id:
            rows = [r for r in rows if any(s.id == skill_id for s in r.skills)]
        return [resource_read(r) for r in rows]
