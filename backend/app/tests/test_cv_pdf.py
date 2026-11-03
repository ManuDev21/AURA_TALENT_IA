import io

import pdfplumber

from app.reports.cv_pdf import render_cv_pdf

SECTIONS = [
    {
        "section_type": "header",
        "content": {"full_name": "Ana Pérez", "headline": "Data Analyst", "links": []},
    },
    {"section_type": "summary", "title": "Perfil", "content": {"text": "Analista de datos."}},
    {
        "section_type": "experience",
        "title": "Experiencia",
        "content": {
            "items": [
                {"title": "Analista", "company": "Acme", "start": "2023-01", "achievements": ["Logro uno"]}
            ]
        },
    },
    {
        "section_type": "education",
        "title": "Educación",
        "content": {"items": [{"institution": "UNAM", "degree": "Actuaría"}]},
    },
    {
        "section_type": "languages",
        "title": "Idiomas",
        "content": {"items": [{"language": "Inglés", "level": "B2"}]},
    },
    {"section_type": "custom", "title": "Oculta", "is_visible": False, "content": {"text": "No debe salir"}},
]


def _text(template: str) -> tuple[int, str]:
    with pdfplumber.open(io.BytesIO(render_cv_pdf(SECTIONS, template))) as pdf:
        return len(pdf.pages), "\n".join(p.extract_text() or "" for p in pdf.pages)


def test_short_cv_fits_one_page_with_all_visible_sections() -> None:
    for template in ("aura-classic", "aura-modern"):
        pages, text = _text(template)
        assert pages == 1, f"{template}: las secciones no deben forzar saltos de pagina"
        for expected in ("Ana Pérez", "EXPERIENCIA", "EDUCACIÓN", "IDIOMAS", "Actuaría", "Logro uno"):
            assert expected in text
        assert "No debe salir" not in text


def test_text_is_ats_readable() -> None:
    _, text = _text("aura-classic")
    assert "(cid:" not in text
