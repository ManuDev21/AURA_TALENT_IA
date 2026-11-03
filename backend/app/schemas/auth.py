import re
from typing import Literal, Self

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.user import UserMe

_HAS_LETTER = re.compile(r"[A-Za-z]")
_HAS_DIGIT = re.compile(r"\d")


def _validate_password_strength(value: str) -> str:
    if not (_HAS_LETTER.search(value) and _HAS_DIGIT.search(value)):
        raise ValueError("La contrasena debe incluir al menos una letra y un numero")
    return value


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str = Field(min_length=2, max_length=150)
    account_type: Literal["candidate", "company"]
    company_name: str | None = Field(default=None, min_length=2, max_length=150)
    accept_terms: bool
    accept_privacy: bool

    _password = field_validator("password")(_validate_password_strength)

    @field_validator("full_name", "company_name")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if value else value

    @model_validator(mode="after")
    def _check_rules(self) -> Self:
        if not (self.accept_terms and self.accept_privacy):
            raise ValueError("Debes aceptar los terminos y la politica de privacidad")
        if self.account_type == "company" and not self.company_name:
            raise ValueError("El nombre de la empresa es obligatorio para cuentas de empresa")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleAuthRequest(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, max_length=150)
    account_type: Literal["candidate", "company"] = "candidate"
    company_name: str | None = Field(default=None, min_length=2, max_length=150)
    google_sub: str | None = Field(default=None, max_length=128)
    credential: str | None = Field(default=None, max_length=4096)
    access_token: str | None = Field(default=None, max_length=4096)
    accept_terms: bool
    accept_privacy: bool
    accept_opensource_disclaimer: bool = True

    @field_validator("full_name", "company_name")
    @classmethod
    def _strip_google(cls, value: str | None) -> str | None:
        return value.strip() if value else value

    @model_validator(mode="after")
    def _check_google_rules(self) -> Self:
        if not (self.accept_terms and self.accept_privacy and self.accept_opensource_disclaimer):
            raise ValueError(
                "Debes aceptar los terminos, el aviso de privacidad y el deslinde tecnologico Open Source"
            )
        if not (self.credential or self.access_token or self.email):
            raise ValueError("Se requiere un token OAuth de Google o un correo verificado")
        if self.account_type == "company" and not self.company_name:
            raise ValueError("El nombre de la empresa es obligatorio para cuentas de empresa")
        return self


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=10, max_length=128)

    _password = field_validator("new_password")(_validate_password_strength)


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserMe


class MessageResponse(BaseModel):
    message: str
