"""Exportacion de CV a PDF.

Genera texto real (seleccionable) en una sola columna, compatible con sistemas ATS.
"""

import io
from dataclasses import dataclass
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer

MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


@dataclass(frozen=True)
class Theme:
    accent: colors.Color
    text: colors.Color
    muted: colors.Color
    rule: colors.Color


THEMES = {
    "aura-classic": Theme(
        colors.HexColor("#1a1a21"),
        colors.HexColor("#1a1a21"),
        colors.HexColor("#55555f"),
        colors.HexColor("#c9c9d1"),
    ),
    "aura-modern": Theme(
        colors.HexColor("#e0590a"),
        colors.HexColor("#17171c"),
        colors.HexColor("#5b5b66"),
        colors.HexColor("#f2b07e"),
    ),
    # Harvard: todo en negro tipografico con encabezado centrado y reglas finas.
    "harvard": Theme(
        colors.HexColor("#111111"),
        colors.HexColor("#1a1a21"),
        colors.HexColor("#4b4b55"),
        colors.HexColor("#111111"),
    ),
}


def _month(value: str | None) -> str:
    if not value:
        return ""
    year, month = value.split("-")
    return f"{MONTHS[int(month) - 1]} {year}"


def _range(start: str | None, end: str | None, current: bool) -> str:
    first, last = _month(start), ("actualidad" if current else _month(end))
    return f"{first} - {last}" if first and last else first or last


def _t(value: Any) -> str:
    return escape(str(value)) if value else ""


class _Styles:
    def __init__(self, theme: Theme) -> None:
        base: dict[str, Any] = {"fontName": "Helvetica", "textColor": theme.text, "alignment": TA_LEFT}

        def style(name: str, **overrides: Any) -> ParagraphStyle:
            return ParagraphStyle(name, **{**base, **overrides})

        bold = "Helvetica-Bold"
        self.name = style("name", fontName=bold, fontSize=20, leading=24)
        self.headline = style("headline", textColor=theme.accent, fontSize=11, leading=14)
        self.contact = style("contact", textColor=theme.muted, fontSize=8.5, leading=11)
        self.section = style(
            "section",
            textColor=theme.accent,
            fontName=bold,
            fontSize=10.5,
            leading=13,
            spaceBefore=9,
            spaceAfter=2,
        )
        self.item_title = style("item", fontName=bold, fontSize=9.5, leading=12)
        self.meta = style("meta", textColor=theme.muted, fontSize=8.5, leading=11)
        self.body = style("body", fontSize=9, leading=12)
        self.bullet = style("bullet", fontSize=9, leading=12, leftIndent=11, bulletIndent=2)
        # Variantes centradas (plantilla Harvard).
        self.name_center = style("name_center", fontName=bold, fontSize=20, leading=24, alignment=TA_CENTER)
        self.headline_center = style(
            "headline_center", textColor=theme.accent, fontSize=11, leading=14, alignment=TA_CENTER
        )
        self.contact_center = style(
            "contact_center", textColor=theme.muted, fontSize=8.5, leading=11, alignment=TA_CENTER
        )


def render_cv_pdf(sections: list[dict[str, Any]], template: str = "aura-classic", title: str = "CV") -> bytes:
    theme = THEMES.get(template, THEMES["aura-classic"])
    s = _Styles(theme)
    story: list[Any] = []

    for section in sections:
        if not section.get("is_visible", True):
            continue
        kind = section["section_type"]
        content = section.get("content") or {}

        if kind == "header":
            centered = template == "harvard"
            story.append(Paragraph(_t(content.get("full_name")), s.name_center if centered else s.name))
            if content.get("headline"):
                story.append(
                    Paragraph(_t(content["headline"]), s.headline_center if centered else s.headline)
                )
            contact = [content.get("email"), content.get("phone"), content.get("location")]
            contact += [f"{link['label']}: {link['url']}" for link in content.get("links", [])]
            if any(contact):
                story.append(Spacer(1, 3))
                story.append(
                    Paragraph(
                        " | ".join(_t(c) for c in contact if c),
                        s.contact_center if centered else s.contact,
                    )
                )
            if centered:
                story.append(Spacer(1, 2))
                story.append(HRFlowable(width="100%", thickness=1.1, color=theme.rule, spaceAfter=6))
            story.append(Spacer(1, 4))
            continue

        blocks = _section_blocks(kind, content, s)
        if not blocks:
            continue
        heading = [
            Paragraph(_t((section.get("title") or kind).upper()), s.section),
            HRFlowable(width="100%", thickness=0.6, color=theme.rule, spaceAfter=4),
        ]
        # El titulo nunca queda huerfano al final de la pagina: viaja con el primer bloque.
        # Los KeepTogether no se anidan (anidarlos fuerza saltos de pagina).
        story.append(KeepTogether(heading + blocks[0]))
        story.extend(KeepTogether(block) for block in blocks[1:])

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=title,
        author="AURA TALENT AI",
        subject="Curriculum vitae",
    )
    doc.build(story or [Paragraph("CV vacio", s.body)])
    return buffer.getvalue()


def _bullets(items: list[str], s: _Styles) -> list[Paragraph]:
    # U+2022 se codifica sin mapa Unicode en las fuentes estandar y los ATS lo leen como basura;
    # el punto medio (Latin-1) se extrae correctamente.
    return [Paragraph(_t(i), s.bullet, bulletText="\u00b7") for i in items]


def _section_blocks(kind: str, content: dict[str, Any], s: _Styles) -> list[list[Any]]:
    out: list[list[Any]] = []
    if kind in {"summary", "custom"}:
        text = (content.get("text") or "").strip()
        return [[Paragraph(_t(text).replace("\n", "<br/>"), s.body)]] if text else []

    if kind == "skills":
        lines = [
            Paragraph(f"<b>{_t(group['category'])}:</b> {_t(', '.join(group['skills']))}", s.body)
            for group in content.get("groups", [])
            if group.get("skills")
        ]
        return [lines] if lines else []

    for item in content.get("items", []):
        block: list[Any] = []
        if kind == "experience":
            block.append(
                Paragraph(
                    f"{_t(item.get('title'))}  <font color='#777777'>|</font>  {_t(item.get('company'))}",
                    s.item_title,
                )
            )
            meta = [
                _range(item.get("start"), item.get("end"), item.get("current", False)),
                item.get("location"),
            ]
            block.append(Paragraph(_t(" / ".join(m for m in meta if m)), s.meta))
            if item.get("description"):
                block.append(Paragraph(_t(item["description"]), s.body))
            if item.get("achievements"):
                block.extend(_bullets(item["achievements"], s))
        elif kind == "education":
            degree = " - ".join(p for p in (item.get("degree"), item.get("field")) if p)
            block.append(Paragraph(_t(degree or item.get("institution")), s.item_title))
            meta = [
                item.get("institution") if degree else None,
                _range(item.get("start"), item.get("end"), item.get("current", False)),
            ]
            block.append(Paragraph(_t(" / ".join(m for m in meta if m)), s.meta))
            if item.get("description"):
                block.append(Paragraph(_t(item["description"]), s.body))
        elif kind == "projects":
            role = f" <font color='#777777'>|</font> {_t(item['role'])}" if item.get("role") else ""
            block.append(Paragraph(f"{_t(item.get('title'))}{role}", s.item_title))
            if item.get("description"):
                block.append(Paragraph(_t(item["description"]), s.body))
            extra = []
            if item.get("technologies"):
                extra.append("Tecnologías: " + ", ".join(item["technologies"]))
            if item.get("url"):
                extra.append(item["url"])
            if extra:
                block.append(Paragraph(_t(" / ".join(extra)), s.meta))
        elif kind == "certifications":
            meta = " / ".join(p for p in (item.get("issuer"), _month(item.get("date"))) if p)
            block.append(Paragraph(f"<b>{_t(item.get('name'))}</b>{'  ' + _t(meta) if meta else ''}", s.body))
        elif kind == "languages":
            level = f" - {_t(item['level'])}" if item.get("level") else ""
            block.append(Paragraph(f"<b>{_t(item.get('language'))}</b>{level}", s.body))
        elif kind in {"links", "portfolio"}:
            block.append(Paragraph(f"<b>{_t(item.get('label'))}:</b> {_t(item.get('url'))}", s.body))
        if block:
            block.append(Spacer(1, 4))
            out.append(block)
    return out
