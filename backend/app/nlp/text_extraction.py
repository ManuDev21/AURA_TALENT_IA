import io

import pdfplumber
from docx import Document

MAX_PAGES = 10


def extract_text(data: bytes, mime_type: str) -> tuple[str, int]:
    """Devuelve (texto, paginas). Solo lee el texto; no ejecuta contenido embebido."""
    if mime_type == "application/pdf":
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages[:MAX_PAGES]]
            return "\n".join(pages), len(pdf.pages)

    document = Document(io.BytesIO(data))
    lines = [p.text for p in document.paragraphs]
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                lines.append(" | ".join(dict.fromkeys(cells)))
    return "\n".join(lines), 1
