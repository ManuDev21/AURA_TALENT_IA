"""Extraccion de informacion de CV basada en reglas (es/en).

Cada dato detectado incluye `confidence` (0-1) y `evidence` (fragmento del texto original).
El parser NUNCA completa datos que no estan en el documento: si no encuentra un valor,
lo deja vacio para que la persona lo revise.
"""

import re
import unicodedata
from dataclasses import dataclass
from typing import Any

# ------------------------------------------------------------------ utilidades
BULLET = re.compile(r"^\s*[\u2022\u25aa\u25cf\u00b7\-\*\u2013>]+\s*")
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE = re.compile(r"(?<!\w)(\+?\d[\d\s().-]{8,}\d)(?!\w)")
URL = re.compile(
    r"(https?://[^\s|,;]+|www\.[^\s|,;]+|(?:linkedin\.com|github\.com|gitlab\.com|behance\.net)/[^\s|,;]+)",
    re.I,
)

MONTHS = {
    "ene": 1,
    "enero": 1,
    "jan": 1,
    "january": 1,
    "feb": 2,
    "febrero": 2,
    "february": 2,
    "mar": 3,
    "marzo": 3,
    "march": 3,
    "abr": 4,
    "abril": 4,
    "apr": 4,
    "april": 4,
    "may": 5,
    "mayo": 5,
    "jun": 6,
    "junio": 6,
    "june": 6,
    "jul": 7,
    "julio": 7,
    "july": 7,
    "ago": 8,
    "agosto": 8,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "septiembre": 9,
    "setiembre": 9,
    "september": 9,
    "oct": 10,
    "octubre": 10,
    "october": 10,
    "nov": 11,
    "noviembre": 11,
    "november": 11,
    "dic": 12,
    "diciembre": 12,
    "dec": 12,
    "december": 12,
}
_MONTH_WORDS = "|".join(sorted(MONTHS, key=len, reverse=True))
_DATE = (
    rf"(?:(?:{_MONTH_WORDS})\.?\s+(?:de\s+)?(?:19|20)\d{{2}}|\d{{1,2}}[/.-](?:19|20)\d{{2}}|(?:19|20)\d{{2}})"
)
_PRESENT = r"(?:actualidad|actual|presente|present|hoy|now|current|la fecha)"
DATE_RANGE = re.compile(
    rf"(?P<start>{_DATE})\s*(?:-|\u2013|\u2014|a|al|to|hasta)\s*(?P<end>{_DATE}|{_PRESENT})", re.I
)

HEADINGS: dict[str, tuple[str, ...]] = {
    "summary": (
        "resumen",
        "perfil",
        "perfil profesional",
        "acerca de mi",
        "sobre mi",
        "summary",
        "profile",
        "about",
        "about me",
        "objetivo",
        "objetivo profesional",
        "objective",
    ),
    "experience": (
        "experiencia",
        "experiencia laboral",
        "experiencia profesional",
        "historial laboral",
        "experience",
        "work experience",
        "professional experience",
        "employment history",
    ),
    "education": (
        "educacion",
        "formacion",
        "formacion academica",
        "estudios",
        "education",
        "academic background",
    ),
    "skills": (
        "habilidades",
        "competencias",
        "conocimientos",
        "tecnologias",
        "habilidades tecnicas",
        "skills",
        "technical skills",
        "tech stack",
        "herramientas",
        "stack tecnologico",
    ),
    "languages": ("idiomas", "lenguas", "languages"),
    "certifications": (
        "certificaciones",
        "certificados",
        "cursos",
        "certifications",
        "courses",
        "licenses",
        "licencias y certificaciones",
        "cursos y certificaciones",
    ),
    "projects": ("proyectos", "projects", "proyectos personales", "portafolio"),
    "contact": ("contacto", "contact", "datos personales", "personal information", "informacion de contacto"),
}

LANGUAGE_NAMES = {
    "es": ("espanol", "castellano", "spanish"),
    "en": ("ingles", "english"),
    "pt": ("portugues", "portuguese"),
    "fr": ("frances", "french"),
    "de": ("aleman", "german"),
    "it": ("italiano", "italian"),
    "zh": ("chino", "mandarin", "chinese"),
    "ja": ("japones", "japanese"),
    "ko": ("coreano", "korean"),
}
LEVEL_WORDS: tuple[tuple[str, str], ...] = (
    ("nativo", "native"),
    ("lengua materna", "native"),
    ("native", "native"),
    ("bilingue", "C2"),
    ("fluido", "C1"),
    ("fluent", "C1"),
    ("avanzado", "C1"),
    ("advanced", "C1"),
    ("intermedio alto", "B2"),
    ("upper intermediate", "B2"),
    ("intermedio", "B1"),
    ("intermediate", "B1"),
    ("basico", "A2"),
    ("basic", "A2"),
    ("elementary", "A2"),
    ("principiante", "A1"),
    ("beginner", "A1"),
)
CEFR = re.compile(r"\b(A1|A2|B1|B2|C1|C2)\b")

EDUCATION_LEVELS: tuple[tuple[str, str], ...] = (
    ("doctor", "doctorate"),
    ("phd", "doctorate"),
    ("maestr", "master"),
    ("master", "master"),
    ("mba", "master"),
    ("licenciatura", "bachelor"),
    ("ingenier", "bachelor"),
    ("bachelor", "bachelor"),
    ("grado en", "bachelor"),
    ("tecnico", "technical"),
    ("tsu", "technical"),
    ("associate", "technical"),
    ("bootcamp", "bootcamp"),
    ("diplomado", "certificate"),
    ("bachillerato", "secondary"),
    ("preparatoria", "secondary"),
    ("high school", "secondary"),
)
INSTITUTION_HINT = re.compile(
    r"universidad|university|instituto|institute|college|escuela|school|tecnologico|politecnico|colegio|unam|ipn|itesm|uag",
    re.I,
)


def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower().strip()


def _snippet(text: str, start: int, end: int, pad: int = 50) -> str:
    return " ".join(text[max(0, start - pad) : min(len(text), end + pad)].split())


def parse_month(value: str) -> str | None:
    """Convierte 'mayo 2023', '05/2023' o '2023' a 'YYYY-MM-01'."""
    raw = normalize(value).rstrip(".")
    match = re.match(r"([a-z]{3,10})\.?\s+(?:de\s+)?((?:19|20)\d{2})", raw)
    if match and match.group(1) in MONTHS:
        return f"{match.group(2)}-{MONTHS[match.group(1)]:02d}-01"
    match = re.match(r"(\d{1,2})[/.-]((?:19|20)\d{2})", raw)
    if match and 1 <= int(match.group(1)) <= 12:
        return f"{match.group(2)}-{int(match.group(1)):02d}-01"
    match = re.search(r"((?:19|20)\d{2})", raw)
    return f"{match.group(1)}-01-01" if match else None


def _is_present(value: str) -> bool:
    return bool(re.fullmatch(_PRESENT, normalize(value)))


def heading_of(line: str) -> str | None:
    clean = normalize(BULLET.sub("", line)).strip(" :.-_|")
    if not clean or len(clean) > 40:
        return None
    for section, words in HEADINGS.items():
        if clean in words:
            return section
    return None


# ------------------------------------------------------------ segmentacion
def split_sections(lines: list[str]) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {"top": []}
    current = "top"
    for line in lines:
        section = heading_of(line)
        if section:
            current = section
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)
    return sections


@dataclass
class SkillTerm:
    term: str
    skill_id: str
    name: str
    category: str | None
    pattern: re.Pattern[str]


def build_skill_terms(catalog: list[dict[str, Any]]) -> list[SkillTerm]:
    """catalog: [{id, name, category, aliases: [...]}]"""
    terms: list[SkillTerm] = []
    for skill in catalog:
        for term in [skill["name"], *skill.get("aliases", [])]:
            pattern = re.compile(rf"(?<![A-Za-z0-9+#.]){re.escape(term)}(?![A-Za-z0-9+#])", re.I)
            terms.append(SkillTerm(term, str(skill["id"]), skill["name"], skill.get("category"), pattern))
    terms.sort(key=lambda t: len(t.term), reverse=True)
    return terms


# ------------------------------------------------------------------ parser
class CvParser:
    def __init__(self, skill_terms: list[SkillTerm]) -> None:
        self.skill_terms = skill_terms

    def parse(self, text: str, pages: int = 1) -> dict[str, Any]:
        lines = [ln.strip() for ln in text.replace("\r", "").split("\n")]
        lines = [ln for ln in lines if ln]
        sections = split_sections(lines)
        warnings: list[str] = []
        if len(text.strip()) < 200:
            warnings.append(
                "Se extrajo muy poco texto. Si el PDF es una imagen escaneada, AURA no puede leerlo; "
                "sube una version con texto seleccionable."
            )

        result = {
            "fields": self._contact_fields(text, sections),
            "links": self._links(text),
            "experiences": self._experiences(sections.get("experience", [])),
            "education": self._education(sections.get("education", [])),
            "skills": self._skills(text, sections),
            "languages": self._languages(sections.get("languages", []) or lines),
            "certifications": self._certifications(sections.get("certifications", [])),
            "sections_found": [s for s in sections if s != "top" and sections[s]],
            "warnings": warnings,
            "stats": {"characters": len(text), "pages": pages, "lines": len(lines)},
        }
        if not result["experiences"] and "experience" not in sections:
            warnings.append(
                "No se identifico una seccion de experiencia. Puedes agregarla manualmente en tu perfil."
            )
        return result

    # ---------------------------------------------------- datos de contacto
    def _contact_fields(self, text: str, sections: dict[str, list[str]]) -> dict[str, Any]:
        fields: dict[str, Any] = {}
        if m := EMAIL.search(text):
            fields["email"] = {
                "value": m.group(0),
                "confidence": 0.95,
                "evidence": _snippet(text, m.start(), m.end(), 20),
            }
        for m in PHONE.finditer(text):
            digits = re.sub(r"\D", "", m.group(1))
            if 10 <= len(digits) <= 15 and not DATE_RANGE.search(m.group(1)):
                fields["phone"] = {
                    "value": m.group(1).strip(),
                    "confidence": 0.8,
                    "evidence": m.group(1).strip(),
                }
                break

        top = sections.get("top", [])[:6]
        for index, line in enumerate(top):
            words = line.split()
            letters = sum(c.isalpha() or c.isspace() for c in line) / max(len(line), 1)
            if 2 <= len(words) <= 5 and letters > 0.9 and not EMAIL.search(line) and not URL.search(line):
                fields["full_name"] = {
                    "value": line.title() if line.isupper() else line,
                    "confidence": 0.6,
                    "evidence": line,
                }
                following = top[index + 1] if index + 1 < len(top) else ""
                if (
                    following
                    and len(following) <= 100
                    and not EMAIL.search(following)
                    and not PHONE.search(following)
                ):
                    fields["headline"] = {"value": following, "confidence": 0.45, "evidence": following}
                break

        summary_lines = sections.get("summary", [])
        if summary_lines:
            summary = " ".join(summary_lines)[:1500]
            fields["summary"] = {"value": summary, "confidence": 0.7, "evidence": summary[:160]}
        return fields

    def _links(self, text: str) -> list[dict[str, Any]]:
        found: dict[str, dict[str, Any]] = {}
        for m in URL.finditer(text):
            raw = m.group(0).rstrip(".)")
            url = raw if raw.lower().startswith("http") else f"https://{raw}"
            lower = url.lower()
            kind = next((k for k in ("github", "linkedin", "gitlab", "behance") if k in lower), "website")
            found.setdefault(lower, {"link_type": kind, "url": url, "confidence": 0.9, "evidence": raw})
        return list(found.values())[:8]

    # ------------------------------------------------------------ experiencia
    def _entries(self, lines: list[str]) -> list[tuple[list[str], re.Match[str] | None, str, list[str]]]:
        """Divide una seccion en entradas usando las lineas con rango de fechas como ancla."""
        anchors = [i for i, line in enumerate(lines) if DATE_RANGE.search(line)]
        if not anchors:
            return []
        header_start: list[int] = []
        for k, i in enumerate(anchors):
            start = i
            floor = anchors[k - 1] + 1 if k else 0
            for j in (i - 1, i - 2):
                if (
                    j >= floor
                    and len(lines[j]) <= 90
                    and not BULLET.match(lines[j])
                    and not lines[j].endswith(".")
                ):
                    start = j
                else:
                    break
            header_start.append(start)
        entries = []
        for k, i in enumerate(anchors):
            match = DATE_RANGE.search(lines[i])
            remainder = DATE_RANGE.sub("", lines[i]).strip(" |,-\u2013()")
            headers = lines[header_start[k] : i] + ([remainder] if remainder else [])
            end = header_start[k + 1] if k + 1 < len(anchors) else len(lines)
            body = lines[i + 1 : end]
            evidence = " ".join(lines[header_start[k] : min(end, i + 3)])[:300]
            entries.append((headers, match, evidence, body))
        return entries

    @staticmethod
    def _dates(match: re.Match[str] | None) -> tuple[str | None, str | None, bool]:
        if not match:
            return None, None, False
        current = _is_present(match.group("end"))
        return (
            parse_month(match.group("start")),
            None if current else parse_month(match.group("end")),
            current,
        )

    def _experiences(self, lines: list[str]) -> list[dict[str, Any]]:
        results = []
        for headers, match, evidence, body in self._entries(lines)[:15]:
            title, company = _split_title_company(headers)
            if not title:
                continue
            start, end, current = self._dates(match)
            achievements = [BULLET.sub("", ln) for ln in body if BULLET.match(ln)][:12]
            description = " ".join(ln for ln in body if not BULLET.match(ln))[:1500] or None
            results.append(
                {
                    "title": title[:200],
                    "company_name": company[:200],
                    "start_date": start,
                    "end_date": end,
                    "is_current": current,
                    "description": description,
                    "achievements": achievements,
                    "confidence": 0.7 if company and start else 0.45,
                    "evidence": evidence,
                }
            )
        return results

    # ------------------------------------------------------------- educacion
    def _education(self, lines: list[str]) -> list[dict[str, Any]]:
        results = []
        entries = self._entries(lines)
        if not entries and lines:
            # Sin rangos de fechas: cada linea con institucion reconocible es una entrada
            entries = [([ln], None, ln, []) for ln in lines if INSTITUTION_HINT.search(ln)]
        for headers, match, evidence, _ in entries[:10]:
            joined = " ".join(headers)
            institution = next(
                (h for h in headers if INSTITUTION_HINT.search(h)), headers[-1] if headers else ""
            )
            degree = next((h for h in headers if h != institution), None)
            level = next((lvl for key, lvl in EDUCATION_LEVELS if key in normalize(joined)), None)
            start, end, current = self._dates(match)
            if not institution:
                continue
            results.append(
                {
                    "institution": institution[:200],
                    "degree": degree[:200] if degree else None,
                    "level": level,
                    "start_date": start,
                    "end_date": end,
                    "is_current": current,
                    "confidence": 0.65 if INSTITUTION_HINT.search(institution) else 0.4,
                    "evidence": evidence,
                }
            )
        return results

    # ----------------------------------------------------------- habilidades
    def _skills(self, text: str, sections: dict[str, list[str]]) -> list[dict[str, Any]]:
        skills_text = "\n".join(sections.get("skills", []))
        by_skill: dict[str, list[SkillTerm]] = {}
        for term in self.skill_terms:
            by_skill.setdefault(term.skill_id, []).append(term)

        found: list[dict[str, Any]] = []
        for skill_terms in by_skill.values():
            # 1) La seccion de habilidades es la evidencia mas fuerte.
            # 2) Fuera de ella, los terminos muy cortos (JS, UI, Go) se ignoran por ambiguos.
            hit = next(
                ((t, m) for t in skill_terms if skills_text and (m := t.pattern.search(skills_text))), None
            )
            source, confidence = skills_text, 0.9
            if hit is None:
                hit = next(
                    ((t, m) for t in skill_terms if len(t.term) > 2 and (m := t.pattern.search(text))), None
                )
                source, confidence = text, 0.7
            if hit is None:
                continue
            term, match = hit
            found.append(
                {
                    "skill_id": term.skill_id,
                    "name": term.name,
                    "category": term.category,
                    "matched": match.group(0),
                    "confidence": confidence,
                    "evidence": _snippet(source, match.start(), match.end(), 40),
                }
            )
        return sorted(found, key=lambda s: -s["confidence"])[:60]

    # --------------------------------------------------------------- idiomas
    def _languages(self, lines: list[str]) -> list[dict[str, Any]]:
        results: dict[str, dict[str, Any]] = {}
        for line in lines:
            norm = normalize(line)
            for code, names in LANGUAGE_NAMES.items():
                if code in results or not any(re.search(rf"\b{n}\b", norm) for n in names):
                    continue
                cefr = CEFR.search(line.upper())
                level = (
                    cefr.group(1) if cefr else next((lvl for word, lvl in LEVEL_WORDS if word in norm), None)
                )
                results[code] = {
                    "language_code": code,
                    "level": level,
                    "confidence": 0.85 if level else 0.5,
                    "evidence": line[:160],
                }
        return list(results.values())

    # ------------------------------------------------------- certificaciones
    def _certifications(self, lines: list[str]) -> list[dict[str, Any]]:
        results = []
        for line in lines[:20]:
            clean = BULLET.sub("", line).strip()
            if len(clean) < 3 or len(clean) > 200:
                continue
            clean = DATE_RANGE.sub("", clean).strip(" |,-")
            parts = re.split(r"\s+[-|\u2013]\s+|\s*\|\s*|,\s+", clean, maxsplit=1)
            results.append(
                {
                    "name": parts[0][:200],
                    "issuer": parts[1][:200] if len(parts) > 1 else None,
                    "confidence": 0.55,
                    "evidence": line[:200],
                }
            )
        return results[:15]


def _split_title_company(headers: list[str]) -> tuple[str, str]:
    headers = [h.strip() for h in headers if h.strip()]
    if not headers:
        return "", ""
    if len(headers) >= 2:
        return headers[0], headers[1]
    parts = re.split(r"\s+(?:-|\u2013|\||@|at|en)\s+|,\s+", headers[0], maxsplit=1)
    return (parts[0], parts[1]) if len(parts) == 2 else (headers[0], "")
