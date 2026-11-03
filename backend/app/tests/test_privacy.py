from httpx import AsyncClient

from app.tests.helpers import auth, candidate_token

P = "/api/v1/privacy/consents/me"


async def test_camera_consent_grant_revoke_and_isolation(client: AsyncClient) -> None:
    h = auth(await candidate_token(client))
    initial = (await client.get(P, headers=h)).json()
    assert initial["camera"]["granted"] is False

    granted = (await client.post(P, headers=h, json={"consent_type": "camera", "granted": True})).json()
    assert granted["camera"]["granted"] is True and granted["camera"]["updated_at"]
    revoked = (await client.post(P, headers=h, json={"consent_type": "camera", "granted": False})).json()
    assert revoked["camera"]["granted"] is False

    other = auth(await candidate_token(client))
    assert (await client.get(P, headers=other)).json()["camera"]["granted"] is False
    # Tipos reservados al sistema (terminos, psicometria) no se modifican por esta via
    bad = await client.post(P, headers=h, json={"consent_type": "psychometric", "granted": True})
    assert bad.status_code == 422
