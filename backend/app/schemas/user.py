import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RoleAssignment(BaseModel):
    code: str
    company_id: uuid.UUID | None


class UserMe(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    locale: str
    status: str
    roles: list[RoleAssignment]
    permissions: list[str]
    created_at: datetime
    last_login_at: datetime | None


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    locale: str | None = Field(default=None, pattern=r"^(es|en)$")


class ConsentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    consent_type: str
    policy_version: str
    granted: bool
    granted_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    module: str
    description: str | None


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    description: str | None
    permissions: list[PermissionRead]
