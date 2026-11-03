"""Datos de demostracion realistas, cargados a traves del API (mismas validaciones que la interfaz).

Requisitos: backend en ejecucion y usuarios demo creados (python -m app.scripts.seed_demo).
Uso:  .venv\\Scripts\\python -m app.scripts.seed_showcase [--base http://localhost:8000]
Es seguro ejecutarlo varias veces: si las vacantes de demostracion ya existen, no duplica nada.
"""

import argparse
import sys

import httpx

PASSWORD = "AuraDemo2026"
JOBS = [
    {
        "title": "Frontend Developer (React)",
        "description": "Construiras interfaces accesibles y rapidas con React y TypeScript para nuestra "
        "plataforma de "
        "talento. Trabajaras con diseno, backend y producto en ciclos cortos.",
        "location": "Ciudad de Mexico",
        "modality": "hybrid",
        "experience_min_years": 1,
        "responsibilities": [
            "Desarrollar componentes reutilizables",
            "Asegurar accesibilidad y rendimiento",
            "Escribir pruebas automatizadas",
        ],
        "skills": [
            ("React", "required", 4),
            ("TypeScript", "required", 3),
            ("JavaScript", "required", 4),
            ("CSS", "preferred", 3),
            ("Testing automatizado", "preferred", 2),
        ],
        "languages": [{"language_code": "en", "min_level": "B1"}],
    },
    {
        "title": "Data Analyst Jr",
        "description": "Analizaras datos de producto y reclutamiento con SQL y Python para generar "
        "tableros y "
        "recomendaciones accionables para el negocio.",
        "location": "Remoto",
        "modality": "remote",
        "experience_min_years": 0,
        "responsibilities": ["Construir tableros en Power BI", "Responder preguntas de negocio con datos"],
        "skills": [
            ("SQL", "required", 3),
            ("Analisis de datos", "required", 3),
            ("Python", "preferred", 2),
            ("Power BI", "preferred", 2),
        ],
        "languages": [],
    },
    {
        "title": "Backend Developer (Python)",
        "description": "Disenaras APIs con FastAPI y PostgreSQL, con foco en seguridad, pruebas "
        "y observabilidad.",
        "location": "Guadalajara",
        "modality": "onsite",
        "experience_min_years": 2,
        "responsibilities": ["Disenar endpoints REST", "Modelar datos en PostgreSQL"],
        "skills": [
            ("Python", "required", 4),
            ("FastAPI", "required", 3),
            ("PostgreSQL", "required", 3),
            ("Docker", "preferred", 2),
        ],
        "languages": [{"language_code": "en", "min_level": "B2"}],
    },
]
EXTRA = [
    ("Lucia Fernandez", {"React": 4, "TypeScript": 4, "JavaScript": 5, "CSS": 4}, 0, "FINAL_REVIEW"),
    ("Diego Ramirez", {"SQL": 4, "Analisis de datos": 3, "Python": 3, "Excel": 4}, 1, "INTERVIEW"),
    ("Sofia Herrera", {"React": 3, "JavaScript": 3, "HTML": 4}, 0, "SCREENING"),
    ("Mateo Lopez", {"Python": 4, "FastAPI": 3, "PostgreSQL": 3, "Docker": 3}, 2, "ASSESSMENT"),
    ("Valeria Torres", {"SQL": 2, "Excel": 3}, 1, "APPLIED"),
    ("Andres Castillo", {"Python": 2, "SQL": 3}, 2, "CLOSED"),
]
PATH = {
    "APPLIED": [],
    "SCREENING": ["SCREENING"],
    "ASSESSMENT": ["SCREENING", "ASSESSMENT"],
    "INTERVIEW": ["SCREENING", "INTERVIEW"],
    "FINAL_REVIEW": ["SCREENING", "INTERVIEW", "FINAL_REVIEW"],
    "CLOSED": ["SCREENING", "CLOSED"],
}


class Api:
    def __init__(self, base: str) -> None:
        self.c = httpx.Client(base_url=f"{base}/api/v1", timeout=60)

    def login(self, email: str) -> dict:
        r = self.c.post("/auth/login", json={"email": email, "password": PASSWORD})
        r.raise_for_status()
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    def call(self, method: str, path: str, h: dict, **kw) -> dict | list | None:
        r = self.c.request(method, path, headers=h, **kw)
        if r.status_code >= 400 and r.status_code != 409:
            raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:300]}")
        return (
            r.json()
            if r.content and r.headers.get("content-type", "").startswith("application/json")
            else None
        )

    def skill(self, h: dict, name: str) -> str:
        items = self.call("GET", "/skills", h, params={"q": name})
        return next(s["id"] for s in items if s["name"].lower() == name.lower())


def transition(api: Api, h: dict, app_id: str, target: str) -> None:
    for stage in PATH[target]:
        body = {"to_stage": stage}
        if stage == "CLOSED":
            body |= {
                "comment": "Perfil con experiencia menor a la requerida para esta posicion.",
                "confirm": True,
            }
        api.call("POST", f"/applications/{app_id}/transition", h, json=body)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8000")
    base = parser.parse_args().base
    api = Api(base)
    rec = api.login("reclutador@auralabs.dev")
    cand = api.login("candidato@aura.dev")

    existing = {j["title"] for j in api.call("GET", "/jobs/company", rec)}
    if JOBS[0]["title"] in existing:
        print("Los datos de demostracion ya existen. Nada que hacer.")
        return

    print("Publicando vacantes...")
    job_ids = []
    for j in JOBS:
        body = {k: v for k, v in j.items() if k != "skills"}
        body["skills"] = [
            {"skill_id": api.skill(rec, n), "importance": imp, "min_proficiency": lvl}
            for n, imp, lvl in j["skills"]
        ]
        job = api.call("POST", "/jobs", rec, json=body)
        api.call("POST", f"/jobs/{job['id']}/status", rec, json={"status": "PUBLISHED"})
        job_ids.append(job["id"])

    print("Completando el perfil del candidato demo...")
    api.call(
        "PATCH",
        "/candidates/me/profile",
        cand,
        json={
            "headline": "Desarrolladora Frontend | React y TypeScript",
            "summary": "Desarrolladora frontend con dos anos creando interfaces accesibles en React. "
            "Me interesa el "
            "diseno de sistemas de componentes, el rendimiento web y crecer hacia full stack.",
            "location_city": "Puebla",
            "location_country": "Mexico",
            "availability": "two_weeks",
            "work_modality": "hybrid",
            "desired_roles": ["Frontend Developer", "Full Stack Developer"],
        },
    )
    for name, lvl in {
        "React": 4,
        "JavaScript": 5,
        "TypeScript": 3,
        "HTML": 4,
        "CSS": 4,
        "Git": 3,
        "SQL": 2,
        "Python": 2,
        "Trabajo en equipo": 4,
    }.items():
        api.call("PUT", f"/candidates/me/skills/{api.skill(cand, name)}", cand, json={"proficiency": lvl})
    api.call(
        "POST",
        "/candidates/me/experiences",
        cand,
        json={
            "company_name": "Nube Digital",
            "title": "Frontend Developer",
            "employment_type": "full_time",
            "start_date": "2024-02-01",
            "is_current": True,
            "description": "Desarrollo de un panel de analitica en React y TypeScript.",
            "achievements": [
                "Reduje 40% el tiempo de carga",
                "Implemente un sistema de componentes accesible",
            ],
        },
    )
    api.call(
        "POST",
        "/candidates/me/experiences",
        cand,
        json={
            "company_name": "Estudio Pixel",
            "title": "Desarrolladora Web Jr",
            "employment_type": "internship",
            "start_date": "2023-01-01",
            "end_date": "2024-01-01",
            "description": "Sitios web con HTML, CSS y JavaScript.",
        },
    )
    api.call(
        "POST",
        "/candidates/me/education",
        cand,
        json={
            "institution": "Universidad Tecnologica de Puebla",
            "degree": "Ingenieria en Software",
            "field_of_study": "Software",
            "level": "bachelor",
            "start_date": "2019-08-01",
            "end_date": "2023-06-01",
        },
    )
    api.call("POST", "/candidates/me/languages", cand, json={"language_code": "es", "level": "native"})
    api.call("POST", "/candidates/me/languages", cand, json={"language_code": "en", "level": "B2"})
    api.call(
        "POST",
        "/candidates/me/links",
        cand,
        json={"link_type": "github", "url": "https://github.com/aura-demo"},
    )
    api.call(
        "POST",
        "/portfolio/me/projects",
        cand,
        json={
            "title": "Tablero de habilidades",
            "description": "Visualizacion interactiva de habilidades con React y D3.",
            "role": "Autora",
            "is_featured": True,
            "skill_ids": [api.skill(cand, "React"), api.skill(cand, "TypeScript")],
        },
    )

    print("Postulaciones y proceso de seleccion...")
    app = api.call("POST", "/applications", cand, json={"job_id": job_ids[0]})
    transition(api, rec, app["id"], "INTERVIEW")
    tech = next(v for v in api.call("GET", "/assessments/assignable", rec) if v["type_code"] == "technical")
    api.call(
        "POST",
        "/assessments/assignments",
        rec,
        json={"version_id": tech["version_id"], "application_id": app["id"]},
    )
    catalog = {i["code"]: i for i in api.call("GET", "/assessments/catalog", cand)}
    item = catalog["AURA-TECH-JS-BASIC"]
    session = api.call(
        "POST",
        "/assessments/attempts",
        cand,
        json={"version_id": item["version_id"], "assignment_id": item["pending_assignments"][0]["id"]},
    )
    for i, q in enumerate(session["questions"]):
        option = q["options"][1 if i % 2 else 0]["id"]
        api.call(
            "PUT",
            f"/assessments/attempts/{session['attempt_id']}/answers",
            cand,
            json={"question_id": q["id"], "option_id": option, "time_ms": 4000},
        )
    api.call("POST", f"/assessments/attempts/{session['attempt_id']}/submit", cand)
    api.call("POST", "/applications", cand, json={"job_id": job_ids[1]})

    for idx, (name, skills, job_idx, stage) in enumerate(EXTRA):
        email = f"demo{idx + 1}@aura.dev"
        r = api.c.post(
            "/auth/register",
            json={
                "email": email,
                "password": PASSWORD,
                "full_name": name,
                "account_type": "candidate",
                "accept_terms": True,
                "accept_privacy": True,
            },
        )
        h = (
            {"Authorization": f"Bearer {r.json()['access_token']}"}
            if r.status_code == 201
            else api.login(email)
        )
        api.call(
            "PATCH",
            "/candidates/me/profile",
            h,
            json={"headline": f"Profesional en {JOBS[job_idx]['title']}"},
        )
        for s, lvl in skills.items():
            api.call("PUT", f"/candidates/me/skills/{api.skill(h, s)}", h, json={"proficiency": lvl})
        a = api.call("POST", "/applications", h, json={"job_id": job_ids[job_idx]})
        transition(api, rec, a["id"], stage)

    print("CV, ruta profesional y recomendaciones...")
    api.call("POST", "/cv/resumes", cand, json={"name": "CV Frontend", "target": "frontend"})
    api.call("POST", "/career/paths", cand, json={"role_code": "fullstack"})
    api.call("POST", "/recommendations/me/refresh", cand)
    print("Listo. Datos de demostracion cargados.")


if __name__ == "__main__":
    try:
        main()
    except (httpx.HTTPError, RuntimeError) as exc:
        print(f"No se pudieron cargar los datos: {exc}", file=sys.stderr)
        sys.exit(1)
