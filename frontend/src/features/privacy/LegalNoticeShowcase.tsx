import {
  Check,
  Code2,
  Cpu,
  Database,
  FileCheck2,
  Lock,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react'
import { type CSSProperties, useState } from 'react'
import { createPortal } from 'react-dom'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { cn } from '@/utils/cn'

export interface ProgrammingLangBadge {
  id: string
  name: string
  version: string
  role: string
  license: string
  color: string
  bgGlow: string
  symbol: string
  floatX: string
  floatY: string
  delay: number
}

export const OPEN_SOURCE_LANGUAGES: ProgrammingLangBadge[] = [
  {
    id: 'python',
    name: 'Python',
    version: '3.12',
    role: 'Motor Backend, FastAPI, Psicometria y Algoritmos',
    license: 'PSF License v2 (Open Source)',
    color: '#38bdf8',
    bgGlow: 'rgba(56, 189, 248, 0.22)',
    symbol: 'Py',
    floatX: '4%',
    floatY: '10%',
    delay: 0,
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    version: '5.8',
    role: 'Tipado Estatico Estricto en Frontend y Contratos API',
    license: 'Apache License 2.0 (Open Source)',
    color: '#3b82f6',
    bgGlow: 'rgba(59, 130, 246, 0.24)',
    symbol: 'TS',
    floatX: '24%',
    floatY: '6%',
    delay: 1,
  },
  {
    id: 'javascript',
    name: 'JavaScript ES2024',
    version: 'V8 / ECMAScript',
    role: 'Ejecucion en Navegador, Web Audio, Web Speech y PWA',
    license: 'ECMA-262 / MIT (Open Source)',
    color: '#facc15',
    bgGlow: 'rgba(250, 204, 21, 0.22)',
    symbol: 'JS',
    floatX: '46%',
    floatY: '12%',
    delay: 2,
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    version: '18',
    role: 'Base de Datos Relacional ACID, Triggers e Integridad',
    license: 'PostgreSQL License (Open Source)',
    color: '#60a5fa',
    bgGlow: 'rgba(96, 165, 250, 0.22)',
    symbol: 'PG',
    floatX: '68%',
    floatY: '7%',
    delay: 3,
  },
  {
    id: 'rust',
    name: 'Rust',
    version: 'Toolchain / Rolldown',
    role: 'Bundling de Alta Velocidad, Linting Ruff y Criptografia',
    license: 'MIT / Apache 2.0 (Open Source)',
    color: '#fb923c',
    bgGlow: 'rgba(251, 146, 60, 0.22)',
    symbol: 'Rs',
    floatX: '84%',
    floatY: '14%',
    delay: 4,
  },
  {
    id: 'react',
    name: 'React + Three.js',
    version: '19.2 / R3F',
    role: 'Renderizado Declarativo y Nucleo 3D WebGL',
    license: 'MIT License (Open Source)',
    color: '#22d3ee',
    bgGlow: 'rgba(34, 211, 238, 0.22)',
    symbol: 'R3F',
    floatX: '8%',
    floatY: '58%',
    delay: 2,
  },
  {
    id: 'cpp_wasm',
    name: 'C++ / WebAssembly',
    version: 'WASM SIMD',
    role: 'Vision por Computadora MediaPipe Local en Navegador',
    license: 'Apache License 2.0 (Open Source)',
    color: '#a855f7',
    bgGlow: 'rgba(168, 85, 247, 0.22)',
    symbol: 'C++',
    floatX: '31%',
    floatY: '62%',
    delay: 5,
  },
  {
    id: 'fastapi',
    name: 'FastAPI + SQLAlchemy',
    version: 'ASGI / Async',
    role: 'Arquitectura REST Asincrona, Validacion Pydantic v2',
    license: 'MIT License (Open Source)',
    color: '#10b981',
    bgGlow: 'rgba(16, 185, 129, 0.22)',
    symbol: 'API',
    floatX: '56%',
    floatY: '58%',
    delay: 1,
  },
  {
    id: 'nodejs',
    name: 'Node.js + Vite',
    version: '24 LTS',
    role: 'Cadena de Suministro Frontend y Empaquetado Seguro',
    license: 'MIT License (Open Source)',
    color: '#4ade80',
    bgGlow: 'rgba(74, 222, 128, 0.22)',
    symbol: 'Node',
    floatX: '79%',
    floatY: '60%',
    delay: 3,
  },
]

export const LEGAL_ARTICLES = [
  {
    number: '01',
    code: 'Articulos 6, 12, 14 y 15 — LFPDPPP / Art. 5 RGPD',
    title: 'Principios Rectores de Licitud, Finalidad, Lealtad y Proporcionalidad',
    summary:
      'AURA recaba unicamente los datos curriculares, academicos, laborales y de contacto estrictamente necesarios para apoyar tu empleabilidad, generacion de CV, rutas de aprendizaje y vinculacion con vacantes.',
    safeguard:
      'Minimizacion de datos: nunca solicitamos ni utilizamos atributos protegidos (origen etnico, religion, estado civil, orientacion o datos medicos) en ningun calculo del sistema.',
  },
  {
    number: '02',
    code: 'Articulos 8 y 9 — LFPDPPP / Art. 9 RGPD',
    title: 'Consentimiento Expreso y Escudo sobre Datos Sensibles y Psicometricos',
    summary:
      'Todo tratamiento de datos personales y evaluaciones psicometricas del Assessment Center requiere el consentimiento libre, especifico, informado e inequivoco del titular.',
    safeguard:
      'Aislamiento estricto: los resultados psicometricos son propiedad privada del candidato y NUNCA se comparten con ninguna empresa sin accion explicita por postulacion.',
  },
  {
    number: '03',
    code: 'Articulos 16 y 19 — LFPDPPP / Art. 32 RGPD / ISO 27001',
    title: 'Medidas de Seguridad Administrativas, Tecnicas y Criptograficas',
    summary:
      'Resguardamos tu informacion contra dano, perdida, alteracion, destruccion o acceso no autorizado mediante controles criptograficos de grado empresarial.',
    safeguard:
      'Contrasenas cifradas con Argon2id/Bcrypt, sesiones JWT de corta duracion + Refresh Tokens rotativos HttpOnly con revocacion de familia ante reuso, HSTS, Cache-Control no-store en /api y Service Worker PWA que jamas almacena endpoints de datos personales.',
  },
  {
    number: '04',
    code: 'Articulos 22 al 27 — LFPDPPP / Art. 15 al 20 RGPD',
    title: 'Ejercicio Directo de Derechos ARCO (Acceso, Rectificacion, Cancelacion y Oposicion)',
    summary:
      'Como titular tienes derecho en todo momento a acceder a tus datos, rectificarlos, cancelar tu cuenta o revocar cualquier permiso otorgado sin penalizacion alguna.',
    safeguard:
      'Descarga portable instantanea en formato JSON (GET /api/v1/privacy/export) e interruptores en vivo para revocar Camara, Voz, IA Externa y Visibilidad de Perfil con registro de fecha y hora.',
  },
  {
    number: '05',
    code: 'Articulos 36 y 37 — LFPDPPP / Art. 22 RGPD (IA Etica)',
    title: 'Procesamiento Local de Biometricos y Prohibicion de Decisiones Automatizadas',
    summary:
      'AURA es un sistema de apoyo a decisiones: ningun algoritmo de busqueda, compatibilidad o analisis de CV contrata, mueve de etapa ni descarta candidatos automaticamente.',
    safeguard:
      'Tu camara (MediaPipe) y tu voz (Web Speech API) se procesan 100% dentro de tu propio navegador; nunca se graba ni se envia video o audio al servidor. Toda decision de seleccion la toma exclusivamente un ser humano.',
  },
]

export function LegalNoticeShowcase({
  compact = false,
  onAcceptAll,
}: {
  compact?: boolean
  onAcceptAll?: () => void
}) {
  const [selectedLang, setSelectedLang] = useState<ProgrammingLangBadge>(OPEN_SOURCE_LANGUAGES[0]!)

  return (
    <div
      className="flex flex-col gap-8 sm:gap-10"
      aria-label="Aviso de Privacidad Integral y Deslinde Tecnologico Open Source"
    >
      {/* SECCION 1: Marco Juridico y Articulos de la Ley (Amplios, espaciados y faciles de leer) */}
      <section
        className="card-3d rounded-3xl p-5 sm:p-7 md:p-8"
        aria-label="Articulos legales cumplidos en el Aviso de Privacidad"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="icon-orb-3d flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-aura-400">
              <Scale className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="hud-label text-aura-400">
                Marco Juridico y Cumplimiento Normativo (LFPDPPP / RGPD / ISO 27001)
              </p>
              <h3 className="mt-1 font-display text-lg font-bold text-bone sm:text-xl md:text-2xl">
                Articulos de Proteccion de Datos y Resguardo de Informacion
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-graphite-300">
                Cada articulo detalla que informacion tratamos, con que finalidad y que controles tecnicos protegen tu privacidad.
              </p>
            </div>
          </div>
          <AuraBadge tone="success">Vigencia 2026 — Politica v1.4</AuraBadge>
        </div>

        {/* Lista espaciada de Articulos con tipografia mas grande y clara */}
        <div className={cn('mt-6 grid gap-5 sm:gap-6', compact ? 'grid-cols-1' : 'lg:grid-cols-2')}>
          {LEGAL_ARTICLES.map((art) => (
            <article
              key={art.code}
              className="bubble-card flex flex-col justify-between gap-4 rounded-2xl p-5 sm:p-6"
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 rounded-xl border border-aura-500/40 bg-aura-500/15 px-3 py-1.5 font-mono text-xs font-bold text-aura-400">
                    <FileCheck2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {art.code}
                  </span>
                  <span className="font-mono text-xs font-bold text-graphite-400">
                    Apartado #{art.number}
                  </span>
                </div>

                <h4 className="font-display text-base font-bold leading-snug text-bone sm:text-lg">
                  {art.title}
                </h4>

                <p className="text-sm leading-relaxed text-graphite-300 sm:text-[15px]">
                  {art.summary}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-xs leading-relaxed text-bone sm:text-sm">
                <p className="font-display font-bold text-emerald-400">
                  Como resguardamos tu informacion:
                </p>
                <p className="mt-1 text-graphite-300">{art.safeguard}</p>
              </div>
            </article>
          ))}
        </div>

        {/* Resumen visual de las 3 capas de seguridad */}
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <div className="neo-inset flex items-start gap-3.5 rounded-2xl p-4 sm:p-5">
            <Lock className="mt-0.5 h-6 w-6 shrink-0 text-aura-400" aria-hidden="true" />
            <div>
              <p className="font-display text-sm font-bold text-bone sm:text-base">
                Cifrado Criptografico
              </p>
              <p className="mt-1 text-xs leading-relaxed text-graphite-300 sm:text-sm">
                Argon2id para credenciales, firmas HMAC-SHA256 en JWT y cookies HttpOnly SameSite=Strict.
              </p>
            </div>
          </div>
          <div className="neo-inset flex items-start gap-3.5 rounded-2xl p-4 sm:p-5">
            <Database className="mt-0.5 h-6 w-6 shrink-0 text-sky-400" aria-hidden="true" />
            <div>
              <p className="font-display text-sm font-bold text-bone sm:text-base">
                Aislamiento y Auditoria
              </p>
              <p className="mt-1 text-xs leading-relaxed text-graphite-300 sm:text-sm">
                Control de acceso RBAC por rol, bitacora inmutable en base de datos y bloqueo automatico ante fuerza bruta.
              </p>
            </div>
          </div>
          <div className="neo-inset flex items-start gap-3.5 rounded-2xl p-4 sm:p-5">
            <Cpu className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" aria-hidden="true" />
            <div>
              <p className="font-display text-sm font-bold text-bone sm:text-base">
                Biometria 100% en tu Equipo
              </p>
              <p className="mt-1 text-xs leading-relaxed text-graphite-300 sm:text-sm">
                Ni el video de tu camara ni el audio de tu microfono salen de tu dispositivo hacia servidores externos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECCION 2: Recuadro de Deslinde Open Source con Logos Interactivos */}
      <section
        className="card-3d card-shimmer relative overflow-hidden rounded-3xl border-2 border-aura-500/55 p-5 sm:p-7 md:p-8"
        aria-label="Deslinde de responsabilidad por lenguajes y tecnologias Open Source"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="icon-orb-3d flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-aura-400">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="hud-label text-aura-400">
                  Clausula de Deslinde Tecnologico
                </span>
                <AuraBadge tone="warning">Ecosistema Open Source Mundial</AuraBadge>
              </div>
              <h3 className="mt-1 font-display text-lg font-bold text-bone sm:text-xl md:text-2xl">
                Deslinde de Responsabilidad por Lenguajes de Programacion Open Source
              </h3>
            </div>
          </div>
          <AuraBadge tone="info">Selecciona un lenguaje para ver su licencia</AuraBadge>
        </div>

        {/* Escenario interactivo con logos de lenguajes de programacion */}
        <div
          className="relative mt-6 w-full overflow-hidden rounded-2xl border border-aura-500/30 bg-[#070911] p-4 shadow-inner sm:p-6"
          aria-label="Logos interactivos de lenguajes de programacion"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 25%, rgba(255,122,26,0.22), transparent 45%), radial-gradient(circle at 80% 70%, rgba(56,189,248,0.22), transparent 50%)',
            }}
          />

          <div className="relative z-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
            {OPEN_SOURCE_LANGUAGES.map((lang) => {
              const isSelected = selectedLang.id === lang.id
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setSelectedLang(lang)}
                  style={
                    {
                      '--b-delay': lang.delay,
                      borderColor: isSelected ? lang.color : 'rgba(255,255,255,0.14)',
                      boxShadow: isSelected ? `0 0 22px ${lang.bgGlow}` : undefined,
                    } as CSSProperties
                  }
                  className={cn(
                    'bubble-float btn-jelly flex flex-col items-center justify-center gap-2 rounded-2xl border bg-black/65 p-3.5 text-center transition',
                    isSelected ? 'scale-105 bg-white/10' : 'hover:bg-white/5',
                  )}
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl font-mono text-xs font-extrabold shadow-md"
                    style={{
                      backgroundColor: lang.bgGlow,
                      color: lang.color,
                      border: `1.5px solid ${lang.color}`,
                    }}
                  >
                    {lang.symbol}
                  </span>
                  <span className="w-full truncate font-display text-xs font-bold text-white">
                    {lang.name}
                  </span>
                  <span className="font-mono text-[10px] text-slate-300">{lang.version}</span>
                </button>
              )
            })}
          </div>

          {/* Inspector del lenguaje seleccionado */}
          <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-black/75 px-4 py-3.5 text-xs text-slate-200 sm:text-sm">
            <div className="flex items-center gap-3">
              <Code2 className="h-5 w-5 shrink-0 text-aura-400" aria-hidden="true" />
              <div>
                <span className="font-bold text-white">
                  {selectedLang.name} ({selectedLang.version})
                </span>{' '}
                — <span>{selectedLang.role}</span>
              </div>
            </div>
            <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 font-mono text-xs text-amber-300">
              Licencia: {selectedLang.license}
            </span>
          </div>
        </div>

        {/* Declaracion juridica de deslinde amplia y espaciada */}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5 text-sm leading-relaxed text-bone">
            <p className="flex items-center gap-2 font-display text-base font-bold text-amber-300">
              <Terminal className="h-5 w-5 shrink-0" aria-hidden="true" />
              1. Naturaleza del Software de Codigo Abierto (Open Source)
            </p>
            <p className="mt-2.5 text-graphite-300">
              AURA Talent AI opera sobre lenguajes de programacion, compiladores, motores de base de datos y bibliotecas de codigo abierto de estandar mundial (<strong className="text-bone">Python, TypeScript, JavaScript, PostgreSQL, Rust, C++/WASM, React y FastAPI</strong>), distribuidos globalmente bajo licencias abiertas (MIT, Apache 2.0, BSD y PSF) en modalidad <strong className="text-bone">«TAL CUAL» (AS IS)</strong>.
            </p>
          </div>

          <div className="rounded-2xl border border-aura-500/35 bg-aura-500/10 p-5 text-sm leading-relaxed text-bone">
            <p className="flex items-center gap-2 font-display text-base font-bold text-aura-400">
              <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
              2. Deslinde ante Caidas y Vulnerabilidades Globales Upstream
            </p>
            <p className="mt-2.5 text-graphite-300">
              Derivado de las recientes caidas de infraestructura global y vulnerabilidades de dia cero (Zero-Day CVEs) registradas a nivel mundial en lenguajes de programacion y repositorios publicos (npm, PyPI, crates), <strong className="text-bone">AURA y sus desarrolladores se deslindan de responsabilidad civil, tecnica o patrimonial por interrupciones, fallas de ejecucion o vulnerabilidades originadas directamente en dichos lenguajes o dependencias externas fuera de nuestro control directo</strong>, comprometiendose a aplicar parches de seguridad y cuarentena de versiones (minimo 7 dias de verificacion previa) en cuanto sean publicados oficialmente.
            </p>
          </div>
        </div>

        {onAcceptAll && (
          <div className="mt-7 flex justify-end border-t border-white/10 pt-5">
            <AuraButton size="lg" icon={Check} onClick={onAcceptAll}>
              He leido y acepto los Terminos, el Aviso de Privacidad y el Deslinde Open Source
            </AuraButton>
          </div>
        )}
      </section>
    </div>
  )
}

export function LegalNoticeModal({
  open,
  onClose,
  onAccept,
}: {
  open: boolean
  onClose: () => void
  onAccept: () => void
}) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Terminos y Condiciones, Aviso de Privacidad Integral y Deslinde Open Source"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-2.5 backdrop-blur-md sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-surface flex max-h-[94dvh] w-full max-w-6xl flex-col gap-6 overflow-y-auto rounded-3xl p-4 sm:p-7 md:p-9"
      >
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="icon-orb-3d flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-aura-400">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="hud-label text-aura-400">Centro Legal y Proteccion de Datos Sensibles</p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-bone sm:text-xl md:text-2xl">
                Terminos de Uso, Aviso de Privacidad Integral y Deslinde Open Source
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <AuraButton
              size="md"
              icon={Sparkles}
              onClick={() => {
                onAccept()
                onClose()
              }}
            >
              Aceptar Todo y Continuar
            </AuraButton>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar aviso legal"
              className="btn-jelly rounded-xl border border-white/15 bg-black/40 p-2.5 text-graphite-300 hover:border-aura-500 hover:text-bone"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <LegalNoticeShowcase
          onAcceptAll={() => {
            onAccept()
            onClose()
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
