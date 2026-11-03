from datetime import date
from typing import Annotated

from pydantic import AfterValidator, AnyHttpUrl, BaseModel, BeforeValidator, ConfigDict, Field, TypeAdapter


def _strip_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _clean_list(values: list[str]) -> list[str]:
    seen: list[str] = []
    for raw in values:
        item = raw.strip()
        if item and item.lower() not in {s.lower() for s in seen}:
            seen.append(item)
    return seen


OptStr = Annotated[str | None, AfterValidator(_strip_or_none)]
TagList = Annotated[
    list[Annotated[str, Field(max_length=80)]], Field(max_length=15), AfterValidator(_clean_list)
]


_HTTP_URL = TypeAdapter(AnyHttpUrl)


def _validate_url(value: object) -> str | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    return str(_HTTP_URL.validate_python(value.strip() if isinstance(value, str) else value))


HttpUrlStr = Annotated[str | None, BeforeValidator(_validate_url), Field(max_length=500)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def check_date_range(start: date | None, end: date | None, label: str = "La fecha de fin") -> None:
    if start and end and end < start:
        raise ValueError(f"{label} no puede ser anterior a la fecha de inicio")
