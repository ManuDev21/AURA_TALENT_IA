import uuid
from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field

from app.schemas.common import HttpUrlStr, OptStr, ORMModel, TagList

SizeRange = Literal["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]


class CompanyRead(ORMModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None
    sector: str | None
    location: str | None
    website: str | None
    size_range: str | None
    culture: str | None
    benefits: list[str]
    contact_email: str | None
    status: str


class CompanyUpdate(ORMModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: OptStr = Field(default=None, max_length=4000)
    sector: OptStr = Field(default=None, max_length=100)
    location: OptStr = Field(default=None, max_length=150)
    website: HttpUrlStr = None
    size_range: SizeRange | None = None
    culture: OptStr = Field(default=None, max_length=3000)
    benefits: TagList | None = None
    contact_email: EmailStr | None = None


class MemberRead(ORMModel):
    user_id: uuid.UUID
    full_name: str
    email: str
    position: str | None
    status: str
    roles: list[str]
    joined_at: datetime


class MemberInvite(ORMModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=150)
    role: Literal["ROLE_RECRUITER", "ROLE_COMPANY_ADMIN"]
    position: OptStr = Field(default=None, max_length=100)


class CompanyWorkspace(ORMModel):
    company: CompanyRead
    can_edit: bool
    can_manage_members: bool
