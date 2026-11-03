from httpx import AsyncClient

from app.tests.conftest import register


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def candidate_token(client: AsyncClient) -> str:
    return (await register(client))["body"]["access_token"]


async def company_admin(client: AsyncClient) -> dict:
    return (await register(client, account_type="company"))["body"]


async def grant_role(user_id: str, role_code: str) -> None:
    import asyncpg

    from app.config import get_settings

    s = get_settings()
    conn = await asyncpg.connect(
        host=s.db_host,
        port=s.db_port,
        user=s.db_user,
        password=s.db_password.get_secret_value(),
        database=s.db_name,
    )
    try:
        await conn.execute(
            "INSERT INTO user_roles (user_id, role_id) SELECT $1::uuid, id FROM roles WHERE code = $2",
            user_id,
            role_code,
        )
    finally:
        await conn.close()


async def skill_id(client: AsyncClient, token: str, query: str) -> str:
    response = await client.get("/api/v1/skills", params={"q": query}, headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()[0]["id"]
