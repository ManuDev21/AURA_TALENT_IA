import {
  Activity,
  Award,
  ChartColumn,
  ChartPie,
  CheckCircle2,
  FileCheck2,
  Quote,
  Save,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { type CSSProperties, memo, type ReactNode, useMemo, useState } from 'react'
import { cvApi, cvKeys } from '@/api/cv'
import { queryKeys } from '@/api/talent'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { AuraCheckbox } from '@/components/aura/AuraCheckbox'
import { AuraSelect } from '@/components/aura/AuraField'
import { AuraInput } from '@/components/aura/AuraInput'
import { useAuraMutation } from '@/hooks/useAuraMutation'
import type {
  ConfirmResult,
  CvConfirmPayload,
  CvDocument,
  ParsedCertification,
  ParsedCv,
  ParsedEducation,
  ParsedExperience,
  ParsedLanguage,
  ParsedLink,
} from '@/types/cv'
import { cn } from '@/utils/cn'
import { fromMonthInput, toMonthInput } from '@/utils/dates'
import { EDUCATION_LEVEL, LANGUAGES, LINK_TYPE, options } from '@/utils/labels'

interface Row<T> {
  data: T
  selected: boolean
}

interface CvDimensionMetric {
  id: string
  label: string
  score: number
  weight: number
  color: string
  status: 'optimo' | 'mejorable' | 'critico'
  summary: string
}

interface CvActionRecommendation {
  priority: 'alta' | 'media' | 'fortaleza'
  category: string
  title: string
  detail: string
  impactGain: string
}

const rows = <T extends { confidence: number }>(items: T[], min = 0.6): Row<T>[] =>
  items.map((data) => ({ data, selected: data.confidence >= min }))

function Confidence({ value }: { value: number }) {
  const [tone, label] =
    value >= 0.8 ? (['success', 'Alta'] as const) : value >= 0.6 ? (['aura', 'Media'] as const) : (['warning', 'Baja'] as const)
  return (
    <AuraBadge tone={tone} className="shrink-0">
      Confianza {label}
    </AuraBadge>
  )
}

function Evidence({ text }: { text: string }) {
  return (
    <details className="group mt-1 text-xs">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-graphite-400 hover:text-aura-400">
        <Quote className="h-3 w-3" aria-hidden="true" /> Ver evidencia extraida
      </summary>
      <blockquote className="mt-1 border-l-2 border-aura-500/40 pl-2 italic text-graphite-300">{text}</blockquote>
    </details>
  )
}

function Group({ title, count, total, children }: { title: string; count: number; total: number; children: ReactNode }) {
  if (total === 0) return null
  return (
    <section aria-label={title} className="flex flex-col gap-2.5">
      <h3 className="hud-label flex items-center justify-between text-graphite-300">
        {title}
        <span className="font-mono text-aura-400">
          {count}/{total}
        </span>
      </h3>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </section>
  )
}

function Item({
  row,
  label,
  onToggle,
  blocked,
  confidence,
  evidence,
  children,
}: {
  row: { selected: boolean }
  label: string
  onToggle: (v: boolean) => void
  blocked?: string
  confidence: number
  evidence: string
  children?: ReactNode
}) {
  return (
    <li
      className={cn(
        'bubble-card rounded-2xl border p-4 transition',
        row.selected ? 'border-aura-500/35 bg-aura-500/[0.04]' : 'border-white/5 bg-white/[0.02]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <AuraCheckbox label={label} checked={row.selected && !blocked} disabled={!!blocked} onChange={(e) => onToggle(e.target.checked)} />
          {blocked && (
            <p className="mt-1 flex items-center gap-1 pl-8 text-xs text-warning">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              {blocked}
            </p>
          )}
        </div>
        <Confidence value={confidence} />
      </div>
      {children && <div className="mt-3 pl-8">{children}</div>}
      <div className="pl-8">
        <Evidence text={evidence} />
      </div>
    </li>
  )
}

export function analyzeCvFormatAndSelection(document: CvDocument, parsed: ParsedCv) {
  const pages = Math.max(1, parsed.stats.pages || 1)
  const chars = parsed.stats.characters || 0
  const lines = Math.max(1, parsed.stats.lines || 1)
  const estimatedWords = Math.round(chars / 5.8)
  const avgCharsPerLine = Math.round(chars / lines)

  const hasName = !!parsed.fields.full_name?.value
  const hasEmail = !!parsed.fields.email?.value
  const hasPhone = !!parsed.fields.phone?.value
  const hasHeadline = !!parsed.fields.headline?.value
  const hasSummary = !!parsed.fields.summary?.value && (parsed.fields.summary.value.length ?? 0) >= 40
  const hasLinks = parsed.links.length > 0

  const contactScore = Math.min(
    100,
    (hasName ? 22 : 0) +
      (hasEmail ? 24 : 0) +
      (hasPhone ? 16 : 0) +
      (hasHeadline ? 14 : 0) +
      (hasSummary ? 14 : 0) +
      (hasLinks ? 10 : 0),
  )

  const isOptimalPages = pages >= 1 && pages <= 2
  const isGoodWordCount = estimatedWords >= 220 && estimatedWords <= 950
  const sectionsRatio = Math.min(1, parsed.sections_found.length / 5)
  const warningPenalty = Math.min(25, parsed.warnings.length * 8)
  const atsScore = Math.max(
    25,
    Math.min(
      100,
      Math.round(
        (isOptimalPages ? 32 : 18) +
          (isGoodWordCount ? 28 : 14) +
          sectionsRatio * 40 -
          warningPenalty,
      ),
    ),
  )

  const expCount = parsed.experiences.length
  const expWithDates = parsed.experiences.filter((e) => !!e.start_date).length
  const expWithCompany = parsed.experiences.filter((e) => !!e.company_name && e.company_name !== 'Sin especificar').length
  const experienceScore =
    expCount === 0
      ? 20
      : Math.min(
          100,
          Math.round(
            Math.min(45, expCount * 18) +
              (expWithDates / expCount) * 30 +
              (expWithCompany / expCount) * 25,
          ),
        )

  const metricRegex = /(\d+%|\d+\s*(usuarios|clientes|proyectos|horas|dias|meses|anos|ms|veces|equipos|modulos)|increment|reduj|optimiz|mejor|lider|implement|automatiz|logr)/i
  const experiencesWithMetrics = parsed.experiences.filter((e) => {
    const combined = `${e.description ?? ''} ${e.achievements.join(' ')}`
    return metricRegex.test(combined) || e.achievements.length >= 2
  }).length
  const impactScore =
    expCount === 0
      ? hasSummary
        ? 45
        : 25
      : Math.min(
          100,
          Math.round(30 + (experiencesWithMetrics / expCount) * 55 + (hasSummary ? 15 : 0)),
        )

  const skillCount = parsed.skills.length
  const skillCategories = new Set(parsed.skills.map((s) => s.category ?? 'General')).size
  const skillsScore = Math.min(
    100,
    Math.round(Math.min(70, skillCount * 9) + Math.min(30, skillCategories * 10)),
  )

  const eduCount = parsed.education.length
  const langWithLevel = parsed.languages.filter((l) => !!l.level).length
  const certCount = parsed.certifications.length
  const credentialsScore = Math.min(
    100,
    Math.round(
      (eduCount > 0 ? 48 : 15) +
        Math.min(28, langWithLevel * 14 + parsed.languages.length * 6) +
        Math.min(24, certCount * 12),
    ),
  )

  const dimensions: CvDimensionMetric[] = [
    {
      id: 'ats',
      label: 'Formato y Legibilidad ATS',
      score: atsScore,
      weight: 0.22,
      color: 'var(--color-aura-500)',
      status: atsScore >= 80 ? 'optimo' : atsScore >= 58 ? 'mejorable' : 'critico',
      summary: `${pages} pag., ~${estimatedWords} palabras, ${parsed.sections_found.length} bloques estandar detectados.`,
    },
    {
      id: 'impact',
      label: 'Evidencia de Impacto y Logros',
      score: impactScore,
      weight: 0.22,
      color: 'var(--color-contrast)',
      status: impactScore >= 78 ? 'optimo' : impactScore >= 55 ? 'mejorable' : 'critico',
      summary: `${experiencesWithMetrics}/${expCount} puestos con verbos de accion o metricas cuantificables.`,
    },
    {
      id: 'skills',
      label: 'Densidad de Habilidades Clave',
      score: skillsScore,
      weight: 0.2,
      color: 'var(--color-aura-400)',
      status: skillsScore >= 78 ? 'optimo' : skillsScore >= 52 ? 'mejorable' : 'critico',
      summary: `${skillCount} habilidades del catalogo en ${skillCategories} categorias tecnicas/transversales.`,
    },
    {
      id: 'experience',
      label: 'Estructura de Experiencia',
      score: experienceScore,
      weight: 0.16,
      color: 'var(--color-aura-300)',
      status: experienceScore >= 80 ? 'optimo' : experienceScore >= 55 ? 'mejorable' : 'critico',
      summary: `${expWithDates}/${expCount} experiencias con cronologia verificable y cargo definido.`,
    },
    {
      id: 'contact',
      label: 'Identidad y Enlaces Profesionales',
      score: contactScore,
      weight: 0.1,
      color: '#a855f7',
      status: contactScore >= 80 ? 'optimo' : contactScore >= 55 ? 'mejorable' : 'critico',
      summary: `Contacto (${[hasName && 'Nombre', hasEmail && 'Email', hasPhone && 'Tel'].filter(Boolean).join(', ') || 'Incompleto'}) y ${parsed.links.length} enlaces.`,
    },
    {
      id: 'credentials',
      label: 'Educacion, Idiomas y Certificaciones',
      score: credentialsScore,
      weight: 0.1,
      color: '#ec4899',
      status: credentialsScore >= 75 ? 'optimo' : credentialsScore >= 50 ? 'mejorable' : 'critico',
      summary: `${eduCount} estudios, ${parsed.languages.length} idiomas y ${certCount} certificaciones.`,
    },
  ]

  const overallScore = Math.round(
    dimensions.reduce((acc, d) => acc + d.score * d.weight, 0),
  )

  const allConfidences = [
    ...Object.values(parsed.fields).map((f) => f?.confidence ?? 0.8),
    ...parsed.experiences.map((e) => e.confidence),
    ...parsed.education.map((e) => e.confidence),
    ...parsed.skills.map((s) => s.confidence),
  ]
  const avgConfidence = allConfidences.length
    ? Math.round((allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length) * 100)
    : 82

  const recommendations: CvActionRecommendation[] = []

  if (!hasSummary || !hasHeadline) {
    recommendations.push({
      priority: 'alta',
      category: 'Resumen Ejecutivo',
      title: 'Incluir un Titular y Resumen Profesional de 3 a 4 lineas',
      detail:
        'Los reclutadores y sistemas ATS priorizan un resumen inicial que conecte tu rol objetivo, anos de experiencia y 3 tecnologias principales.',
      impactGain: '+12% en retencion de lectura',
    })
  }
  if (expCount === 0 || experiencesWithMetrics < expCount) {
    recommendations.push({
      priority: 'alta',
      category: 'Logros Medibles (STAR)',
      title: 'Cuantificar logros con porcentajes, tiempos o alcance en cada puesto',
      detail:
        'Transforma funciones pasivas en resultados verificables (ej. "Optimice consultas SQL reduciendo el tiempo de respuesta en 35%").',
      impactGain: '+18% en efectividad de seleccion',
    })
  }
  if (expWithDates < expCount) {
    recommendations.push({
      priority: 'alta',
      category: 'Cronologia ATS',
      title: 'Completar fechas de inicio y fin (mes y ano) en toda la experiencia',
      detail:
        'Los lectores automaticos descartan o penalizan bloques de experiencia cuando no detectan el rango temporal completo.',
      impactGain: '+10% en parseo ATS',
    })
  }
  if (skillCount < 6) {
    recommendations.push({
      priority: 'media',
      category: 'Palabras Clave Tecnicas',
      title: 'Ampliar la seccion de habilidades con terminos estandar del sector',
      detail: `Se detectaron ${skillCount} habilidades. Incluir entre 8 y 14 competencias nucleares eleva el puntaje en motores de compatibilidad (AURA Match).`,
      impactGain: '+15% en compatibilidad Match',
    })
  }
  if (!hasLinks) {
    recommendations.push({
      priority: 'media',
      category: 'Evidencia Verificable',
      title: 'Agregar enlaces a LinkedIn, GitHub o Portfolio Publico',
      detail:
        'Contar con enlaces directos a repositorios o portafolio valida las habilidades declaradas ante el equipo contratante.',
      impactGain: '+8% en confianza de perfil',
    })
  }
  if (parsed.languages.some((l) => !l.level)) {
    recommendations.push({
      priority: 'media',
      category: 'Idiomas MCER',
      title: 'Especificar el nivel de dominio (B1, B2, C1, Nativo) junto a cada idioma',
      detail:
        'Mencionar el idioma sin su nivel impide validar requisitos minimos de comunicacion en vacantes globales.',
      impactGain: '+6% en completitud',
    })
  }

  recommendations.push({
    priority: 'fortaleza',
    category: 'Formato del Archivo',
    title: `Archivo ${document.mime_type.includes('pdf') ? 'PDF' : 'DOCX'} con texto seleccionable (${(document.size_bytes / 1024).toFixed(0)} KB)`,
    detail: `Tu documento tiene ${pages} pagina(s) y ${avgCharsPerLine} caracteres por linea en promedio, permitiendo extraccion directa sin necesidad de OCR.`,
    impactGain: 'Estable para sistemas ATS',
  })

  const compositionItems = [
    { label: 'Habilidades tecnicas', count: Math.max(1, skillCount), color: '#10b981' },
    { label: 'Experiencias laborales', count: Math.max(1, expCount), color: '#ff7a1a' },
    { label: 'Educacion academica', count: Math.max(1, eduCount), color: '#38bdf8' },
    { label: 'Certificaciones e idiomas', count: Math.max(1, certCount + parsed.languages.length), color: '#f59e0b' },
    { label: 'Enlaces y contacto', count: Math.max(1, parsed.links.length + (hasEmail ? 1 : 0) + (hasPhone ? 1 : 0)), color: '#a855f7' },
  ]
  const totalComp = Math.max(1, compositionItems.reduce((s, i) => s + i.count, 0))
  const pieComposition = compositionItems.map((i) => ({
    ...i,
    percentage: Number(((i.count / totalComp) * 100).toFixed(1)),
  }))

  return {
    overallScore,
    avgConfidence,
    estimatedWords,
    avgCharsPerLine,
    pages,
    dimensions,
    recommendations,
    pieComposition,
  }
}

export const CvFormatDiagnostics = memo(function CvFormatDiagnostics({
  document,
  parsed,
}: {
  document: CvDocument
  parsed: ParsedCv
}) {
  const analysis = useMemo(
    () => analyzeCvFormatAndSelection(document, parsed),
    [document, parsed],
  )

  const radius = 56
  const circumference = 2 * Math.PI * radius
  const donutSegments = useMemo(() => {
    let acc = 0
    return analysis.pieComposition.map((item) => {
      const frac = item.percentage / 100
      const dash = frac * circumference
      const offset = -acc * circumference
      acc += frac
      return { ...item, dash, offset }
    })
  }, [analysis.pieComposition, circumference])

  return (
    <section
      className="flex flex-col gap-6"
      aria-label="Analisis completo de formato, estadisticas ATS y recomendaciones de seleccion"
    >
      <div className="card-3d card-shimmer card-stagger flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-3.5">
          <div className="icon-orb-3d flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-aura-400">
            <Award className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <p className="hud-label text-aura-400">Diagnostico Integral de Formato y Competitividad ATS</p>
            <h3 className="mt-1 font-display text-xl font-bold text-bone">
              Efectividad de tu CV: {analysis.overallScore}% —{' '}
              {analysis.overallScore >= 82
                ? 'Perfil de Alta Seleccion'
                : analysis.overallScore >= 65
                  ? 'Estructura Competitiva'
                  : 'Con Oportunidades Clave de Mejora'}
            </h3>
            <p className="mt-1 text-xs text-graphite-300">
              Archivo: <strong className="text-bone">{document.original_filename}</strong> ({(document.size_bytes / 1024).toFixed(1)} KB)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AuraBadge tone="success">Nitidez ATS: {analysis.avgConfidence}%</AuraBadge>
          <AuraBadge tone="info">{analysis.pages} pagina(s)</AuraBadge>
          <AuraBadge tone="aura">~{analysis.estimatedWords} palabras</AuraBadge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="card-3d card-stagger p-4">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Score Global ATS</p>
          <p className="mt-1 font-mono text-2xl font-bold text-aura-400">{analysis.overallScore}%</p>
          <p className="mt-1 text-[11px] text-graphite-300">Indice ponderado de 6 dimensiones</p>
        </div>
        <div className="card-3d card-stagger p-4">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Volumen de Texto</p>
          <p className="mt-1 font-mono text-2xl font-bold text-sky-300">{analysis.estimatedWords}</p>
          <p className="mt-1 text-[11px] text-graphite-300">Palabras ({parsed.stats.lines} lineas)</p>
        </div>
        <div className="card-3d card-stagger p-4">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Densidad por Linea</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-300">{analysis.avgCharsPerLine}</p>
          <p className="mt-1 text-[11px] text-graphite-300">Caracteres/linea (optimo 55-95)</p>
        </div>
        <div className="card-3d card-stagger p-4">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Secciones Estandar</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-400">{parsed.sections_found.length}</p>
          <p className="mt-1 truncate text-[11px] text-graphite-300">
            {parsed.sections_found.join(', ') || 'Estructura libre'}
          </p>
        </div>
        <div className="card-3d card-stagger p-4">
          <p className="text-[10px] uppercase tracking-wider text-graphite-400">Skills Detectadas</p>
          <p className="mt-1 font-mono text-2xl font-bold text-purple-300">{parsed.skills.length}</p>
          <p className="mt-1 text-[11px] text-graphite-300">Reconocidas en el catalogo AURA</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card-3d card-shimmer flex min-w-0 flex-col justify-between gap-4 p-5">
          <div>
            <div className="flex items-center gap-2">
              <ChartColumn className="h-4 w-4 text-aura-400" aria-hidden="true" />
              <h4 className="hud-label text-bone">
                Grafica de Barras y Burbujas: Evaluacion por Dimension del CV
              </h4>
            </div>
            <p className="mt-1 text-xs text-graphite-400">
              Puntaje de cada pilar estructural frente al estandar recomendado para seleccion (85%)
            </p>
          </div>

          <svg
            viewBox="0 0 560 235"
            className="h-auto w-full rounded-xl border border-white/5 bg-[#09090d]"
            role="img"
            aria-label="Grafica de barras de las 6 dimensiones del CV"
          >
            {[25, 50, 75, 100].map((pct) => {
              const gy = 24 + 165 * (1 - pct / 100)
              return (
                <g key={pct}>
                  <line x1="42" y1={gy} x2="540" y2={gy} stroke="#ffffff" strokeOpacity="0.07" strokeDasharray="3 5" />
                  <text x="36" y={gy + 3} textAnchor="end" fill="#7a7a85" fontSize="8.5" fontFamily="monospace">
                    {pct}%
                  </text>
                </g>
              )
            })}

            {analysis.dimensions.map((dim, idx) => {
              const slot = 498 / analysis.dimensions.length
              const cx = 42 + idx * slot + slot / 2
              const barW = 28
              const bh = (dim.score / 100) * 165
              const by = 24 + 165 - bh
              return (
                <g key={dim.id} style={{ '--b-delay': idx } as CSSProperties}>
                  <rect
                    x={cx - barW / 2}
                    y={by}
                    width={barW}
                    height={Math.max(4, bh)}
                    rx="7"
                    fill={dim.color}
                    className="bar-grow"
                  />
                  <circle
                    cx={cx}
                    cy={by}
                    r="5.5"
                    fill="#ffffff"
                    stroke={dim.color}
                    strokeWidth="2"
                    className="bubble-pop"
                  />
                  <text x={cx} y={by - 9} textAnchor="middle" fill="#f8fafc" fontSize="9" fontWeight="bold" fontFamily="monospace">
                    {dim.score}%
                  </text>
                  <text x={cx} y={212} textAnchor="middle" fill="#cbd5e1" fontSize="8.5">
                    {dim.label.split(' ')[0]}
                  </text>
                </g>
              )
            })}
          </svg>

          <div className="grid gap-2 sm:grid-cols-2">
            {analysis.dimensions.map((d) => (
              <div key={d.id} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-bone">{d.label}</span>
                  <span className="font-mono font-bold" style={{ color: d.color }}>
                    {d.score}%
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-graphite-300">{d.summary}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card-3d card-shimmer flex min-w-0 flex-col justify-between gap-5 overflow-hidden p-5">
          <div>
            <div className="flex items-center gap-2">
              <ChartPie className="h-4 w-4 text-sky-400" aria-hidden="true" />
              <h4 className="hud-label text-bone">
                Grafica de Pastel: Distribucion y Equilibrio de Secciones
              </h4>
            </div>
            <p className="mt-1 text-xs text-graphite-400">
              Proporcion de evidencias extraidas entre habilidades, experiencia, educacion y credenciales
            </p>
          </div>

          <div className="flex flex-col items-center gap-5">
            <div className="bubble-pop relative flex h-40 w-40 shrink-0 items-center justify-center">
              <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label="Distribucion del CV">
                <circle cx="80" cy="80" r={radius} fill="none" stroke="#1f1f27" strokeWidth="20" />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.label}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="20"
                    strokeLinecap="round"
                    strokeDasharray={`${seg.dash} ${circumference}`}
                    strokeDashoffset={seg.offset}
                  />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-2xl font-bold text-bone">{analysis.overallScore}%</span>
                <span className="text-[10px] uppercase tracking-wider text-graphite-400">Score CV</span>
              </div>
            </div>

            <ul className="grid w-full min-w-0 gap-2.5 sm:grid-cols-2">
              {analysis.pieComposition.map((item) => (
                <li
                  key={item.label}
                  className="flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl border border-white/5 bg-black/30 p-3 text-xs"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate font-medium text-bone">{item.label}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-bone">{item.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="bar-grow h-full rounded-full"
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-graphite-400">
                    Elementos detectados: {item.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section
        className="card-3d card-shimmer p-5"
        aria-label="Recomendaciones clave para ser la mejor seleccion"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-aura-400" aria-hidden="true" />
            <h4 className="hud-label text-bone">
              Puntos Clave a Tomar en Cuenta para Destacar en el Proceso de Seleccion
            </h4>
          </div>
          <span className="text-xs text-graphite-400">
            Diagnostico determinista de estructura, impacto y palabras clave
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-black/50 font-mono text-[10px] uppercase tracking-wider text-graphite-400">
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Accion recomendada</th>
                <th className="px-4 py-3">Explicacion tecnica para seleccion</th>
                <th className="px-4 py-3">Impacto estimado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {analysis.recommendations.map((rec, idx) => (
                <tr key={idx} className="bg-black/20 transition hover:bg-aura-500/10">
                  <td className="px-4 py-3">
                    <AuraBadge
                      tone={
                        rec.priority === 'alta'
                          ? 'warning'
                          : rec.priority === 'media'
                            ? 'info'
                            : 'success'
                      }
                    >
                      {rec.priority === 'alta'
                        ? 'Prioridad Alta'
                        : rec.priority === 'media'
                          ? 'Mejora Sugerida'
                          : 'Fortaleza'}
                    </AuraBadge>
                  </td>
                  <td className="px-4 py-3 font-mono text-aura-300">{rec.category}</td>
                  <td className="px-4 py-3 font-semibold text-bone">{rec.title}</td>
                  <td className="px-4 py-3 leading-relaxed text-graphite-300">{rec.detail}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-400">{rec.impactGain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
})

export function CvReview({
  document,
  onConfirmed,
  onCancel,
}: {
  document: CvDocument
  onConfirmed: (r: ConfirmResult) => void
  onCancel: () => void
}) {
  const parsed = document.parsed_data!
  const [viewMode, setViewMode] = useState<'diagnostico' | 'confirmar'>('diagnostico')
  const [headline, setHeadline] = useState({ use: false, value: parsed.fields.headline?.value ?? '' })
  const [summary, setSummary] = useState({ use: false, value: parsed.fields.summary?.value ?? '' })
  const [experiences, setExperiences] = useState(() => rows<ParsedExperience>(parsed.experiences))
  const [education, setEducation] = useState(() => rows<ParsedEducation>(parsed.education))
  const [certifications, setCertifications] = useState(() => rows<ParsedCertification>(parsed.certifications, 0.5))
  const [languages, setLanguages] = useState(() => rows<ParsedLanguage>(parsed.languages))
  const [links, setLinks] = useState(() => rows<ParsedLink>(parsed.links))
  const [skills, setSkills] = useState(() => new Set(parsed.skills.filter((s) => s.confidence >= 0.7).map((s) => s.skill_id)))

  const edit = <T,>(
    set: React.Dispatch<React.SetStateAction<Row<T>[]>>,
    index: number,
    patch: { selected?: boolean; data?: Partial<T> },
  ) =>
    set((prev) =>
      prev.map((r, i) => (i === index ? { selected: patch.selected ?? r.selected, data: { ...r.data, ...patch.data } } : r)),
    )

  const payload = useMemo<CvConfirmPayload>(
    () => ({
      headline: headline.use ? headline.value.trim() || null : null,
      summary: summary.use ? summary.value.trim() || null : null,
      experiences: experiences
        .filter((r) => r.selected && r.data.start_date && r.data.title.trim())
        .map(({ data: e }) => ({
          company_name: e.company_name.trim() || 'Sin especificar',
          title: e.title.trim(),
          start_date: e.start_date as string,
          end_date: e.is_current ? null : e.end_date,
          is_current: e.is_current,
          description: e.description,
          achievements: e.achievements,
        })),
      education: education
        .filter((r) => r.selected && r.data.institution.trim())
        .map(({ data: e }) => ({
          institution: e.institution.trim(),
          degree: e.degree,
          level: e.level,
          start_date: e.start_date,
          end_date: e.is_current ? null : e.end_date,
          is_current: e.is_current,
        })),
      certifications: certifications.filter((r) => r.selected && r.data.name.trim()).map(({ data: c }) => ({ name: c.name.trim(), issuer: c.issuer })),
      languages: languages
        .filter((r) => r.selected && r.data.level)
        .map(({ data: l }) => ({ language_code: l.language_code, level: l.level as string })),
      links: links.filter((r) => r.selected).map(({ data: l }) => ({ link_type: l.link_type, url: l.url })),
      skills: [...skills].map((skill_id) => ({ skill_id, proficiency: 3 })),
    }),
    [headline, summary, experiences, education, certifications, languages, links, skills],
  )
  const total =
    payload.experiences.length +
    payload.education.length +
    payload.certifications.length +
    payload.languages.length +
    payload.links.length +
    payload.skills.length +
    (payload.headline ? 1 : 0) +
    (payload.summary ? 1 : 0)

  const confirm = useAuraMutation({
    mutationFn: () => cvApi.confirm(document.id, payload),
    invalidate: [cvKeys.documents, cvKeys.document(document.id), queryKeys.candidate, queryKeys.indicators],
    success: 'Datos confirmados y guardados en tu perfil.',
    onSuccess: onConfirmed,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setViewMode('diagnostico')}
            className={`btn-jelly flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
              viewMode === 'diagnostico'
                ? 'border-aura-500 bg-aura-500/20 text-bone shadow-[0_0_16px_-4px_var(--color-aura-500)]'
                : 'border-white/10 bg-black/25 text-graphite-300 hover:text-bone'
            }`}
          >
            <Activity className="h-4 w-4 text-aura-400" />
            1. Analisis de Formato, Estadisticas y Seleccion
          </button>
          <button
            type="button"
            onClick={() => setViewMode('confirmar')}
            className={`btn-jelly flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
              viewMode === 'confirmar'
                ? 'border-aura-500 bg-aura-500/20 text-bone shadow-[0_0_16px_-4px_var(--color-aura-500)]'
                : 'border-white/10 bg-black/25 text-graphite-300 hover:text-bone'
            }`}
          >
            <FileCheck2 className="h-4 w-4 text-aura-400" />
            2. Revisar Datos Extraidos e Importar al Perfil ({total})
          </button>
        </div>

        <AuraButton variant="ghost" size="sm" onClick={onCancel}>
          Analizar otro archivo
        </AuraButton>
      </div>

      {viewMode === 'diagnostico' ? (
        <>
          <CvFormatDiagnostics document={document} parsed={parsed} />
          {!document.confirmed_at && (
            <div className="card-3d flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-xs text-graphite-300">
                Deseas importar las <strong className="text-bone">{total} evidencias detectadas</strong> (experiencias, estudios y habilidades) directamente a tu perfil de AURA?
              </p>
              <div className="flex gap-2">
                <AuraButton size="sm" variant="neo" onClick={() => setViewMode('confirmar')}>
                  Revisar detalle campo por campo
                </AuraButton>
                <AuraButton
                  size="sm"
                  icon={CheckCircle2}
                  loading={confirm.isPending}
                  disabled={total === 0}
                  onClick={() => confirm.mutate()}
                >
                  Confirmar e importar a mi perfil
                </AuraButton>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {parsed.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {w}
            </p>
          ))}

          {(parsed.fields.headline || parsed.fields.summary) && (
            <Group
              title="Perfil"
              count={Number(headline.use) + Number(summary.use)}
              total={Number(!!parsed.fields.headline) + Number(!!parsed.fields.summary)}
            >
              {parsed.fields.headline && (
                <Item
                  row={{ selected: headline.use }}
                  label="Usar como titular"
                  onToggle={(use) => setHeadline({ ...headline, use })}
                  confidence={parsed.fields.headline.confidence}
                  evidence={parsed.fields.headline.evidence}
                >
                  <AuraInput label="Titular" value={headline.value} onChange={(e) => setHeadline({ ...headline, value: e.target.value })} />
                </Item>
              )}
              {parsed.fields.summary && (
                <Item
                  row={{ selected: summary.use }}
                  label="Usar como resumen profesional"
                  onToggle={(use) => setSummary({ ...summary, use })}
                  confidence={parsed.fields.summary.confidence}
                  evidence={parsed.fields.summary.evidence}
                >
                  <textarea
                    aria-label="Resumen"
                    value={summary.value}
                    onChange={(e) => setSummary({ ...summary, value: e.target.value })}
                    rows={4}
                    className="neo-inset w-full rounded-xl bg-transparent p-3 text-sm text-bone focus:outline-none"
                  />
                </Item>
              )}
            </Group>
          )}

          <Group title="Experiencia" count={payload.experiences.length} total={experiences.length}>
            {experiences.map((r, i) => (
              <Item
                key={i}
                row={r}
                label={`${r.data.title}${r.data.company_name ? ` en ${r.data.company_name}` : ''}`}
                onToggle={(selected) => edit(setExperiences, i, { selected })}
                blocked={!r.data.start_date ? 'Falta la fecha de inicio: agregala para poder guardarla.' : undefined}
                confidence={r.data.confidence}
                evidence={r.data.evidence}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  <AuraInput label="Puesto" value={r.data.title} onChange={(e) => edit(setExperiences, i, { data: { title: e.target.value } })} />
                  <AuraInput label="Empresa" value={r.data.company_name} onChange={(e) => edit(setExperiences, i, { data: { company_name: e.target.value } })} />
                  <AuraInput label="Inicio" type="month" value={toMonthInput(r.data.start_date)} onChange={(e) => edit(setExperiences, i, { data: { start_date: fromMonthInput(e.target.value) } })} />
                  <AuraInput
                    label={r.data.is_current ? 'Fin (actual)' : 'Fin'}
                    type="month"
                    disabled={r.data.is_current}
                    value={toMonthInput(r.data.end_date)}
                    onChange={(e) => edit(setExperiences, i, { data: { end_date: fromMonthInput(e.target.value) } })}
                  />
                </div>
              </Item>
            ))}
          </Group>

          <Group title="Educacion" count={payload.education.length} total={education.length}>
            {education.map((r, i) => (
              <Item
                key={i}
                row={r}
                label={r.data.degree ? `${r.data.degree} - ${r.data.institution}` : r.data.institution}
                onToggle={(selected) => edit(setEducation, i, { selected })}
                confidence={r.data.confidence}
                evidence={r.data.evidence}
              >
                <div className="grid gap-2 md:grid-cols-3">
                  <AuraInput label="Institucion" value={r.data.institution} onChange={(e) => edit(setEducation, i, { data: { institution: e.target.value } })} />
                  <AuraInput label="Titulo" value={r.data.degree ?? ''} onChange={(e) => edit(setEducation, i, { data: { degree: e.target.value || null } })} />
                  <AuraSelect
                    label="Nivel"
                    options={options.educationLevel}
                    value={r.data.level ?? ''}
                    onChange={(e) => edit(setEducation, i, { data: { level: e.target.value || null } })}
                  />
                </div>
                {r.data.level && <p className="mt-1 text-[0.7rem] text-graphite-400">Detectado: {EDUCATION_LEVEL[r.data.level]}</p>}
              </Item>
            ))}
          </Group>

          {parsed.skills.length > 0 && (
            <section aria-label="Habilidades detectadas" className="flex flex-col gap-2">
              <h3 className="hud-label flex items-center justify-between text-graphite-300">
                Habilidades del catalogo
                <span className="font-mono text-aura-400">
                  {skills.size}/{parsed.skills.length}
                </span>
              </h3>
              <ul className="flex flex-wrap gap-2">
                {parsed.skills.map((s) => {
                  const on = skills.has(s.skill_id)
                  return (
                    <li key={s.skill_id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        title={`Evidencia: ${s.evidence}`}
                        onClick={() =>
                          setSkills((prev) => {
                            const next = new Set(prev)
                            if (on) next.delete(s.skill_id)
                            else next.add(s.skill_id)
                            return next
                          })
                        }
                        className={cn(
                          'btn-jelly rounded-lg border px-2.5 py-1 text-xs transition',
                          on ? 'border-aura-500/50 bg-aura-500/15 text-ember-300' : 'border-white/10 text-graphite-400 hover:text-bone',
                        )}
                      >
                        {s.name}
                        {s.matched.toLowerCase() !== s.name.toLowerCase() && <span className="text-graphite-400"> ({s.matched})</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <Group title="Idiomas" count={payload.languages.length} total={languages.length}>
            {languages.map((r, i) => (
              <Item
                key={r.data.language_code}
                row={r}
                label={LANGUAGES[r.data.language_code] ?? r.data.language_code}
                onToggle={(selected) => edit(setLanguages, i, { selected })}
                blocked={!r.data.level ? 'El CV no indica el nivel. Elige uno para guardarlo (AURA no lo supone).' : undefined}
                confidence={r.data.confidence}
                evidence={r.data.evidence}
              >
                <AuraSelect
                  label="Nivel"
                  options={options.languageLevel}
                  value={r.data.level ?? ''}
                  onChange={(e) => edit(setLanguages, i, { selected: true, data: { level: e.target.value || null } })}
                />
              </Item>
            ))}
          </Group>

          <Group title="Certificaciones" count={payload.certifications.length} total={certifications.length}>
            {certifications.map((r, i) => (
              <Item
                key={i}
                row={r}
                label={r.data.name}
                onToggle={(selected) => edit(setCertifications, i, { selected })}
                confidence={r.data.confidence}
                evidence={r.data.evidence}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  <AuraInput label="Nombre" value={r.data.name} onChange={(e) => edit(setCertifications, i, { data: { name: e.target.value } })} />
                  <AuraInput label="Emisor" value={r.data.issuer ?? ''} onChange={(e) => edit(setCertifications, i, { data: { issuer: e.target.value || null } })} />
                </div>
              </Item>
            ))}
          </Group>

          <Group title="Enlaces" count={payload.links.length} total={links.length}>
            {links.map((r, i) => (
              <Item
                key={r.data.url}
                row={r}
                label={`${LINK_TYPE[r.data.link_type] ?? r.data.link_type}: ${r.data.url}`}
                onToggle={(selected) => edit(setLinks, i, { selected })}
                confidence={r.data.confidence}
                evidence={r.data.evidence}
              />
            ))}
          </Group>

          {!document.confirmed_at && (
            <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-2 border-t border-white/5 bg-graphite-900/90 px-6 py-3 backdrop-blur">
              <span className="mr-auto text-xs text-graphite-400">{total} elementos seleccionados</span>
              <AuraButton variant="ghost" size="sm" onClick={onCancel}>
                Descartar
              </AuraButton>
              <AuraButton icon={Save} loading={confirm.isPending} disabled={total === 0} onClick={() => confirm.mutate()}>
                Confirmar y guardar
              </AuraButton>
            </div>
          )}
        </>
      )}
    </div>
  )
}
