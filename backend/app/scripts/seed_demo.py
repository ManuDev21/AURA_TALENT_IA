"""Crea usuarios y empresa de demostracion (solo desarrollo).

Uso (desde backend/):
    .venv\\Scripts\\python -m app.scripts.seed_demo
    .venv\\Scripts\\python -m app.scripts.seed_demo --password OtraClave2026
"""

import argparse
import asyncio
from dataclasses import dataclass

import asyncpg
from sqlalchemy import select

from app.config import get_settings
from app.core.roles import RoleCode
from app.core.security import hash_password, utcnow
from app.database.session import SessionLocal, engine
from app.models import CandidateProfile, Company, Consent, User
from app.repositories.company_repository import CompanyRepository
from app.repositories.user_repository import RoleRepository, UserRepository

DEFAULT_PASSWORD = "AuraDemo2026"
DEMO_COMPANY_SLUG = "aura-labs"


@dataclass(frozen=True)
class DemoUser:
    email: str
    full_name: str
    role: RoleCode
    company_member: bool = False


DEMO_USERS = [
    DemoUser("candidato@aura.dev", "Valeria Candidata", RoleCode.CANDIDATE),
    DemoUser("reclutador@auralabs.dev", "Diego Reclutador", RoleCode.RECRUITER, company_member=True),
    DemoUser("admin@auralabs.dev", "Laura Admin Empresa", RoleCode.COMPANY_ADMIN, company_member=True),
    DemoUser("sysadmin@aura.dev", "Admin Sistema", RoleCode.SYSTEM_ADMIN),
]


async def seed(password: str) -> None:
    settings = get_settings()
    async with SessionLocal() as session:
        users = UserRepository(session)
        roles = RoleRepository(session)
        companies = CompanyRepository(session)

        company = await session.scalar(select(Company).where(Company.slug == DEMO_COMPANY_SLUG))
        if company is None:
            company = companies.add(
                Company(
                    name="Aura Labs",
                    slug=DEMO_COMPANY_SLUG,
                    description="Empresa de demostracion de AURA TALENT AI.",
                    sector="Tecnologia",
                    location="Remoto",
                    size_range="11-50",
                )
            )
            await session.flush()

        now = utcnow()
        for demo in DEMO_USERS:
            if await users.get_by_email(demo.email):
                print(f"  existe   {demo.email}")
                continue
            user = users.add(
                User(
                    email=demo.email,
                    password_hash=hash_password(password),
                    full_name=demo.full_name,
                    status="active",
                    email_verified_at=now,
                )
            )
            await session.flush()
            role = await roles.get_by_code(demo.role)
            roles.assign(user.id, role, company.id if demo.company_member else None)
            if demo.company_member:
                companies.add_member(company, user.id, position=role.name)
            if demo.role == RoleCode.CANDIDATE:
                session.add(
                    CandidateProfile(user_id=user.id, headline="Desarrolladora Frontend en formacion")
                )
            for consent_type in ("terms", "privacy"):
                session.add(
                    Consent(
                        user_id=user.id,
                        consent_type=consent_type,
                        policy_version=settings.policy_version,
                        granted=True,
                        granted_at=now,
                    )
                )
            print(f"  creado   {demo.email}  ({demo.role})")
        await session.commit()
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Crea datos demo de AURA TALENT AI")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Contrasena para los usuarios demo")
    args = parser.parse_args()
    if get_settings().is_production:
        raise SystemExit("El seeder demo no puede ejecutarse en produccion.")
    print("Creando datos demo...")
    try:
        asyncio.run(seed(args.password))
    except (asyncpg.PostgresError, asyncpg.InterfaceError, OSError) as exc:
        s = get_settings()
        raise SystemExit(
            f"\nNo fue posible conectar a PostgreSQL ({s.db_user}@{s.db_host}:{s.db_port}/{s.db_name}): "
            f"{type(exc).__name__}\n"
            "Revisa que DB_PASSWORD en backend/.env coincida con la contrasena del usuario en PostgreSQL.\n"
            "El motivo exacto aparece en el log: C:\\Program Files\\PostgreSQL\\18\\data\\log"
        ) from None
    print(f"Listo. Contrasena de los usuarios demo: {args.password}")


if __name__ == "__main__":
    main()
