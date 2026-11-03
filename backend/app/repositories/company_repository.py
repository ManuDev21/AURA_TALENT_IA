import re
import secrets
import unicodedata
import uuid

from sqlalchemy import exists, select

from app.models import Company, CompanyUser
from app.repositories.base import BaseRepository


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug[:80] or "empresa"


class CompanyRepository(BaseRepository[Company]):
    model = Company

    async def slug_exists(self, slug: str) -> bool:
        stmt = select(exists().where(Company.slug == slug, Company.deleted_at.is_(None)))
        return bool(await self.session.scalar(stmt))

    async def unique_slug(self, name: str) -> str:
        base = slugify(name)
        slug = base
        while await self.slug_exists(slug):
            slug = f"{base}-{secrets.token_hex(3)}"
        return slug

    def add_member(self, company: Company, user_id: uuid.UUID, position: str | None = None) -> CompanyUser:
        member = CompanyUser(company_id=company.id, user_id=user_id, position=position)
        self.session.add(member)
        return member
