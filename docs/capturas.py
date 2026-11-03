"""Genera las capturas reales del manual (docs/img) recorriendo la aplicacion con Playwright.

Requisitos: frontend en http://localhost:5173, backend con datos de demostracion
(python -m app.scripts.seed_demo y python -m app.scripts.seed_showcase).
Uso: python docs/capturas.py
"""

import asyncio
from pathlib import Path

import httpx
from playwright.async_api import Page, async_playwright

BASE = "http://localhost:4173"
OUT = Path(__file__).parent / "img"
PASSWORD = "AuraDemo2026"


def api_token(email: str) -> str:
    r = httpx.post(f"{BASE}/api/v1/auth/login", json={"email": email, "password": PASSWORD}, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def api_get(token: str, path: str):
    return httpx.get(f"{BASE}/api/v1{path}", headers={"Authorization": f"Bearer {token}"}, timeout=60).json()


async def login(page: Page, email: str) -> None:
    await page.goto(f"{BASE}/login")
    await page.get_by_label("Correo").fill(email)
    await page.get_by_label("Contrasena", exact=True).fill(PASSWORD)
    await page.get_by_role("button", name="Entrar").click()
    await page.wait_for_url(lambda u: "/login" not in u, timeout=20000)
    await page.wait_for_timeout(2500)


async def step(label: str, action) -> None:
    """Interaccion opcional: si falla se informa y la captura continua."""
    try:
        await action
    except Exception as exc:  # noqa: BLE001
        print(f"  aviso: no se pudo {label}: {str(exc).splitlines()[0][:120]}")


async def shot(page: Page, name: str, path: str | None = None, wait: int = 2200, full: bool = False) -> None:
    if path:
        await page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=60000)
    await page.wait_for_timeout(wait)
    await page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)
    print("captura", name)


async def main() -> None:
    OUT.mkdir(exist_ok=True)
    cand_token = api_token("candidato@aura.dev")
    path_id = api_get(cand_token, "/career/paths")[0]["id"]
    attempt = next(a for a in api_get(cand_token, "/assessments/attempts/me") if a["status"] == "scored")
    top_job = api_get(cand_token, "/match/me/top?limit=1")[0]["job_id"]
    rec_token = api_token("reclutador@auralabs.dev")
    jobs = api_get(rec_token, "/jobs/company")
    front = next(j for j in jobs if j["title"].startswith("Frontend"))

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, locale="es-MX")
        page = await ctx.new_page()

        # Arranque y acceso
        await page.goto(f"{BASE}/login")
        await page.wait_for_timeout(1800)
        await page.screenshot(path=str(OUT / "00-arranque.png"))
        print("captura 00-arranque")
        await page.evaluate("sessionStorage.setItem('aura.boot.done', '1')")
        await shot(page, "01-login", "/login", wait=3500)
        await shot(page, "02-registro", "/register", wait=2500)

        # Candidato
        await login(page, "candidato@aura.dev")
        await shot(page, "10-candidato-inicio", "/candidate", wait=3500)
        await page.get_by_label("Pregunta a AURA").fill("AURA, analiza mi perfil")
        await page.keyboard.press("Enter")
        await shot(page, "11-comando-aura", wait=2500)
        await shot(page, "12-perfil", "/candidate/profile")
        await step("abrir habilidades", page.get_by_role("tab", name="Habilidades").click(timeout=8000))
        await shot(page, "13-perfil-habilidades", wait=2500)
        await shot(page, "14-portfolio", "/candidate/portfolio")
        await shot(page, "15-cv", "/candidate/cv")
        await step("abrir el CV", page.get_by_text("CV Frontend").first.click(timeout=8000))
        await shot(page, "16-cv-editor", wait=3000)
        await shot(page, "17-vacantes", "/candidate/jobs")
        await shot(page, "18-postulaciones", "/candidate/applications")
        await shot(page, "19-evaluaciones", "/candidate/assessments")
        await step("abrir resultados", page.get_by_role("tab", name="Mis resultados").click(timeout=8000))
        await page.wait_for_timeout(1200)
        await step("abrir el resultado", page.get_by_text(attempt["title"]).first.click(timeout=8000))
        await shot(page, "20-evaluacion-resultado", wait=2500)
        await shot(page, "21-match-compatibles", "/candidate/match")
        await shot(page, "22-match-detalle", f"/candidate/match?job={top_job}", wait=3500)
        await shot(page, "23-match-brechas", "/candidate/match?tab=gaps", wait=3000)
        await shot(page, "24-recomendaciones", "/candidate/recommendations", wait=3000)
        await shot(page, "25-career-roles", "/candidate/career", wait=3000)
        await shot(page, "26-career-mapa-3d", f"/candidate/career?path={path_id}", wait=5000)
        await shot(page, "27-mi-progreso", "/candidate/insights", wait=3000)
        await shot(page, "28-camara-consentimiento", "/candidate/vision")
        await shot(page, "29-privacidad", "/candidate/privacy")
        await step("cerrar sesion", page.get_by_role("button", name="Cerrar sesion").click(timeout=8000))
        await page.wait_for_timeout(1500)

        # Empresa
        await login(page, "reclutador@auralabs.dev")
        await shot(page, "30-empresa-inicio", "/company", wait=3500)
        await shot(page, "31-empresa-vacantes", "/company/jobs")
        await shot(page, "32-empresa-candidatos", f"/company/candidates?job={front['id']}", wait=3000)
        await shot(page, "33-empresa-pipeline", f"/company/pipeline?job={front['id']}", wait=3000)
        await page.goto(f"{BASE}/company/candidates?job={front['id']}")
        await page.wait_for_timeout(2500)
        await step("abrir la postulacion", page.locator("ul button").first.click(timeout=8000))
        await shot(page, "34-empresa-postulacion", wait=2500)
        await step("abrir match", page.get_by_role("tab", name="Match").click(timeout=8000))
        await shot(page, "35-empresa-postulacion-match", wait=3000)
        await step("abrir evaluaciones", page.get_by_role("tab", name="Evaluaciones").click(timeout=8000))
        await shot(page, "36-empresa-postulacion-evaluaciones", wait=2500)
        await shot(page, "37-empresa-match", "/company/match", wait=3000)
        await shot(page, "38-empresa-analytics", "/company/analytics", wait=3500)
        await shot(page, "39-empresa-reportes", "/company/reports")
        await shot(page, "40-empresa-evaluaciones", "/company/assessments")
        await shot(page, "41-empresa-perfil", "/company/company")
        await step("cerrar sesion", page.get_by_role("button", name="Cerrar sesion").click(timeout=8000))
        await page.wait_for_timeout(1500)

        # Administrador del sistema
        await login(page, "sysadmin@aura.dev")
        await shot(page, "50-admin-inicio", "/admin", wait=3500)
        await shot(page, "51-admin-auditoria", "/admin/audit", wait=3000)
        await shot(page, "52-admin-modelos", "/admin/models")
        await shot(page, "53-admin-instrumentos", "/admin/instruments")
        await shot(page, "54-admin-roles", "/admin/roles")
        await shot(page, "55-admin-catalogos", "/admin/catalogs")

        # Movil
        mobile = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        m = await mobile.new_page()
        await m.goto(f"{BASE}/login")
        await m.evaluate("sessionStorage.setItem('aura.boot.done', '1')")
        await login(m, "candidato@aura.dev")
        await shot(m, "60-movil-inicio", "/candidate", wait=3500)
        await shot(m, "61-movil-match", f"/candidate/match?job={top_job}", wait=3500)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
