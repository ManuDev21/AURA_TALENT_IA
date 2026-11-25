# AURA TALENT AI - Reglas del proyecto

## Reglas obligatorias
- NO usar emojis en ningun lugar (codigo, UI, textos, commits). Para iconografia usar solo `lucide-react`.
- NO usar Next.js. Frontend: React + Vite + TypeScript + TailwindCSS + React Three Fiber.
- Backend: Python + FastAPI + SQLAlchemy + Pydantic. Base de datos: PostgreSQL.
- AURA es un sistema de apoyo a decisiones: nunca contrata ni rechaza automaticamente.
- La app es una PWA (vite-plugin-pwa). El service worker NUNCA debe cachear `/api` ni `/health` (datos personales).
- Todo debe poder usarse sin camara, microfono ni gestos (alternativas de teclado/texto).

## Progreso
- Fase 1 COMPLETADA: BD (69 tablas + seed), auth JWT + refresh rotativo, RBAC, auditoria, AURA Core 3D,
  BootSequence, AuraShell con navegacion orbital, Command Bar, PWA. Usuarios demo creados en la BD real.
- Fase 2 COMPLETADA: Talent Profile (CRUD, Skill Constellation, indicadores explicables, completitud), portfolio
  publico (/p/:slug), empresa + miembros (invitaciones), catalogo de skills (admin).
- Fase 3 COMPLETADA: CV Builder (desde perfil, enfoques, secciones, versiones, duplicar, PDF ATS con ReportLab),
  CV Analyzer (PDF/DOCX, parser por reglas con evidencia y confianza, revision y confirmacion humana).
- Fase 4 COMPLETADA: vacantes (CRUD, estados DRAFT/PUBLISHED/PAUSED/CLOSED, busqueda), postulaciones (CV congelado
  al postular), pipeline con transiciones solo humanas (HIRED/CLOSED exigen motivo + confirmacion), notas,
  notificaciones internas (campana en HUD). El candidato nunca ve comentarios internos.
- Fase 5 COMPLETADA: Assessment Center. Motor puro en `app/psychometrics/engine.py` (correct_count, rubric,
  mean con items invertidos, controles de calidad informativos). Consentimiento obligatorio en psicometria.
  Resultados psicometricos NUNCA se comparten con empresas sin accion explicita del candidato. Versiones
  publicadas inmutables (trigger en BD); cambios via "clonar" -> borrador -> publicar (retira la anterior).
  Importacion de instrumentos por JSON (admin).
- Fase 6 COMPLETADA: AURA Match. Motor puro `app/match/engine.py` (reglas v1, factores con peso redistribuido si
  la vacante no los pide, rango segun completitud de datos). Se guarda en `match_results` (upsert por candidato,
  vacante y version). Nunca usa atributos protegidos ni psicometria; la vista empresa solo usa evaluaciones
  compartidas de esa postulacion. La compatibilidad no mueve ni descarta candidatos.
- Fase 7 COMPLETADA: Career Map 3D (catalogo de roles `app/career/roles.py`, planificador puro
  `app/career/planner.py`, rutas en career_paths/nodes/edges con posiciones 3D), recursos de aprendizaje
  (`database/03_learning_resources.sql`, idempotente) y recomendaciones hibridas (`recs-hybrid-v1`) con razon por
  item; lo descartado no se vuelve a sugerir. Embeddings semanticos pendientes hasta tener GEMINI_API_KEY.
- Fase 8 COMPLETADA: AURA Orchestrator (`POST /api/v1/aura/command`, intenciones por reglas en
  `app/aura/intents.py`, solo comandos de `ai_commands` permitidos por rol/permiso, acciones que crean datos con
  token de confirmacion de un solo uso, todo registrado en `ai_interactions`). Voice Engine en
  `frontend/src/voice/voiceEngine.ts` (Web Speech API es-MX, nivel de microfono con Web Audio -> `audioLevel` del
  nucleo -> uniform `uAudio`, speechSynthesis con envolvente). Atajo de voz: Ctrl + Shift + Espacio.
  Al servidor solo viaja el texto reconocido, nunca audio.
- Fase 9 COMPLETADA: modulo "Practica con camara" (deteccion de rostro MediaPipe en el navegador: encuadre,
  distancia, luz; sin grabar, sin identificar, sin emociones). Consentimiento de camara revocable en
  `/api/v1/privacy/consents/me`. Camara compartida en `frontend/src/vision/camera.ts`.
- Fase 10 COMPLETADA: control por gestos (boton de mano en la barra superior): indice = cursor, pellizco = clic,
  palma = pausa, puno = volver al nucleo, deslizar con la palma = modulo anterior/siguiente. Clasificador puro en
  `frontend/src/gestures/classify.ts`.
- MediaPipe: `npm run dev`/`build` ejecutan `scripts/setup-mediapipe.mjs` (copia WASM y descarga modelos a
  `public/mediapipe`, ignorado por Git). La voz, camara y gestos NO funcionan en la vista previa embebida del
  editor: probar en Chrome o Edge en http://localhost:5173.
- Gesto de desplazamiento: dos dedos (indice y medio) + subir/bajar la mano = scroll tipo joystick
  (`scrollVelocity` en classify.ts) sobre el contenedor bajo el cursor o `#workspace`.
- Fase 11 COMPLETADA: nucleo con mirada (raton o cursor de gestos -> `gaze`), onda expansiva en cada
  `pulse` SUCCESS/WARNING/ERROR, anillo de voz ligado a `audioLevel` y satelites por notificacion sin leer
  (`three/core/CoreEffects.tsx`).
- Camara: `vision/camera.ts` comparte una sola apertura (`opening`) y cuenta usuarios; los efectos que la piden
  deben liberarla aunque se desmonten mientras abre (React StrictMode ejecuta efectos dos veces en desarrollo).
- Fase 12 COMPLETADA: analitica de empresa (`/api/v1/analytics/company`, embudo por etapa alcanzada, dias por
  etapa, tendencia semanal, habilidades y brechas, aviso si hay menos de 5 postulaciones), analitica personal
  (`/analytics/me`), reportes PDF (ReportLab) y Excel (openpyxl) en `/reports/jobs/{id}.pdf|xlsx` y
  `/reports/me.pdf`, registrados en la tabla `reports`. Logica pura en `app/analytics/metrics.py`.
- Correccion Fase 12: en el embudo, las etapas opcionales (ASSESSMENT) no son base de la conversion de la etapa
  siguiente (Entrevista mostraba 300% cuando nadie paso por Evaluacion).
- Fase 13 COMPLETADA: HSTS bajo HTTPS, Cache-Control no-store en /api, GZip, COOP, docs solo fuera de produccion
  y validador que exige HTTPS+COOKIE_SECURE con ENVIRONMENT=production. Auditoria de solo lectura
  (`GET /admin/audit`, empresa ve solo lo suyo; sysadmin todo; permiso `audit:read`), registro de motores
  (`GET /admin/models`), exportacion de datos personales (`GET /privacy/export`, JSON). Modulos: Auditoria,
  Modelos, Privacidad. Todos los modulos cargan diferidos (React.lazy) en `pages/ModuleRoute.tsx`.
- Scripts de apoyo: `app/scripts/seed_showcase.py` (datos demo realistas via API, idempotente por titulo de
  vacante) y `docs/capturas.py` (regenera capturas del manual con Playwright contra localhost:4173 + backend
  con datos demo). Manual completo: `docs/MANUAL.md`, imagenes en `docs/img/`.
- Respaldo LLM del orquestador: si las reglas devuelven `unknown`, hay `GEMINI_API_KEY` y el usuario
  concedio `external_ai_processing`, `app/llm/gemini.py` clasifica la intencion contra los comandos
  permitidos del usuario (solo se envia el texto del comando). Respuestas del modelo fuera de la lista
  permitida se ignoran. `ai_interactions.llm_used` lo registra. Modelo: `GEMINI_MODEL` (hoy
  `gemini-3.5-flash-lite`; los `gemini-2.5-*` ya no estan disponibles para claves nuevas).
- `docs/generar_manual_docx.py` convierte `docs/MANUAL.md` a `MANUAL.docx` (python-docx ya instalado).
- Career Map: busqueda de grafos real sobre `career_nodes/career_edges`: BFS (min pasos), DFS (enumeracion de
  hasta 20 caminos simples con backtracking), UCS (menor costo), GBFS (heuristica), A* (g+h). Logica pura
  en `app/career/search.py`, endpoint propio y autorizado `/career/paths/{path_id}/search/{algorithm}`.
  Coste: horas del nodo recurso si existen, si no peso de arista; heuristic A* = saltos restantes por minimo
  coste positivo (cota inferior admisible). Profundidad 1-20, lista de eventos, ciclos evitados, rutas y
  metricas. UI `CareerSearchPanel.tsx` con arbol SVG, traza animada, resaltado en mapa 3D y controles.
  Tests: `app/tests/test_graph_search.py` y ampliacion de `test_career_api.py`.
- Manual `docs/MANUAL.md` y `docs/MANUAL.docx` incluyen ahora los algoritmos y el endpoint.
- Rendimiento del nucleo: el Canvas 3D se monta despues de `BootSequence` para evitar competir con GSAP;
  la escena se pausa con la pestana oculta. El icosaedro usa detalle 12/8/6 (high/medium/low; no usar
  subdivisiones 24/48), particulas 1600/800/300 y DPR limitado. El anillo de voz no recalcula vertices
  cuando esta inactivo.
- Pasaporte de habilidades: `skill_evidence` (candidate-owned, share opt-in by evidence); importacion Open Badges
  se guarda como `open_badge_import` pero se marca/no se trata como verificada: no hay verificacion criptografica.
  API bajo `/candidates/me/skill-evidence`, export portable `/candidates/me/skills-passport`; se incluye en
  `/privacy/export`. Solo las evidencias compartidas aparecen en `ApplicationDetail`.
- Transparencia de vacantes: beneficios, horario, SLA respuesta (1-30 dias), duracion estimada (1-180), score
  informativo de completitud y confirmacion manual de vigencia (`POST /jobs/company/{id}/confirm-active`).
  ETA de proxima actualizacion se deriva de timeline humana y SLA; no cambia estados ni desencadena decision.
- Interoperabilidad: CSV de vacantes por empresa (`GET /jobs/company/export.csv`, `POST /jobs/company/import`);
  import crea borradores, incluye habilidades por nombre/JSON y requiere revision humana antes de publicar.
  No existe sync directa con ATS sin credenciales y consentimiento de cada cliente.
- Ensayo de entrevista candidato: `InterviewPrepModule.tsx`, preguntas deterministas de responsabilidades y
  skills, guia STAR y notas solo en memoria del browser/descarga local; no audio/video, no scoring IA, no envio.
- Migracion `database/04_trust_and_portability.sql` (idempotente, se aplica despues de las semillas), incluida
  en `install.sql` y test conftest. Para base real existente: usuario debe ejecutarla manualmente; nunca correrla
  aqui contra aura_talent real.
- TODAS LAS FASES 1-13 COMPLETADAS. Pendiente opcional: embeddings semanticos con Gemini y conectores ATS
  directos específicos.
- Cluster PostgreSQL de pruebas: `%LOCALAPPDATA%\aura_pgtest`, puerto 5499, rol aura_app / temp_test_pw, bases
  `aura_talent_test` (pytest) y `aura_talent` (pruebas e2e). Iniciar con
  `pg_ctl -D "%LOCALAPPDATA%\aura_pgtest" -o "-p 5499" -l "%LOCALAPPDATA%\aura_pgtest.log" start`.
  No usar %TEMP%: Windows lo limpia y corrompe el cluster.
- Responder al usuario siempre en espanol.
- El usuario prefiere que se le hable en espanol.
- Archivos subidos: `backend/storage/` (ignorado por Git). Tipo de archivo validado por contenido, no por extension.
- SQLAlchemy: `Base.__mapper_args__ = {"eager_defaults": True}` es necesario (async + trigger de updated_at).
- No nombrar metodos `list` dentro de clases con anotaciones `list[...]` posteriores (sombrea el builtin).
- El usuario aprobo la identidad visual (colores y estilo) de la Fase 1.

## Despliegue en produccion (activo)
- Frontend PWA: Vercel `https://aura-talent-lake.vercel.app` (proyecto `aura-talent`, despliegue CLI `vercel deploy --prod`).
- Backend API: Render `https://aura-talent-api.onrender.com` (servicio `srv-dc3h8sp7lnhs73fpjam0`, region ohio, plan free; `autoDeploy` en push a `main`; se duerme tras ~15 min sin uso y despierta en ~1 min).
- Base de datos: Neon PostgreSQL `neondb` (proyecto `aura-talent`, region us-east-2, plan free). Conexion via `DATABASE_URL` con `sslmode=require`.
- `frontend/vercel.json` proxifica `/api/*` y `/health/*` al backend (mismo origen -> cookies SameSite=strict). Si cambia la URL del backend hay que actualizar ese rewrite y `CORS_ORIGINS`/`FRONTEND_URL` en Render.
- Variables Render: `DATABASE_URL`, `JWT_SECRET`, `ENVIRONMENT=production`, `COOKIE_SECURE=true`, `FRONTEND_URL`, `CORS_ORIGINS`, `PYTHON_VERSION=3.12.8` (se configuran en Dashboard > Environment o API `/v1/services/{id}/env-vars`; envVars dentro de serviceDetails NO se aplican).
- En Render `rootDir` debe ser `backend` (se define a nivel del servicio, no en serviceDetails).
- `requirements.txt` debe contener todo lo que el arranque importa (ej. httpx); lo que solo este en requirements-dev no se instala en produccion.

## Entorno local
- PostgreSQL 18 instalado en Windows (`C:\Program Files\PostgreSQL\18`), puerto 5432.
- pgvector NO esta instalado: los embeddings se guardan como `real[]` y la similitud se calcula en Python.
- Sin Docker ni Redis: la cola de trabajos usa la tabla `background_jobs` (SELECT ... FOR UPDATE SKIP LOCKED).
- LLM: Google Gemini (tier gratuito) via variable de entorno `GEMINI_API_KEY`; la plataforma debe funcionar sin LLM.
- Los binarios de PostgreSQL deben invocarse desde PowerShell (no desde WSL bash).

## Base de datos
- Scripts en `database/`: `00_create_database.sql`, `01_schema.sql`, `02_seed.sql`, `install.sql`.
- Instalacion: `psql -U postgres -v app_password=CLAVE -f install.sql` (desde `database/`).
- Rol de aplicacion: `aura_app`, base: `aura_talent`. Todas las tablas pertenecen a `aura_app`.
- Validar cambios de esquema en un cluster temporal (initdb + pg_ctl en otro puerto), nunca sobre la base real.

## Backend (`backend/`, Python 3.12 en `.venv`)
- Instalar: `py -3.12 -m venv .venv` y `.venv\Scripts\python -m pip install -r requirements-dev.txt`
- Configurar: copiar `.env.example` a `.env` (DB_PASSWORD, JWT_SECRET >= 32 caracteres).
- Ejecutar: `.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000` (docs en `/api/docs`).
- Usuarios demo: `.venv\Scripts\python -m app.scripts.seed_demo` (clave por defecto AuraDemo2026).
- Tests: requieren una base `aura_talent_test` propiedad de aura_app; `.venv\Scripts\python -m pytest -q`.
  El conftest recrea el esquema en cada ejecucion y se niega a correr sobre bases que no terminen en `_test`.
- Lint/format: `.venv\Scripts\ruff check app` y `.venv\Scripts\ruff format app`.
- Capas: routers -> services -> repositories -> models. Las transiciones del pipeline solo las hace un humano.

## Frontend (`frontend/`, Node 24)
- En PowerShell usar `npm.cmd` (la politica de ejecucion bloquea `npm.ps1`).
- Instalar dependencias con `--before=<fecha de hace 7 dias>` (versiones con al menos 7 dias publicadas).
- React fijado a `~19.2` (requisito de peer de @react-three/fiber 9).
- Comandos: `npm.cmd run dev` (5173, proxy a :8000), `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`,
  `npm.cmd run preview` (4173, prueba la PWA real con service worker).
- Iconos PWA generados desde `public/aura.svg` (pwa-assets.config.ts).
