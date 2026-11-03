import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, Self

from pydantic import BaseModel, Field, model_validator

QuestionType = Literal[
    "likert", "multiple_choice", "true_false", "scenario", "reasoning", "situational", "code"
]
TypeCode = Literal[
    "cognitive",
    "logical",
    "verbal",
    "numerical",
    "technical",
    "situational",
    "language",
    "orientation",
    "psychometric",
]


# ------------------------------------------------------------ candidato
class LastAttempt(BaseModel):
    id: uuid.UUID
    status: str
    overall_score: Decimal | None
    submitted_at: datetime | None


class PendingAssignment(BaseModel):
    id: uuid.UUID
    company_name: str
    job_title: str | None
    due_at: datetime | None


class CatalogItem(BaseModel):
    assessment_id: uuid.UUID
    version_id: uuid.UUID
    code: str
    title: str
    description: str | None
    type_code: str
    type_name: str
    is_experimental: bool
    question_count: int
    time_limit_seconds: int | None
    last_attempt: LastAttempt | None
    pending_assignments: list[PendingAssignment]


class VersionIntro(BaseModel):
    version_id: uuid.UUID
    version_no: int
    title: str
    description: str | None
    type_code: str
    is_experimental: bool
    instructions: str | None
    consent_text: str | None
    limitations_text: str | None
    disclaimer_text: str | None
    time_limit_seconds: int | None
    question_count: int
    requires_consent: bool


class AttemptStart(BaseModel):
    version_id: uuid.UUID
    consent: bool = False
    assignment_id: uuid.UUID | None = None


class OptionOut(BaseModel):
    id: uuid.UUID
    label: str


class ScaleOut(BaseModel):
    min: int
    max: int
    labels: dict[str, str]


class QuestionOut(BaseModel):
    id: uuid.UUID
    question_type: str
    stem: str
    context: dict[str, Any] | None
    options: list[OptionOut]
    scale: ScaleOut | None


class SavedAnswer(BaseModel):
    option_id: uuid.UUID | None
    numeric_value: Decimal | None


class AttemptSession(BaseModel):
    attempt_id: uuid.UUID
    status: str
    version_id: uuid.UUID
    title: str
    type_code: str
    is_experimental: bool
    started_at: datetime
    expires_at: datetime | None
    share_with_company: bool
    assignment_company: str | None
    questions: list[QuestionOut]
    answers: dict[str, SavedAnswer]


class AnswerIn(BaseModel):
    question_id: uuid.UUID
    option_id: uuid.UUID | None = None
    numeric_value: Decimal | None = Field(default=None, ge=0, le=100)
    time_ms: int | None = Field(default=None, ge=0, le=3_600_000)

    @model_validator(mode="after")
    def _one(self) -> Self:
        if (self.option_id is None) == (self.numeric_value is None):
            raise ValueError("Indica una opcion o un valor de la escala")
        return self


class AttemptSummary(BaseModel):
    id: uuid.UUID
    title: str
    type_code: str
    is_experimental: bool
    status: str
    started_at: datetime
    submitted_at: datetime | None
    overall_score: Decimal | None
    share_with_company: bool
    assignment_company: str | None


class DimensionResult(BaseModel):
    code: str
    name: str
    description: str | None
    score: Decimal
    band: str
    interpretation: str
    evidence: list[dict[str, Any]]
    recommendations: list[str]


class ResultExplanation(BaseModel):
    method: str
    data_used: list[str]
    limitations: list[str]


class AttemptResult(BaseModel):
    attempt_id: uuid.UUID
    title: str
    type_code: str
    is_experimental: bool
    version_no: int
    submitted_at: datetime | None
    duration_seconds: int | None
    overall_score: Decimal | None
    overall_band: str | None
    summary: str | None
    recommendations: list[str]
    dimensions: list[DimensionResult]
    review: list[dict[str, Any]]
    quality_notes: list[str]
    disclaimer: str
    explanation: ResultExplanation
    share_with_company: bool
    assignment_company: str | None


class ShareUpdate(BaseModel):
    share_with_company: bool


# --------------------------------------------------------------- empresa
class AssignmentCreate(BaseModel):
    version_id: uuid.UUID
    application_id: uuid.UUID
    due_at: datetime | None = None


class SharedResult(BaseModel):
    overall_score: Decimal | None
    overall_band: str | None
    summary: str | None
    dimensions: list[DimensionResult]
    quality_notes: list[str]
    disclaimer: str


class CompanyAssessmentView(BaseModel):
    assignment_id: uuid.UUID
    version_id: uuid.UUID
    title: str
    type_code: str
    is_experimental: bool
    status: str
    due_at: datetime | None
    created_at: datetime
    shared: bool
    result: SharedResult | None


class AssignableVersion(BaseModel):
    version_id: uuid.UUID
    title: str
    type_code: str
    is_experimental: bool
    question_count: int


# ---------------------------------------------------------- administracion
class VersionBrief(BaseModel):
    id: uuid.UUID
    version_no: int
    status: str
    published_at: datetime | None
    question_count: int
    attempts: int


class InstrumentSummary(BaseModel):
    id: uuid.UUID
    code: str
    title: str
    type_code: str
    is_experimental: bool
    license_type: str
    versions: list[VersionBrief]


class ImportOption(BaseModel):
    label: str = Field(min_length=1, max_length=1000)
    is_correct: bool | None = None
    rubric_score: Decimal | None = None
    rubric_rationale: str | None = None


class ImportQuestion(BaseModel):
    dimension_code: str | None = None
    question_type: QuestionType
    stem: str = Field(min_length=3, max_length=4000)
    reverse_keyed: bool = False
    weight: Decimal = Field(default=Decimal("1"), gt=0, le=10)
    is_attention_check: bool = False
    expected_value: Decimal | None = None
    explanation: str | None = None
    options: list[ImportOption] = Field(default_factory=list, max_length=10)


class ImportDimension(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9_]{2,50}$")
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    construct_definition: str | None = None


class ImportRule(BaseModel):
    dimension_code: str | None = None
    method: Literal["sum", "mean", "weighted_mean", "correct_count", "rubric"]
    params: dict[str, Any] = Field(default_factory=dict)


class ImportBand(BaseModel):
    dimension_code: str | None = None
    min_score: Decimal = Field(ge=0, le=100)
    max_score: Decimal = Field(ge=0, le=100)
    band: Literal["low", "moderate", "high"]
    text_template: str = Field(min_length=3, max_length=2000)
    recommendations: list[str] = Field(default_factory=list, max_length=10)


class ImportVersion(BaseModel):
    time_limit_seconds: int | None = Field(default=None, gt=0, le=14_400)
    instructions: str | None = None
    consent_text: str | None = None
    limitations_text: str | None = None
    disclaimer_text: str | None = None
    randomize_questions: bool = False
    dimensions: list[ImportDimension] = Field(default_factory=list, max_length=20)
    questions: list[ImportQuestion] = Field(min_length=1, max_length=200)
    scoring: list[ImportRule] = Field(min_length=1, max_length=25)
    interpretation: list[ImportBand] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def _consistency(self) -> Self:
        codes = {d.code for d in self.dimensions}
        for q in self.questions:
            if q.dimension_code and q.dimension_code not in codes:
                raise ValueError(f"Dimension desconocida en pregunta: {q.dimension_code}")
            if q.question_type != "likert" and not q.options:
                raise ValueError("Las preguntas que no son Likert necesitan opciones")
            if q.is_attention_check and q.expected_value is None:
                raise ValueError("Las preguntas de control necesitan expected_value")
        for item in [*self.scoring, *self.interpretation]:
            if item.dimension_code and item.dimension_code not in codes:
                raise ValueError(f"Dimension desconocida: {item.dimension_code}")
        return self


class InstrumentImport(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9-]{3,60}$")
    title: str = Field(min_length=3, max_length=200)
    description: str | None = None
    type_code: TypeCode
    is_experimental: bool = True
    license_type: Literal["original", "licensed"] = "original"
    license_ref: str | None = None
    version: ImportVersion

    @model_validator(mode="after")
    def _license(self) -> Self:
        if self.license_type == "licensed" and not self.license_ref:
            raise ValueError("Los instrumentos licenciados requieren la referencia de la licencia")
        return self
