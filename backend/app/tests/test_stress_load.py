"""Pruebas masivas de usuarios (estres, concurrencia y condiciones de carrera)."""

import asyncio
import statistics
import time

from httpx import AsyncClient

from app.tests.conftest import TEST_PASSWORD, unique_email
from app.tests.helpers import auth


async def test_stress_50_concurrent_users_full_lifecycle(client: AsyncClient) -> None:
    """50 usuarios concurrentes: registro, perfil, consulta de skills y vacantes sin errores 500."""
    n_users = 50
    latencies_ms: list[float] = []

    async def user_flow(idx: int) -> bool:
        email = unique_email(f"stress_{idx}")
        t0 = time.perf_counter()
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "full_name": f"Usuario Estres {idx}",
                "account_type": "candidate",
                "accept_terms": True,
                "accept_privacy": True,
            },
        )
        assert reg.status_code == 201, f"user {idx}: {reg.status_code} {reg.text}"
        headers = auth(reg.json()["access_token"])

        prof = await client.patch(
            "/api/v1/candidates/me/profile",
            headers=headers,
            json={"headline": f"Desarrollador #{idx}", "location_city": "Toluca", "location_country": "MX"},
        )
        assert prof.status_code == 200

        jobs = await client.get("/api/v1/jobs", headers=headers)
        assert jobs.status_code == 200

        me = await client.get("/api/v1/users/me", headers=headers)
        assert me.status_code == 200 and me.json()["email"] == email

        latencies_ms.append((time.perf_counter() - t0) * 1000)
        return True

    # Lotes de 10 concurrentes (50 usuarios totales) para respetar el pool asyncpg de pruebas
    results: list[bool] = []
    for batch_start in range(0, n_users, 10):
        batch = await asyncio.gather(*(user_flow(i) for i in range(batch_start, batch_start + 10)))
        results.extend(batch)

    assert len(results) == n_users and all(results)
    p50 = statistics.median(latencies_ms)
    p95 = sorted(latencies_ms)[int(0.95 * len(latencies_ms)) - 1]
    assert p50 > 0 and p95 < 15000


async def test_stress_race_condition_duplicate_email_registration(client: AsyncClient) -> None:
    """10 registros simultaneos con el MISMO correo: exactamente 1 exito (201) y 9 conflictos (409)."""
    shared_email = unique_email("race")

    async def attempt() -> int:
        r = await client.post(
            "/api/v1/auth/register",
            json={
                "email": shared_email,
                "password": TEST_PASSWORD,
                "full_name": "Carrera Concurrente",
                "account_type": "candidate",
                "accept_terms": True,
                "accept_privacy": True,
            },
        )
        return r.status_code

    statuses = await asyncio.gather(*(attempt() for _ in range(10)))
    assert statuses.count(201) == 1
    assert statuses.count(409) == 9
    assert 500 not in statuses
