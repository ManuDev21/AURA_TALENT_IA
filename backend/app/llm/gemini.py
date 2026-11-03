"""Cliente minimo de Gemini (generateContent) para el orquestador.

Uso actual: entender frases libres cuando las reglas de `app/aura/intents.py` no reconocen la
intencion. Solo se envia el texto del comando del usuario (nunca datos del perfil) y solo si la
persona concedio el consentimiento `external_ai_processing`. Si Gemini falla o no esta configurado,
el orquestador sigue funcionando con las reglas.
"""

import json

import httpx

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

_PROMPT = """Eres el clasificador de intenciones de AURA, una plataforma de talento y reclutamiento.
El usuario escribio o dicto un comando en espanol. Elige el comando mas adecuado de esta lista,
o "unknown" si ninguno aplica. Responde SOLO con JSON: {{"intent": "<codigo>", "query": "<opcional>"}}.
Incluye "query" unicamente para jobs.search, con el termino de busqueda (p. ej. "frontend").

Comandos disponibles:
{commands}

Texto del usuario: {text}"""


class GeminiClient:
    def __init__(self, api_key: str, model: str) -> None:
        self.url = ENDPOINT.format(model=model)
        self.key = api_key

    async def classify(self, text: str, command_lines: list[str]) -> dict | None:
        """Devuelve {"intent": code, "query": ...} o None si el servicio no esta disponible."""
        prompt = _PROMPT.format(commands="\n".join(command_lines), text=text[:300])
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"response_mime_type": "application/json", "temperature": 0},
        }
        try:
            async with httpx.AsyncClient(timeout=10) as http:
                r = await http.post(self.url, params={"key": self.key}, json=body)
            if r.status_code != 200:
                return None
            content = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            data = json.loads(content)
            return data if isinstance(data.get("intent"), str) else None
        except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError):
            return None
