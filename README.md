# AURA Talent AI

Plataforma profesional de talento y empleabilidad. Combina un nucleo 3D interactivo,
algoritmos explicables de busqueda en grafos, analisis de CV, preparacion de entrevistas,
rutas profesionales, evaluaciones psicometricas y automatizacion con IA local (Ollama).

AURA es un sistema de **apoyo a decisiones**: nunca contrata ni rechaza automaticamente.
Todas las transiciones del pipeline de seleccion las realiza un humano.

- Frontend: React 19 + Vite + TypeScript + TailwindCSS + React Three Fiber + Zustand + TanStack Query + PWA
- Backend: Python 3.12 + FastAPI + SQLAlchemy async + Pydantic + PostgreSQL 18
- IA: Ollama local (modelo propio `aura-talent-ai`) con fallback determinista y respaldo opcional a Gemini

---

## 1. Como inicializar el proyecto

### Base de datos (PostgreSQL)

Desde `database/` en PowerShell:

```powershell
psql -U postgres -v app_password=CLAVE -f install.sql
```

Esto crea el rol `aura_app` y la base `aura_talent` con el esquema completo y las semillas.

### Backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
copy .env.example .env   # completar DB_PASSWORD y JWT_SECRET (>= 32 chars)
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

- Documentacion interactiva (Swagger): `http://127.0.0.1:8000/api/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/api/v1/openapi.json`
- Health: `http://127.0.0.1:8000/health/live` y `/health/ready`
- Datos demo: `.\.venv\Scripts\python -m app.scripts.seed_demo` (clave `AuraDemo2026`)

Comandos de verificacion:

```powershell
.\.venv\Scripts\ruff check app        # lint
.\.venv\Scripts\python -m pytest -q   # tests (requiere base aura_talent_test)
```

### Frontend

En PowerShell usar `npm.cmd` (la politica de ejecucion bloquea `npm.ps1`):

```powershell
cd frontend
npm.cmd install
npm.cmd run dev      # http://localhost:5173  (proxy a :8000)
```

Comandos de verificacion:

```powershell
npm.cmd run typecheck   # TypeScript
npm.cmd test            # Vitest
npm.cmd run build       # build de produccion + PWA
npm.cmd run preview     # sirve el build en :4173 con service worker real
```

### Ollama (IA local)

```powershell
ollama serve                                        # levanta http://127.0.0.1:11434
ollama pull qwen2.5:3b                              # modelo base ligero
ollama create aura-talent-ai -f backend\ollama\Modelfile
```

Tambien se puede crear el modelo desde la API del backend:
`POST /api/v1/aura/ollama/create-model` o desde el panel `OllamaStudioPanel`
en los modulos CV, Algoritmos IA (empresa) y Modelos ML (admin).

---

## 2. Estructura general

```
Proyecto IA/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, seguridad, docs en /api/docs
│   │   ├── config/settings.py   # variables de entorno (DB, JWT, Ollama, Gemini)
│   │   ├── routers/v1/          # endpoints REST (auth, jobs, cv, career, aura, ...)
│   │   ├── services/            # logica de negocio (auth_service, orchestrator_service, ...)
│   │   ├── repositories/        # acceso a datos SQLAlchemy
│   │   ├── models/              # modelos ORM (69 tablas)
│   │   ├── schemas/             # Pydantic request/response
│   │   ├── career/              # planificador, catalogo de roles, busqueda en grafos
│   │   ├── match/engine.py      # motor AURA Match (reglas v1)
│   │   ├── psychometrics/       # motor de evaluaciones psicometricas
│   │   ├── nlp/                 # parser de CV (PDF/DOCX) y extraccion de texto
│   │   ├── analytics/metrics.py # embudo, tendencias, brechas
│   │   ├── aura/intents.py      # intenciones por reglas del orquestador
│   │   └── llm/                 # clientes Ollama y Gemini
│   ├── ollama/Modelfile         # definicion del modelo propio aura-talent-ai
│   ├── storage/                 # archivos subidos (ignorado por Git)
│   └── requirements-dev.txt
├── database/
│   ├── install.sql              # instalacion completa
│   ├── 00_create_database.sql   # base + rol
│   ├── 01_schema.sql            # 69 tablas
│   ├── 02_seed.sql              # catalogos y datos base
│   ├── 03_learning_resources.sql
│   └── 04_trust_and_portability.sql
├── frontend/
│   ├── src/
│   │   ├── api/                 # clientes HTTP tipados por dominio
│   │   ├── three/               # nucleo AURA 3D (shaders GLSL, efectos, calidad)
│   │   ├── features/            # modulos (cv, career, jobs, assessments, ai, ...)
│   │   ├── components/aura/     # UI compartida (AuraButton, AuraInfoBubble, charts)
│   │   ├── store/               # Zustand: sesion, UI/tema, toasts, aura
│   │   ├── styles/index.css     # temas y variables de color (ver seccion 4)
│   │   ├── i18n/                # traduccion en vivo
│   │   ├── voice/ vision/ gestures/  # motores de voz, camara y gestos (100% local)
│   │   └── layouts/             # AuraShell, ShellHud, AuthLayout
│   └── vite.config.ts           # proxy /api y /health -> :8000
└── docs/MANUAL.md               # manual de usuario completo
```

---

## 3. Ubicacion de los algoritmos

### Busqueda en grafos (Career Map)

Todo el motor de algoritmos esta en **`backend/app/career/search.py`** (logica pura,
testeable, sin dependencias de FastAPI). Implementa sobre el grafo
`career_nodes` / `career_edges`:

| Algoritmo | Nombre en UI | Que hace |
|---|---|---|
| BFS | Llegar en menos etapas | Ruta con menos pasos |
| DFS | Explorar alternativas | Enumera hasta 20 caminos simples |
| UCS | Invertir menos horas | Menor costo acumulado `g(n)` |
| GBFS | Ir directo a la meta | Voraz por heuristica `h(n)` |
| A* | Ruta balanceada | `f(n) = g(n) + h(n)` |
| Hill Climbing | Mejora inmediata | Vecino que mas mejora, detecta optimo local |
| Algoritmo genetico | Combinar y evolucionar planes | Poblacion, seleccion, crossover, mutacion, fitness |

Heuristicas implementadas en el mismo archivo:
- **Manhattan (L1)**: `h(n) = |x1-x2| + |y1-y2|`
- **Euclidiana (L2)**: `h(n) = sqrt((x1-x2)^2 + (y1-y2)^2)`
- **Saltos minimos**: aristas restantes x costo minimo (cota admisible para A*)

Archivos relacionados:
- `backend/app/career/planner.py` — planificador de rutas profesionales
- `backend/app/career/roles.py` — catalogo de roles objetivo
- `backend/app/routers/v1/career.py` — endpoint `/career/paths/{path_id}/search/{algorithm}`
- `backend/app/tests/test_graph_search.py` — tests del motor

Frontend de visualizacion (solo rol empresa):
- `frontend/src/features/career/CareerSearchPanel.tsx` — modal con las animaciones
  por algoritmo (arbol ramificado BFS/DFS, montana Hill Climbing, arbol genealogico
  del genetico, red ponderada A*/GBFS/UCS con triangulo Manhattan/Euclidiano)
- `frontend/src/features/career/CareerMap3D.tsx` — mapa 3D de la ruta
- `frontend/src/features/career/CompanyAlgorithmsModule.tsx` — modulo exclusivo empresa

### Otros motores de decision

| Dominio | Motor | Descripcion |
|---|---|---|
| AURA Match | `backend/app/match/engine.py` | Compatibilidad candidato-vacante por reglas con pesos redistribuidos |
| Ciencia de Datos y CART vs Reglas | `backend/app/analytics/ml_pipeline.py` | Exploracion (`describe`), auditoria de calidad (nulos, duplicados, rangos), exportacion CSV (`limpios` vs `revision`), preparacion `X`/`y`, split 70/30 y Arbol de Decision CART (`max_depth=3`) vs Reglas Fijas |
| Psicometria | `backend/app/psychometrics/engine.py` | correct_count, rubric, mean con items invertidos |
| Parser CV | `backend/app/nlp/cv_parser.py` + `text_extraction.py` | Parser por reglas con evidencia y confianza |
| Metricas | `backend/app/analytics/metrics.py` | Embudo, dias por etapa, tendencia semanal |
| Orquestador | `backend/app/aura/intents.py` | Clasificacion de intenciones por reglas |

---

## 4. Colores, temas y graficas

### Donde se cambian los colores

- **`frontend/src/styles/index.css`** — archivo central. Define los 6 temas con
  selectores `:root[data-theme="..."]` (incluido `"formal"` = Blanco Formal).
  Ahi viven las variables:
  - `--color-aura-500`, `--color-aura-300`, `--color-contrast` — paleta principal
  - superficies: `--bg-panel`, `--bg-elevated`, `--border`, `--text-primary`
  - clases de acabado: `.card-3d`, `.glass`, `.neo`, `.bubble-card`, `.card-shimmer`
- **`frontend/src/store/uiStore.ts`** — tema activo y selector de color (persistido)
- **`frontend/src/three/`** — colores del nucleo 3D:
  - `three/core/shaders.ts` — shaders GLSL (emision, rim, halo aditivo)
  - `three/core/AuraCore.tsx` y `three/AuraCanvas.tsx` — escena y energia visual
  - `three/quality.ts` — niveles de detalle (particulas, subdivisiones)

### Como las graficas siguen el tema

Las graficas SVG (barras, dona/pastel, burbujas, anillos, curvas) **no usan colores
fijos**: leen las variables CSS del tema (`var(--color-aura-500)`, etc.). Al cambiar
de tema o de color en el selector, todas las graficas se repintan solas.
Componentes clave: `components/aura/AuraProgressRing.tsx`, las graficas en
`features/cv/CvReview.tsx`, `features/career/CareerSearchPanel.tsx` y
`features/simulation/SystemSimulationTour.tsx`.

---

## 5. Conexiones a APIs

### Backend -> Frontend

- **Clientes HTTP tipados**: `frontend/src/api/` — un archivo por dominio:
  `auth.ts`, `jobs.ts`, `cv.ts`, `career.ts`, `match.ts`, `aura.ts`, `privacy.ts`,
  `talent.ts`, `passport.ts`, `analytics.ts`, `assessments.ts`, `admin.ts`
- **Cliente base**: `frontend/src/api/client.ts` — fetch con manejo de JWT,
  refresh token rotativo (cookie HttpOnly) y errores normalizados
- **Proxy de desarrollo**: `frontend/vite.config.ts` reenvia `/api` y `/health`
  a `http://localhost:8000`, asi el frontend usa rutas relativas

### Endpoints del backend

Todos en `backend/app/routers/v1/` (prefijo `/api/v1`):
`auth.py`, `users.py`, `candidates.py`, `companies.py`, `jobs.py`,
`applications.py`, `assessments.py`, `match.py`, `career.py`, `cv.py`,
`passport.py`, `analytics.py`, `aura.py`, `privacy.py`, `portfolio.py`,
`skills.py`, `admin.py`, `health.py`.

### APIs externas

| Servicio | Donde | Uso |
|---|---|---|
| Google Identity Services | `frontend/index.html` + `features/auth/GoogleAuthButton.tsx` | Login/registro con cuenta Google |
| Verificacion Google | `backend/app/services/auth_service.py` | Valida `access_token` vs `googleapis.com/oauth2/v3/userinfo` y `id_token` vs `oauth2.googleapis.com/tokeninfo` |
| Google OAuth Client ID | variable `VITE_GOOGLE_CLIENT_ID` | Configuracion del boton |
| Traduccion | `frontend/src/i18n/liveTranslator.tsx` | `translate.googleapis.com` + fallback `api.mymemory.translated.net` (ES/EN/FR/zh-CN), con cache local |
| Ollama | `backend/app/llm/ollama.py` | `http://127.0.0.1:11434` (local) |
| Gemini (opcional) | `backend/app/llm/gemini.py` | Respaldo del orquestador solo si `unknown` + consentimiento `external_ai_processing` + `GEMINI_API_KEY` |

---

## 6. Modelo Ollama y procesamiento de IA

### Piezas

- **`backend/ollama/Modelfile`** — define `aura-talent-ai`: `FROM qwen2.5:3b`,
  system prompt con el rol y las reglas de AURA (apoyo explicable, no contrata),
  parametros de temperatura/contexto
- **`backend/app/llm/ollama.py`** — cliente HTTP async hacia `OLLAMA_BASE_URL`:
  listar modelos, verificar estado/latencia, crear el modelo desde el Modelfile,
  generar respuestas para las tareas de automatizacion
- **`backend/app/config/settings.py`** — configuracion:
  - `AI_PROVIDER` = `ollama` (default) o `gemini`
  - `OLLAMA_BASE_URL` = `http://127.0.0.1:11434`
  - `OLLAMA_MODEL` = `aura-talent-ai`
  - `OLLAMA_BASE_MODEL` = `qwen2.5:3b`
- **`backend/app/services/orchestrator_service.py`** — orquestador: primero reglas
  (`app/aura/intents.py`), luego Ollama, luego Gemini, y siempre un fallback
  determinista local si ningun LLM responde. Todo se registra en `ai_interactions`.
- **`backend/app/routers/v1/aura.py`** — endpoints:
  - `POST /api/v1/aura/command` — comando de texto/voz
  - `GET /api/v1/aura/ollama/status` — estado, latencia, modelos instalados
  - `POST /api/v1/aura/ollama/create-model` — compila `aura-talent-ai`
  - `POST /api/v1/aura/ollama/automate` — tareas: `cv_optimization`,
    `job_generator`, `interview_coach`, `candidate_synthesis`, `workflow_automation`
- **`frontend/src/features/ai/OllamaStudioPanel.tsx`** — panel visual: estado del
  servidor, creacion del modelo y ejecucion de las 5 automatizaciones

### Procesamiento local adicional (sin enviar datos)

- `frontend/src/voice/voiceEngine.ts` — Web Speech API (es-MX), solo viaja texto
- `frontend/src/vision/` + `camera.ts` — MediaPipe en navegador (rostro, encuadre,
  luz); nunca graba ni identifica
- `frontend/src/gestures/classify.ts` — clasificador puro de gestos
- `frontend/src/features/jobs/InterviewPrepModule.tsx` — preguntas deterministas
  STAR; sin scoring de IA, notas solo en memoria

---

## 7. Reglas importantes del proyecto

- Sin emojis en codigo, UI ni commits; iconografia solo `lucide-react`
- El service worker **nunca** cachea `/api` ni `/health` (datos personales)
- Las transiciones del pipeline (HIRED/CLOSED) exigen motivo y confirmacion humana
- Psicometria: consentimiento obligatorio; resultados nunca se comparten con
  empresas sin accion explicita del candidato
- Los algoritmos y la vista tecnica son exclusivos del rol empresa
- En produccion se deshabilitan los docs (`openapi_url=None`, `docs_url=None`)
- Registro exige `accept_terms` + `accept_privacy` (frontend Zod + backend Pydantic)
- Manual completo en `docs/MANUAL.md`; reglas detalladas en `AGENTS.md`
