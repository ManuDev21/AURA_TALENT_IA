"""Generadores de reportes: PDF (ReportLab) y Excel (openpyxl) a partir de una estructura comun.

Estructura: titulo, subtitulo, indicadores (KPI) y secciones con tablas o vinetas.
"""

import io
from dataclasses import dataclass, field
from datetime import datetime
from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ORANGE = colors.HexColor("#E8650A")
INK = colors.HexColor("#1B1B1F")
MUTED = colors.HexColor("#5A5A63")
LINE = colors.HexColor("#E3E0DA")


@dataclass
class Section:
    title: str
    headers: list[str] = field(default_factory=list)
    rows: list[list[object]] = field(default_factory=list)
    bullets: list[str] = field(default_factory=list)
    note: str | None = None


@dataclass
class ReportDoc:
    title: str
    subtitle: str
    kpis: list[tuple[str, str]]
    sections: list[Section]
    footer: str = (
        "Generado por AURA TALENT AI. Los indicadores son apoyo para decisiones humanas; ninguna decision de "
        "contratacion se toma automaticamente."
    )


def _p(text: object, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(str(text)), style)


def render_pdf(doc: ReportDoc) -> bytes:
    buf = io.BytesIO()
    pdf = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=doc.title,
        author="AURA TALENT AI",
    )
    h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=INK)
    sub = ParagraphStyle("sub", fontName="Helvetica", fontSize=9.5, leading=13, textColor=MUTED)
    h2 = ParagraphStyle(
        "h2", fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=ORANGE, spaceBefore=10
    )
    body = ParagraphStyle("body", fontName="Helvetica", fontSize=9, leading=12, textColor=INK)
    small = ParagraphStyle("small", parent=body, fontSize=7.5, leading=10, textColor=MUTED)
    cell = ParagraphStyle("cell", parent=body, fontSize=8.5, leading=11)
    head = ParagraphStyle("head", parent=cell, fontName="Helvetica-Bold", textColor=colors.white)

    story: list = [_p(doc.title, h1), _p(doc.subtitle, sub), Spacer(1, 8)]
    if doc.kpis:
        kpi_cells = [
            [
                Paragraph(
                    f"<font size=15 color='#E8650A'><b>{escape(v)}</b></font><br/>"
                    f"<font size=7.5 color='#5A5A63'>{escape(k)}</font>",
                    body,
                )
                for k, v in doc.kpis
            ]
        ]
        t = Table(kpi_cells, colWidths=[(pdf.width) / len(doc.kpis)] * len(doc.kpis))
        t.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story += [t, Spacer(1, 4)]
    for s in doc.sections:
        story.append(_p(s.title, h2))
        if s.rows:
            data = [[_p(h, head) for h in s.headers]] + [[_p(c, cell) for c in r] for r in s.rows]
            t = Table(data, repeatRows=1, colWidths=[pdf.width / len(s.headers)] * len(s.headers))
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), INK),
                        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            story.append(t)
        elif not s.bullets:
            story.append(_p("Sin datos todavia.", small))
        for b in s.bullets:
            story.append(Paragraph(f"&middot; {escape(b)}", body))
        if s.note:
            story += [Spacer(1, 3), _p(s.note, small)]
    story += [Spacer(1, 14), _p(f"{doc.footer} Fecha: {datetime.now():%Y-%m-%d %H:%M}.", small)]
    pdf.build(story)
    return buf.getvalue()


def render_xlsx(doc: ReportDoc) -> bytes:
    wb = Workbook()
    summary = wb.active
    summary.title = "Resumen"
    summary.append([doc.title])
    summary["A1"].font = Font(bold=True, size=14, color="E8650A")
    summary.append([doc.subtitle])
    summary.append([])
    for k, v in doc.kpis:
        summary.append([k, v])
    summary.append([])
    summary.append([doc.footer])
    summary.column_dimensions["A"].width = 42
    summary.column_dimensions["B"].width = 22
    used: set[str] = set()
    for s in doc.sections:
        if not s.rows:
            continue
        name = s.title[:28]
        while name in used:
            name = name[:26] + str(len(used))
        used.add(name)
        ws = wb.create_sheet(name)
        ws.append(s.headers)
        for c in ws[1]:
            c.font = Font(bold=True, color="FFFFFF")
            c.fill = PatternFill("solid", fgColor="1B1B1F")
            c.alignment = Alignment(vertical="center")
        for r in s.rows:
            ws.append(list(r))
        for i, h in enumerate(s.headers, start=1):
            width = max([len(str(h))] + [len(str(r[i - 1])) for r in s.rows]) + 2
            ws.column_dimensions[get_column_letter(i)].width = min(60, width)
        ws.freeze_panes = "A2"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
