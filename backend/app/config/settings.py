from functools import lru_cache
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AURA TALENT AI"
    environment: Literal["development", "test", "production"] = "development"

    database_url_raw: SecretStr | None = Field(default=None, alias="DATABASE_URL")
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "aura_talent"
    db_user: str = "aura_app"
    db_password: SecretStr | None = Field(default=None)
    db_ssl: bool = False
    db_echo: bool = False

    jwt_secret: SecretStr
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    password_reset_minutes: int = 30

    login_max_attempts: int = 5
    login_lock_minutes: int = 15
    rate_limit_enabled: bool = True

    cors_origins: str = "http://localhost:5173"
    frontend_url: str = "http://localhost:5173"
    cookie_secure: bool = False

    policy_version: str = "2026-09"
    ai_provider: Literal["ollama", "gemini"] = "ollama"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "aura-talent-ai"
    ollama_base_model: str = "qwen2.5:3b"
    gemini_api_key: SecretStr | None = Field(default=None)
    gemini_model: str = "gemini-3.5-flash-lite"

    @field_validator("jwt_secret")
    @classmethod
    def _jwt_secret_strength(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET debe tener al menos 32 caracteres")
        return value

    @model_validator(mode="after")
    def _production_safety(self) -> "Settings":
        """Valida credenciales de BD y exige HTTPS en cookies y origenes en produccion."""
        if self.database_url_raw is None and self.db_password is None:
            raise ValueError("Debes definir DB_PASSWORD o DATABASE_URL")
        if self.environment == "production":
            problems = []
            if not self.cookie_secure:
                problems.append("COOKIE_SECURE debe ser true")
            if not self.frontend_url.startswith("https://"):
                problems.append("FRONTEND_URL debe usar https://")
            if any(not o.startswith("https://") for o in self.cors_origin_list):
                problems.append("CORS_ORIGINS solo admite origenes https://")
            if problems:
                raise ValueError("Configuracion insegura para produccion: " + "; ".join(problems))
        return self

    @field_validator("gemini_api_key", "database_url_raw", "db_password", mode="before")
    @classmethod
    def _empty_as_none(cls, value: object) -> object:
        return value or None

    @property
    def uses_ssl(self) -> bool:
        if self.db_ssl:
            return True
        if self.database_url_raw is not None:
            raw = self.database_url_raw.get_secret_value()
            params = dict(parse_qsl(urlsplit(raw).query))
            return params.get("sslmode", "").lower() in {"require", "verify-ca", "verify-full"}
        return False

    @property
    def database_url(self) -> URL | str:
        if self.database_url_raw is not None:
            raw = self.database_url_raw.get_secret_value().strip()
            if raw.startswith("postgres://"):
                raw = "postgresql+asyncpg://" + raw[len("postgres://") :]
            elif raw.startswith("postgresql://"):
                raw = "postgresql+asyncpg://" + raw[len("postgresql://") :]
            parts = urlsplit(raw)
            # asyncpg no acepta sslmode/channel_binding como query params; se pasan via connect_args
            clean_query = urlencode(
                [(k, v) for k, v in parse_qsl(parts.query) if k.lower() not in {"sslmode", "channel_binding"}]
            )
            return urlunsplit((parts.scheme, parts.netloc, parts.path, clean_query, parts.fragment))
        assert self.db_password is not None
        return URL.create(
            "postgresql+asyncpg",
            username=self.db_user,
            password=self.db_password.get_secret_value(),
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
