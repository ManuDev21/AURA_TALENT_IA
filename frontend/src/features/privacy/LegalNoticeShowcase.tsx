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
    code: 'Articulos 6, 12, 14 y 15 — LFPDPPP / Art. 5 RGPD',
    title: 'Principios Rectores de Licitud, Finalidad, Lealtad y Proporcionalidad',
    summary:
      'AURA recaba unicamente los datos curriculares, academicos, laborales y de contacto estrictamente necesarios para apoyar tu empleabilidad, generacion de CV, rutas de aprendizaje y vinculacion con vacantes.',
    safeguard:
      'Minimización de datos: nunca solicitamos ni utilizamos atributos protegidos (origen etnico, religion, estado civil, orientacion o datos medicos) en ningun calculo del sistema.',
  },
  {
    code: 'Articulos 8 y 9 — LFPDPPP / Art. 9 RGPD',
    title: 'Consentimiento Expreso y Escudo sobre Datos Sensibles y Psicometricos',
    summary:
      'Todo tratamiento de datos personales y evaluaciones psicometricas del Assessment Center requiere el consentimiento libre, especifico, informado e inequivoco del titular.',
    safeguard:
      'Aislamiento estricto: los resultados psicometricos son propiedad privada del candidato y NUNCA se comparten con ninguna empresa sin accion explicita por postulacion.',
  },
  {
    code: 'Articulos 16 y 19 — LFPDPPP / Art. 32 RGPD / ISO 27001',
    title: 'Medidas de Seguridad Administrativas, Tecnicas y Criptograficas',
    summary:
      'Resguardamos tu informacion contra dano, perdida, alteracion, destruccion o acceso no autorizado mediante controles criptograficos de grado bancario y empresarial.',
    safeguard:
      'Contrasenas cifradas con Argon2id/Bcrypt, sesiones JWT de corta duracion + Refresh Tokens rotativos HttpOnly con revocacion de familia ante reuso, HSTS, Cache-Control no-store en /api y Service Worker PWA que jamas almacena endpoints de datos personales.',
  },
  {
    code: 'Articulos 22 al 27 — LFPDPPP / Art. 15 al 20 RGPD',
    title: 'Ejercicio Directo de Derechos ARCO (Acceso, Rectificacion, Cancelacion y Oposicion)',
    summary:
      'Como titular tienes derecho en todo momento a acceder a tus datos, rectificarlos, cancelar tu cuenta o revocar cualquier permiso otorgado sin penalizacion alguna.',
    safeguard:
      'Descarga portable instantanea en formato JSON (GET /api/v1/privacy/export) e interruptores en vivo para revocar Camara, Voz, IA Externa y Visibilidad de Perfil con registro de fecha y hora.',
  },
  {
    code: 'Articulos 36 y 37 — LFPDPPP / Art. 22 RGPD (IA Etica)',
    title: 'Procesamiento Local de Biométricos y Prohibicion de Decisiones Automatizadas',
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
    <div className="flex flex-col gap-6" aria-label="Aviso de Privacidad Integral y Deslinde Tecnologico Open Source">
      {/* Recuadro Muy Notorio de Deslinde Open Source con Logos de Lenguajes Flotando */}
      <section
        className="card-3d card-shimmer relative overflow-hidden rounded-3xl border-2 border-aura-500/55 p-5 md:p-6"
        aria-label="Deslinde de responsabilidad por lenguajes y tecnologias Open Source"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="icon-orb-3d flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-aura-400">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="hud-label text-aura-400">Aviso Tecnologico Importante — Clausula de Deslinde</span>
                <AuraBadge tone="warning">Ecosistema Open Source Mundial</AuraBadge>
              </div>
              <h3 className="mt-0.5 font-display text-lg font-bold text-bone md:text-xl">
                Deslinde de Responsabilidad por Lenguajes de Programacion y Bibliotecas Open Source
              </h3>
            </div>
          </div>
          <AuraBadge tone="info">Haz clic en cualquier lenguaje flotante</AuraBadge>
        </div>

        {/* Escenario interactivo con logos de lenguajes de programacion flotando */}
        <div
          className="relative mt-4 min-h-[210px] w-full overflow-hidden rounded-2xl border border-aura-500/30 bg-[#070911] p-4 shadow-inner"
          aria-label="Logos interactivos de lenguajes de programacion flotando"
        >
          {/* Gradiente y malla sutil de fondo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 25%, rgba(255,122,26,0.22), transparent 45%), radial-gradient(circle at 80% 70%, rgba(56,189,248,0.22), transparent 50%)',
            }}
          />

          <div className="relative z-10 grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-9">
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
                    'bubble-float btn-jelly flex flex-col items-center justify-center gap-1.5 rounded-2xl border bg-black/65 p-3 text-center transition',
                    isSelected ? 'scale-105 bg-white/10' : 'hover:bg-white/5',
                  )}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl font-mono text-xs font-extrabold shadow-md"
                    style={{
                      backgroundColor: lang.bgGlow,
                      color: lang.color,
                      border: `1.5px solid ${lang.color}`,
                    }}
                  >
                    {lang.symbol}
                  </span>
                  <span className="truncate font-display text-[11px] font-bold text-white">{lang.name}</span>
                  <span className="font-mono text-[9px] text-slate-300">{lang.version}</span>
                </button>
              )
            })}
          </div>

          {/* Inspector del lenguaje flotante seleccionado */}
          <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-black/75 px-4 py-3 text-xs text-slate-200">
            <div className="flex items-center gap-3">
              <Code2 className="h-4 w-4 shrink-0 text-aura-400" aria-hidden="true" />
              <div>
                <span className="font-bold text-white">
                  {selectedLang.name} ({selectedLang.version})
                </span>{' '}
                — <span>{selectedLang.role}</span>
              </div>
            </div>
            <span className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-amber-300">
              Licencia: {selectedLang.license}
            </span>
          </div>
        </div>

        {/* Declaracion juridica de deslinde por vulnerabilidades o caidas en lenguajes mundiales */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs leading-relaxed text-bone">
            <p className="flex items-center gap-2 font-display text-sm font-bold text-amber-300">
              <Terminal className="h-4 w-4 shrink-0" aria-hidden="true" />
              1. Naturaleza del Software de Codigo Abierto (Open Source)
            </p>
            <p className="mt-1.5 text-graphite-300">
              AURA Talent AI opera sobre lenguajes de programacion, compiladores, motores de base de datos y bibliotecas de codigo abierto de estandar mundial (<strong className="text-bone">Python, TypeScript, JavaScript, PostgreSQL, Rust, C++/WASM, React y FastAPI</strong>), distribuidos globalmente bajo licencias abiertas (MIT, Apache 2.0, BSD y PSF) en modalidad <strong className="text-bone">«TAL CUAL» (AS IS)</strong>.
            </p>
          </div>

          <div className="rounded-2xl border border-aura-500/35 bg-aura-500/10 p-4 text-xs leading-relaxed text-bone">
            <p className="flex items-center gap-2 font-display text-sm font-bold text-aura-400">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              2. Deslinde ante Caidas y Vulnerabilidades Globales Upstream
            </p>
            <p className="mt-1.5 text-graphite-300">
              Derivado de las recientes caidas de infraestructura global y vulnerabilidades de dia cero (Zero-Day CVEs) registradas a nivel mundial en lenguajes de programacion y repositorios publicos (npm, PyPI, crates), <strong className="text-bone">AURA y sus desarrolladores se deslindan de responsabilidad civil, tecnica o patrimonial por interrupciones, fallas de ejecucion o vulnerabilidades originadas directamente en dichos lenguajes o dependencias externas fuera de nuestro control directo</strong>, comprometiendose a aplicar parches de seguridad y cuarentena de versiones (minimo 7 dias de verificacion previa) en cuanto sean publicados oficialmente.
            </p>
          </div>
        </div>
      </section>

      {/* Articulos de la Ley y Resguardo de Datos Sensibles */}
      <section className="card-3d rounded-3xl p-5 md:p-6" aria-label="Articulos legales cumplidos en el Aviso de Privacidad">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Scale className="h-5 w-5 text-aura-400" aria-hidden="true" />
            <div>
              <h4 className="hud-label text-aura-400">
                Marco Juridico y Cumplimiento Normativo (LFPDPPP / RGPD / ISO 27001)
              </h4>
              <p className="mt-0.5 text-xs text-graphite-300">
                Articulos legales que respaldan el tratamiento y resguardo de tus datos personales y sensibles
              </p>
            </div>
          </div>
          <AuraBadge tone="success">Vigencia 2026 — Politica v1.4</AuraBadge>
        </div>

        <div className={cn('mt-4 grid gap-3.5', compact ? 'grid-cols-1' : 'md:grid-cols-2')}>
          {LEGAL_ARTICLES.map((art) => (
            <article
              key={art.code}
              className="bubble-card flex flex-col justify-between gap-2.5 rounded-2xl p-4"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-aura-500/35 bg-aura-500/15 px-2.5 py-1 font-mono text-[10px] font-bold text-aura-400">
                  <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {art.code}
                </span>
                <h5 className="mt-2 font-display text-sm font-bold text-bone">{art.title}</h5>
                <p className="mt-1 text-xs leading-relaxed text-graphite-300">{art.summary}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] leading-snug text-bone">
                <strong className="text-emerald-400">Como resguardamos tu informacion: </strong>
                {art.safeguard}
              </div>
            </article>
          ))}
        </div>

        {/* Arquitectura tecnica de resguardo */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="neo-inset flex items-start gap-3 rounded-2xl p-3.5">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-aura-400" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-bone">Cifrado Criptografico</p>
              <p className="mt-0.5 text-[11px] text-graphite-300">
                Argon2id para credenciales, firmas HMAC-SHA256 en JWT y cookies HttpOnly SameSite=Strict.
              </p>
            </div>
          </div>
          <div className="neo-inset flex items-start gap-3 rounded-2xl p-3.5">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-bone">Aislamiento y Auditoria</p>
              <p className="mt-0.5 text-[11px] text-graphite-300">
                Control de acceso RBAC por rol, bitacora inmutable en base de datos y bloqueo automatico ante fuerza bruta.
              </p>
            </div>
          </div>
          <div className="neo-inset flex items-start gap-3 rounded-2xl p-3.5">
            <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-bone">Biometria 100% en tu Equipo</p>
              <p className="mt-0.5 text-[11px] text-graphite-300">
                Ni el video de tu camara ni el audio de tu microfono salen de tu dispositivo hacia servidores externos.
              </p>
            </div>
          </div>
        </div>

        {onAcceptAll && (
          <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
            <AuraButton size="md" icon={Check} onClick={onAcceptAll}>
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
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-surface flex max-h-[92vh] w-full max-w-5xl flex-col gap-4 overflow-y-auto rounded-3xl p-5 md:p-7"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
          <div className="flex items-center gap-3">
            <div className="icon-orb-3d flex h-10 w-10 items-center justify-center rounded-2xl text-aura-400">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="hud-label text-aura-400">Centro Legal y Proteccion de Datos Sensibles</p>
              <h2 className="font-display text-xl font-bold text-bone">
                Terminos de Uso, Aviso de Privacidad Integral y Deslinde Open Source
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AuraButton
              size="sm"
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
              className="btn-jelly rounded-xl border border-white/15 bg-black/40 p-2 text-graphite-300 hover:border-aura-500 hover:text-bone"
            >
              <X className="h-4 w-4" />
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
