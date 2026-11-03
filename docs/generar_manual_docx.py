"""Convierte docs/MANUAL.md en docs/MANUAL.docx (titulos, tablas, listas, codigo e imagenes reales).

Uso (desde la raiz del proyecto o desde docs/):
    backend\\.venv\\Scripts\\python docs/generar_manual_docx.py
"""

import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor

DOCS = Path(__file__).parent
MD = DOCS / "MANUAL.md"
OUT = DOCS / "MANUAL.docx"
MAX_IMG_CM = 16.0

ORANGE = RGBColor(0xE8, 0x7A, 0x1E)
GRAY = RGBColor(0x66, 0x66, 0x66)

BOLD = re.compile(r"\*\*(.+?)\*\*")
CODE = re.compile(r"`([^`]+)`")
IMG = re.compile(r"^!\[(.*?)\]\((.*?)\)\s*$")


def add_runs(par, text: str) -> None:
    """Negritas **así** y codigo `asi` dentro de un parrafo."""
    pos = 0
    for m in re.finditer(r"(\*\*.+?\*\*|`[^`]+`)", text):
        if m.start() > pos:
            par.add_run(text[pos : m.start()])
        token = m.group(0)
        if token.startswith("**"):
            run = par.add_run(token[2:-2])
            run.bold = True
        else:
            run = par.add_run(token[1:-1])
            run.font.name = "Consolas"
            run.font.size = Pt(9)
        pos = m.end()
    if pos < len(text):
        par.add_run(text[pos:])


def flush_table(doc: Document, rows: list[list[str]]) -> None:
    if len(rows) < 2:
        return
    header, body = rows[0], rows[2:]  # la fila 1 es el separador |---|
    table = doc.add_table(rows=len(body) + 1, cols=len(header))
    table.style = "Light Grid Accent 1"
    for j, cell in enumerate(header):
        run = table.rows[0].cells[j].paragraphs[0].add_run(cell)
        run.bold = True
    for i, row in enumerate(body, start=1):
        for j, cell in enumerate(row):
            table.rows[i].cells[j].paragraphs[0].add_run(cell)
    doc.add_paragraph()


def main() -> None:
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    table_rows: list[list[str]] = []
    in_code = False
    in_toc = False
    title_done = False

    for raw in MD.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()

        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            par = doc.add_paragraph()
            run = par.add_run(line if line.strip() else " ")
            run.font.name = "Consolas"
            run.font.size = Pt(9)
            par.paragraph_format.left_indent = Cm(0.8)
            continue

        if line.strip().startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            table_rows.append(cells)
            continue
        if table_rows:
            flush_table(doc, table_rows)
            table_rows = []

        if not line.strip():
            in_toc = False
            continue
        if in_toc:  # tabla de contenidos del md: no se copia, Word la genera sola
            continue
        if line.startswith("## Contenido"):
            in_toc = True
            continue

        img = IMG.match(line.strip())
        if img:
            alt, rel = img.group(1), img.group(2)
            path = DOCS / rel
            if path.exists():
                doc.add_picture(str(path), width=Cm(MAX_IMG_CM))
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
                cap = doc.add_paragraph()
                cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = cap.add_run(alt)
                run.italic = True
                run.font.size = Pt(9)
                run.font.color.rgb = GRAY
            continue

        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            text = line.lstrip("#").strip()
            if level == 1 and not title_done:
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = p.add_run(text)
                run.bold = True
                run.font.size = Pt(26)
                run.font.color.rgb = ORANGE
                title_done = True
            else:
                doc.add_heading(text, level=min(level, 4))
            continue

        if line.strip() == "---":
            continue
        if line.strip().startswith(">"):
            par = doc.add_paragraph()
            par.paragraph_format.left_indent = Cm(0.8)
            add_runs(par, line.strip().lstrip(">").strip())
            for run in par.runs:
                run.italic = True
            continue
        if re.match(r"^\s*-\s+\[[ x]\]", line):
            doc.add_paragraph(line.split("]", 1)[1].strip(), style="List Bullet")
            continue
        if re.match(r"^\s*[-*]\s", line):
            par = doc.add_paragraph(style="List Bullet")
            add_runs(par, re.sub(r"^\s*[-*]\s", "", line))
            continue
        if re.match(r"^\s*\d+\.\s", line):
            par = doc.add_paragraph(style="List Number")
            add_runs(par, re.sub(r"^\s*\d+\.\s", "", line))
            continue

        par = doc.add_paragraph()
        add_runs(par, line)

    if table_rows:
        flush_table(doc, table_rows)

    doc.core_properties.title = "AURA TALENT AI - Manual de usuario e instalacion"
    doc.core_properties.author = "AURA TALENT AI"
    doc.save(OUT)
    check = Document(OUT)
    imgs = len(check.inline_shapes)
    print(f"{OUT.name}: {len(check.paragraphs)} parrafos, {imgs} imagenes, "
          f"{OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
