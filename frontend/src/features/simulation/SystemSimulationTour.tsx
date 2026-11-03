import {
  ArrowLeft,
  ArrowRight,
  Award,
  Brain,
  Briefcase,
  ChartColumn,
  ChartPie,
  CheckCircle2,
  CirclePlay,
  Cpu,
  FileText,
  Gauge,
  MessageSquare,
  Pause,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  WandSparkles,
  Workflow,
  X,
} from 'lucide-react'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AuraBadge } from '@/components/aura/AuraBadge'
import { AuraButton } from '@/components/aura/AuraButton'
import { useAuraStore } from '@/store/auraStore'
import { toast } from '@/store/toastStore'
import { cn } from '@/utils/cn'

export interface CandidateSimProfile {
  id: string
  name: string
  role: string
  experienceYears: number
  email: string
  cvScore: number
  techScore: number
  interviewScore: number
  matchScore: number
  globalScore: number
  skills: string[]
  statusLabel: string
  stage: 'APPLIED' | 'REVIEW' | 'ASSESSMENT' | 'INTERVIEW' | 'HIRED'
  isWinner?: boolean
  color: string
  summaryReason: string
}

export const SIM_CANDIDATES: CandidateSimProfile[] = [
  {
    id: 'cand-1',
    name: 'Alejandro Rivera Mendoza',
    role: 'Senior Full-Stack & AI Architect',
    experienceYears: 5,
    email: 'alejandro.rivera@gmail.com',
    cvScore: 96,
    techScore: 94,
    interviewScore: 95,
    matchScore: 97,
    globalScore: 96,
    skills: ['TypeScript (N5)', 'Python & FastAPI (N5)', 'PostgreSQL 18 (N5)', 'React 19 (N5)', 'Ollama AI (N4)'],
    statusLabel: 'MEJOR CANDIDATO SELECCIONADO',
    stage: 'HIRED',
    isWinner: true,
    color: 'var(--color-aura-500)',
    summaryReason:
      'Cumple 6/6 requisitos obligatorios, CV con logros cuantificados (+42% rendimiento), puntaje sobresaliente en Assessment Center y mejor respuesta STAR.',
  },
  {
    id: 'cand-2',
    name: 'Sofia Torres Vega',
    role: 'Full-Stack & UX Engineer',
    experienceYears: 3,
    email: 'sofia.torres@outlook.com',
    cvScore: 85,
    techScore: 82,
    interviewScore: 84,
    matchScore: 83,
    globalScore: 84,
    skills: ['TypeScript (N5)', 'React 19 (N5)', 'Python (N3)', 'PostgreSQL (N3)'],
    statusLabel: 'Finalista en Entrevista (#2)',
    stage: 'INTERVIEW',
    color: 'var(--color-contrast)',
    summaryReason:
      'Excelente dominio de frontend e interfaz, con brecha moderada en optimizacion de bases de datos y despliegue local de IA.',
  },
  {
    id: 'cand-3',
    name: 'Carlos Mendez Ruiz',
    role: 'Backend Python Developer',
    experienceYears: 2,
    email: 'carlos.mendez@proton.me',
    cvScore: 76,
    techScore: 78,
    interviewScore: 71,
    matchScore: 74,
    globalScore: 75,
    skills: ['Python & FastAPI (N4)', 'PostgreSQL (N4)', 'TypeScript (N2)'],
    statusLabel: 'Etapa Evaluacion Tecnica (#3)',
    stage: 'ASSESSMENT',
    color: 'var(--color-aura-300)',
    summaryReason:
      'Solida base en servicios backend, pero requiere fortalecer arquitectura frontend en React 19 y estructuracion de ejemplos STAR.',
  },
  {
    id: 'cand-4',
    name: 'Diego Vargas Luna',
    role: 'Junior Web Developer',
    experienceYears: 1,
    email: 'diego.vargas@gmail.com',
    cvScore: 62,
    techScore: 60,
    interviewScore: 58,
    matchScore: 61,
    globalScore: 60,
    skills: ['JavaScript (N3)', 'React (N3)', 'SQL Basico (N2)'],
    statusLabel: 'Revision Inicial de CV (#4)',
    stage: 'REVIEW',
    color: '#a855f7',
    summaryReason:
      'Perfil inicial con potencial formativo; AURA le genero una ruta de aprendizaje para cubrir las habilidades faltantes.',
  },
]

export interface ScreenField {
  label: string
  value: string
  badge?: string
}

export interface SimulationScreenSpec {
  id: string
  screenNumber: number
  badgeTitle: string
  screenTitle: string
  screenSubtitle: string
  icon: typeof Briefcase
  fieldsTitle: string
  fields: ScreenField[]
  barChartTitle: string
  barChartSubtitle: string
  bars: { label: string; primaryVal: number; secondaryVal: number; note: string }[]
  donutTitle: string
  donutSubtitle: string
  donutCenterLabel: string
  donutCenterValue: string
  donutItems: { label: string; pct: number; countLabel: string; color: string }[]
  highlightNote: string
}

export const SIMULATION_SCREENS: SimulationScreenSpec[] = [
  {
    id: 'screen-1-job',
    screenNumber: 1,
    badgeTitle: 'Pantalla 1 de 6 — Publicacion de Vacante',
    screenTitle: 'La Empresa Crea y Publica la Vacante en AURA',
    screenSubtitle:
      'Observa como la empresa InnovaTech Global llena paso a paso los requisitos, pesos, horario, beneficios y SLA de la vacante antes de recibir postulantes.',
    icon: Briefcase,
    fieldsTitle: 'Formulario de Creacion de Vacante (Llenandose en vivo)',
    fields: [
      { label: 'Empresa que publica', value: 'InnovaTech Global S.A. de C.V. (Cuenta Corporativa Verificada)', badge: 'Empresa' },
      { label: 'Titulo de la vacante', value: 'Senior Full-Stack & AI Architect (Python / TypeScript / Ollama)' },
      { label: 'Modalidad, Ubicacion y Horario', value: 'Hibrido flexible — Ciudad de Mexico / Lunes a Viernes 9:00 a 18:00' },
      { label: 'Rango salarial y Beneficios', value: '$65,000 - $85,000 MXN mensuales + Seguro Gastos Medicos Mayores + Bono Anual' },
      {
        label: 'Habilidades obligatorias requeridas (6)',
        value: 'TypeScript (Nivel 5), Python & FastAPI (Nivel 5), PostgreSQL 18 (Nivel 4), React 19 (Nivel 5), Ollama AI (Nivel 4)',
      },
      {
        label: 'Compromiso de Transparencia (SLA Humano)',
        value: 'Respuesta garantizada en maximo 5 dias habiles por etapa — Decision 100% humana',
        badge: 'SLA Activo',
      },
    ],
    barChartTitle: 'Peso e Importancia de cada Requisito en la Vacante',
    barChartSubtitle: 'Ponderacion configurada por la empresa para evaluar a los futuros postulantes',
    bars: [
      { label: 'TypeScript & React', primaryVal: 95, secondaryVal: 100, note: 'Obligatorio N5' },
      { label: 'Python & FastAPI', primaryVal: 95, secondaryVal: 100, note: 'Obligatorio N5' },
      { label: 'PostgreSQL 18 ACID', primaryVal: 88, secondaryVal: 90, note: 'Obligatorio N4' },
      { label: 'IA Propia Ollama', primaryVal: 85, secondaryVal: 88, note: 'Obligatorio N4' },
      { label: 'Arquitectura & CI/CD', primaryVal: 80, secondaryVal: 85, note: 'Deseable N4' },
    ],
    donutTitle: 'Estructura de Evaluacion de la Vacante',
    donutSubtitle: 'Como se pondera el perfil completo de cada candidato que se postule',
    donutCenterLabel: 'Completitud',
    donutCenterValue: '100%',
    donutItems: [
      { label: 'Habilidades Tecnicas Obligatorias', pct: 40, countLabel: '6 competencias clave', color: 'var(--color-aura-500)' },
      { label: 'Experiencia y Logros en CV', pct: 25, countLabel: 'Minimo 3 anos', color: 'var(--color-contrast)' },
      { label: 'Evaluacion Tecnica Assessment', pct: 20, countLabel: 'Prueba verificada', color: 'var(--color-aura-300)' },
      { label: 'Entrevista Estructurada STAR', pct: 15, countLabel: '4 preguntas clave', color: '#10b981' },
    ],
    highlightNote:
      'Vacante publicada con 100% de transparencia. Ahora la convocatoria esta abierta para que los candidatos se postulen.',
  },
  {
    id: 'screen-2-applicants',
    screenNumber: 2,
    badgeTitle: 'Pantalla 2 de 6 — Postulacion de 4 Candidatos',
    screenTitle: 'Varios Candidatos se Postulan y Suben su CV a la Vacante',
    screenSubtitle:
      'Cuatro candidatos con distintos niveles de experiencia se registran, aceptan el Aviso de Privacidad LFPDPPP, cargan su CV y se postulan al puesto.',
    icon: Users,
    fieldsTitle: 'Registro de Postulaciones y Diagnostico ATS de CVs Recibidos',
    fields: [
      {
        label: 'Postulante #1 — Alejandro Rivera Mendoza (5 anos exp.)',
        value: 'CV_Alejandro_Rivera.pdf cargado -> Score ATS: 96% | 6 de 6 habilidades obligatorias cubiertas',
        badge: '96% ATS',
      },
      {
        label: 'Postulante #2 — Sofia Torres Vega (3 anos exp.)',
        value: 'CV_Sofia_Torres.pdf cargado -> Score ATS: 85% | 4 de 6 habilidades obligatorias cubiertas',
        badge: '85% ATS',
      },
      {
        label: 'Postulante #3 — Carlos Mendez Ruiz (2 anos exp.)',
        value: 'CV_Carlos_Mendez.docx cargado -> Score ATS: 76% | 3 de 6 habilidades obligatorias cubiertas',
        badge: '76% ATS',
      },
      {
        label: 'Postulante #4 — Diego Vargas Luna (1 ano exp.)',
        value: 'CV_Diego_Vargas.pdf cargado -> Score ATS: 62% | 2 de 6 habilidades obligatorias cubiertas',
        badge: '62% ATS',
      },
      {
        label: 'Verificacion Legal y Congelamiento de CV',
        value: 'Los 4 postulantes aceptaron Art. 6, 8, 9, 15, 16, 19 y 22-27 LFPDPPP y su version de CV quedo congelada para revision justa.',
        badge: 'Verificado',
      },
    ],
    barChartTitle: 'Comparativa de CV y Cobertura de Requisitos entre los 4 Postulantes',
    barChartSubtitle: 'Barra principal: Puntaje de Formato e Impacto ATS (%) | Barra secundaria: Requisitos cubiertos (%)',
    bars: [
      { label: '1. Alejandro R.', primaryVal: 96, secondaryVal: 100, note: '6/6 skills' },
      { label: '2. Sofia T.', primaryVal: 85, secondaryVal: 78, note: '4/6 skills' },
      { label: '3. Carlos M.', primaryVal: 76, secondaryVal: 68, note: '3/6 skills' },
      { label: '4. Diego V.', primaryVal: 62, secondaryVal: 45, note: '2/6 skills' },
    ],
    donutTitle: 'Distribucion de Nivel de los 4 Postulantes Recibidos',
    donutSubtitle: 'Clasificacion inicial segun evidencia curricular y habilidades verificadas',
    donutCenterLabel: 'Postulantes',
    donutCenterValue: '4',
    donutItems: [
      { label: 'Nivel Senior Sobresaliente (>90%)', pct: 25, countLabel: '1 candidato (Alejandro)', color: 'var(--color-aura-500)' },
      { label: 'Nivel Intermedio Competitivo (80-89%)', pct: 25, countLabel: '1 candidata (Sofia)', color: 'var(--color-contrast)' },
      { label: 'Nivel en Desarrollo (70-79%)', pct: 25, countLabel: '1 candidato (Carlos)', color: 'var(--color-aura-300)' },
      { label: 'Nivel Inicial (<70%)', pct: 25, countLabel: '1 candidato (Diego)', color: '#a855f7' },
    ],
    highlightNote:
      'Desde la recepcion de CVs, Alejandro Rivera destaca con 96% de calidad ATS y 100% de las habilidades obligatorias del puesto.',
  },
  {
    id: 'screen-3-assessments',
    screenNumber: 3,
    badgeTitle: 'Pantalla 3 de 6 — Pruebas Tecnicas y Pasaporte',
    screenTitle: 'Evaluacion en Assessment Center y Pasaporte de Habilidades',
    screenSubtitle:
      'Los candidatos responden la prueba tecnica de arquitectura y comparten voluntariamente sus evidencias verificables de codigo.',
    icon: Brain,
    fieldsTitle: 'Resultados de Evaluaciones Tecnicas y Evidencias Compartidas',
    fields: [
      {
        label: 'Instrumento aplicado',
        value: 'Evaluacion de Arquitectura Full-Stack, SQL Avanzado e Integracion IA v2.1 (Publicada e Inmutable)',
      },
      {
        label: 'Alejandro Rivera — Resultado Tecnico y Pasaporte',
        value: 'Puntaje: 94/100 (Percentil 96) + 3 repositorios verificados compartidos en su Pasaporte de Habilidades',
        badge: '94 pts',
      },
      {
        label: 'Sofia Torres — Resultado Tecnico y Pasaporte',
        value: 'Puntaje: 82/100 (Percentil 80) + 2 proyectos de interfaz React compartidos',
        badge: '82 pts',
      },
      {
        label: 'Carlos Mendez — Resultado Tecnico y Pasaporte',
        value: 'Puntaje: 78/100 (Percentil 72) + 1 API en FastAPI compartida',
        badge: '78 pts',
      },
      {
        label: 'Diego Vargas — Resultado Tecnico',
        value: 'Puntaje: 60/100 (Percentil 48) — Recibe recomendaciones automaticas de cursos para reforzar SQL y Python',
        badge: '60 pts',
      },
    ],
    barChartTitle: 'Puntaje en Evaluacion Tecnica vs Evidencia Practica',
    barChartSubtitle: 'Comparativa objetiva calificada por el motor determinista del Assessment Center',
    bars: [
      { label: '1. Alejandro R.', primaryVal: 94, secondaryVal: 98, note: 'Top 1 Tecnico' },
      { label: '2. Sofia T.', primaryVal: 82, secondaryVal: 85, note: 'Destaca en UI' },
      { label: '3. Carlos M.', primaryVal: 78, secondaryVal: 74, note: 'Solido en API' },
      { label: '4. Diego V.', primaryVal: 60, secondaryVal: 55, note: 'En formacion' },
    ],
    donutTitle: 'Dominio Demostrado por Area Tecnica (Top Postulante)',
    donutSubtitle: 'Desglose de aciertos de Alejandro Rivera en la evaluacion tecnica',
    donutCenterLabel: 'Promedio',
    donutCenterValue: '94%',
    donutItems: [
      { label: 'Arquitectura Backend Python/FastAPI', pct: 30, countLabel: '96% aciertos', color: 'var(--color-aura-500)' },
      { label: 'Frontend TypeScript & React 19', pct: 28, countLabel: '95% aciertos', color: 'var(--color-contrast)' },
      { label: 'Modelado y Optimizacion PostgreSQL', pct: 22, countLabel: '92% aciertos', color: 'var(--color-aura-300)' },
      { label: 'Despliegue IA Local con Ollama', pct: 20, countLabel: '93% aciertos', color: '#10b981' },
    ],
    highlightNote:
      'Las evaluaciones psicometricas se mantienen privadas con consentimiento expreso (Art. 8 y 9 LFPDPPP); solo se comparten las pruebas autorizadas por cada candidato.',
  },
  {
    id: 'screen-4-interviews',
    screenNumber: 4,
    badgeTitle: 'Pantalla 4 de 6 — Entrevista Interactiva con AURA',
    screenTitle: 'Simulacion y Evaluacion de Entrevista bajo Metodo STAR',
    screenSubtitle:
      'AURA formula preguntas alineadas a las responsabilidades de la vacante y mide Situacion, Tarea, Accion y Resultado Cuantificable.',
    icon: MessageSquare,
    fieldsTitle: 'Respuestas de Entrevista y Evaluacion STAR Paso a Paso',
    fields: [
      {
        label: 'Pregunta clave de la vacante',
        value: 'Describe un proyecto donde optimizaste el rendimiento de una plataforma critica y como mediste el impacto.',
      },
      {
        label: 'Respuesta STAR de Alejandro Rivera (Efectividad: 95%)',
        value:
          'Situacion/Tarea: El motor de consultas tardaba 1.8s. Accion: Rediseñe indices en PostgreSQL 18, cache asincrono en FastAPI y motor local Ollama. Resultado: Baje la latencia un 78% (a 210ms) sin costos de API externa.',
        badge: '95% STAR',
      },
      {
        label: 'Respuesta STAR de Sofia Torres (Efectividad: 84%)',
        value:
          'Situacion/Tarea: El bundle inicial tardaba 4s en cargar. Accion: Aplique carga diferida React.lazy y optimizacion de shaders WebGL. Resultado: Mejore el tiempo de arranque en 52%.',
        badge: '84% STAR',
      },
      {
        label: 'Respuesta de Carlos Mendez (Efectividad: 71%)',
        value:
          'Migre varios endpoints sincronos a async/await en Python para soportar mas peticiones simultaneas en el servidor.',
        badge: '71% STAR',
      },
    ],
    barChartTitle: 'Efectividad en Entrevista por Candidato (Estructura STAR vs Impacto Medible)',
    barChartSubtitle: 'Comparativa de claridad argumentativa y evidencia de resultados cuantificables',
    bars: [
      { label: '1. Alejandro R.', primaryVal: 95, secondaryVal: 96, note: 'STAR Completo' },
      { label: '2. Sofia T.', primaryVal: 84, secondaryVal: 82, note: 'Buen impacto' },
      { label: '3. Carlos M.', primaryVal: 71, secondaryVal: 65, note: 'Faltan metricas' },
      { label: '4. Diego V.', primaryVal: 58, secondaryVal: 52, note: 'Respuesta breve' },
    ],
    donutTitle: 'Ponderacion de los 4 Pilares en la Entrevista',
    donutSubtitle: 'Criterios con los que se orienta la preparacion de entrevista',
    donutCenterLabel: 'Lider STAR',
    donutCenterValue: '95%',
    donutItems: [
      { label: 'Estructura STAR Completa', pct: 35, countLabel: 'Contexto + Accion + Logro', color: 'var(--color-aura-500)' },
      { label: 'Dominio de Competencias del Rol', pct: 30, countLabel: 'Tecnologias clave', color: 'var(--color-contrast)' },
      { label: 'Impacto Medible con Numeros', pct: 20, countLabel: 'Porcentajes y metricas', color: 'var(--color-aura-300)' },
      { label: 'Claridad y Profundidad', pct: 15, countLabel: 'Comunicacion ejecutiva', color: '#10b981' },
    ],
    highlightNote:
      'Alejandro Rivera logra 95% de efectividad al respaldar cada accion tecnica con metricas verificables de reduccion de latencia y ahorro operativo.',
  },
  {
    id: 'screen-5-ollama-algorithms',
    screenNumber: 5,
    badgeTitle: 'Pantalla 5 de 6 — IA Propia Ollama y Algoritmos (Vista Empresa)',
    screenTitle: 'Auditoria con IA Propia en Ollama y Laboratorio de Algoritmos',
    screenSubtitle:
      'En este modulo exclusivo para la empresa, el motor local `aura-talent-ai` (Ollama) y los algoritmos comparan las trayectorias y compatibilidad de los 4 postulantes.',
    icon: Cpu,
    fieldsTitle: 'Ejecucion del Motor Local Ollama (`POST /api/v1/aura/ollama/automate`)',
    fields: [
      {
        label: 'Motor de IA ejecutado',
        value: 'Ollama Local API (http://127.0.0.1:11434) — Modelo propio: aura-talent-ai (qwen2.5:3b) en 240 ms',
        badge: 'Ollama Local',
      },
      {
        label: 'Evolucion y Combinacion de Rutas (Exclusivo Empresa)',
        value: 'Alejandro Rivera presenta una cercania del 97% al perfil ideal del puesto (0 brechas obligatorias).',
      },
      {
        label: 'Sintesis generada por Ollama para el Reclutador',
        value:
          'Candidato #1 (Alejandro Rivera) supera el umbral en las 4 dimensiones: CV ATS (96%), Prueba Tecnica (94%), Entrevista STAR (95%) y Match (97%). Se recomienda avanzar a oferta final.',
        badge: '96% Global',
      },
      {
        label: 'Plan automatico de retroalimentacion para los otros 3 candidatos',
        value:
          'Ollama genero rutas personalizadas de cursos (<18h) para que Sofia, Carlos y Diego fortalezcan sus habilidades pendientes.',
      },
    ],
    barChartTitle: 'Compatibilidad AURA Match vs Cercania al Puesto',
    barChartSubtitle: 'Evaluacion multicriterio generada para el equipo de reclutamiento de la empresa',
    bars: [
      { label: '1. Alejandro R.', primaryVal: 97, secondaryVal: 96, note: 'Optimo Global' },
      { label: '2. Sofia T.', primaryVal: 83, secondaryVal: 84, note: 'Finalista #2' },
      { label: '3. Carlos M.', primaryVal: 74, secondaryVal: 75, note: 'Candidato #3' },
      { label: '4. Diego V.', primaryVal: 61, secondaryVal: 60, note: 'Candidato #4' },
    ],
    donutTitle: 'Factores del Calculo AURA Match (97% en Top Candidato)',
    donutSubtitle: 'Transparencia total de como se compone el indice de compatibilidad',
    donutCenterLabel: 'Top Match',
    donutCenterValue: '97%',
    donutItems: [
      { label: 'Requisitos Obligatorios (6/6)', pct: 45, countLabel: '100% cubiertos', color: 'var(--color-aura-500)' },
      { label: 'Nivel de Dominio Demostrado', pct: 25, countLabel: 'Nivel 5 Senior', color: 'var(--color-contrast)' },
      { label: 'Experiencia Relevante en Rol', pct: 20, countLabel: '5 anos verificados', color: 'var(--color-aura-300)' },
      { label: 'Evidencias y Certificaciones', pct: 10, countLabel: 'Pasaporte activo', color: '#10b981' },
    ],
    highlightNote:
      'Recuerda: esta seccion de algoritmos es visible unicamente para la Empresa; el candidato solo ve su mapa limpio y sus recomendaciones practicas.',
  },
  {
    id: 'screen-6-winner-selection',
    screenNumber: 6,
    badgeTitle: 'Pantalla 6 de 6 — Pipeline y Seleccion del Mejor Candidato',
    screenTitle: 'Embudo de Seleccion y Contratacion del Mejor Postulante',
    screenSubtitle:
      'De los 4 postulantes que compitieron en el proceso, el reclutador humano revisa el tablero final y selecciona a Alejandro Rivera Mendoza (96% Global) como el candidato contratado.',
    icon: Trophy,
    fieldsTitle: 'Decision Final Humana en el Pipeline de Reclutamiento',
    fields: [
      {
        label: 'Total de candidatos que se postularon',
        value: '4 postulantes evaluados en igualdad de condiciones (Alejandro, Sofia, Carlos y Diego)',
      },
      {
        label: 'Candidato #1 Seleccionado (MEJOR PERFIL)',
        value: 'Alejandro Rivera Mendoza — Promedio Global: 96% (Match 97% | CV 96% | Tecnica 94% | Entrevista 95%)',
        badge: 'SELECCIONADO',
      },
      {
        label: 'Motivo documentado por el Reclutador Humano',
        value:
          'Cumple el 100% de las habilidades obligatorias del puesto, demostro reduccion de latencia del 78% en produccion y obtuvo el puntaje mas alto en todas las pruebas.',
      },
      {
        label: 'Auditoria e Integridad del Proceso',
        value: 'Transicion a CONTRATADO (HIRED) firmada por reclutador humano y registrada en audit_logs.',
        badge: 'Auditado',
      },
    ],
    barChartTitle: 'Embudo de Conversion del Proceso de Seleccion (De 4 Postulantes a 1 Seleccionado)',
    barChartSubtitle: 'Avance etapa por etapa hasta elegir exclusivamente al mejor candidato',
    bars: [
      { label: '1. Postulados', primaryVal: 100, secondaryVal: 100, note: '4 candidatos' },
      { label: '2. Filtro CV ATS', primaryVal: 75, secondaryVal: 85, note: '3 avanzan' },
      { label: '3. Prueba Tecnica', primaryVal: 50, secondaryVal: 88, note: '2 finalistas' },
      { label: '4. Entrevista STAR', primaryVal: 50, secondaryVal: 90, note: '2 entrevistados' },
      { label: '5. Seleccionado', primaryVal: 25, secondaryVal: 96, note: '1 Contratado' },
    ],
    donutTitle: 'Calificacion Global Comparada de los 4 Candidatos',
    donutSubtitle: 'Por que Alejandro Rivera fue la mejor seleccion frente a los demas postulantes',
    donutCenterLabel: 'Ganador',
    donutCenterValue: '96%',
    donutItems: [
      { label: '1° Alejandro Rivera (SELECCIONADO)', pct: 96, countLabel: '96% Puntaje Global', color: 'var(--color-aura-500)' },
      { label: '2° Sofia Torres (Finalista)', pct: 84, countLabel: '84% Puntaje Global', color: 'var(--color-contrast)' },
      { label: '3° Carlos Mendez (Evaluacion)', pct: 75, countLabel: '75% Puntaje Global', color: 'var(--color-aura-300)' },
      { label: '4° Diego Vargas (Inicial)', pct: 60, countLabel: '60% Puntaje Global', color: '#a855f7' },
    ],
    highlightNote:
      'Simulacion 100% completada: has visto desde que se crea la vacante y se postulan 4 candidatos hasta que se selecciona al mejor. Pulsa «Cancelar y regresar todo a la normalidad» cuando gustes.',
  },
]

type SimSpeed = 'lento' | 'normal' | 'rapido'

const SPEED_CONFIG: Record<SimSpeed, { label: string; charDelayMs: number; charsPerTick: number; fieldPauseMs: number; screenPauseMs: number }> = {
  lento: {
    label: 'Lento (Explicativo)',
    charDelayMs: 75,
    charsPerTick: 2,
    fieldPauseMs: 950,
    screenPauseMs: 5200,
  },
  normal: {
    label: 'Normal',
    charDelayMs: 48,
    charsPerTick: 3,
    fieldPauseMs: 600,
    screenPauseMs: 3600,
  },
  rapido: {
    label: 'Rapido',
    charDelayMs: 25,
    charsPerTick: 5,
    fieldPauseMs: 300,
    screenPauseMs: 2000,
  },
}

export function SystemSimulationTourModal({
  open,
  onCloseAndRestore,
}: {
  open: boolean
  onCloseAndRestore: () => void
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [screenIdx, setScreenIdx] = useState(0)
  const [revealedCount, setRevealedCount] = useState(0)
  const [charProgress, setCharProgress] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<SimSpeed>('lento')
  const [autoAdvanceScreen, setAutoAdvanceScreen] = useState(true)

  const currentScreen = SIMULATION_SCREENS[screenIdx] ?? SIMULATION_SCREENS[0]!
  const speedSpec = SPEED_CONFIG[speed]

  // Al abrir el simulador, iniciar en la Pantalla 1 con velocidad lenta
  useEffect(() => {
    if (!open) return
    setScreenIdx(0)
    setRevealedCount(0)
    setCharProgress(0)
    setPlaying(true)
    useAuraStore.getState().setCoreState('ANALYZING')
  }, [open])

  // Hacer scroll suave al tope cuando cambia de pantalla
  useEffect(() => {
    if (!open) return
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [screenIdx, open])

  // Temporizador de escritura lenta campo por campo
  useEffect(() => {
    if (!open || !playing) return
    const activeField = currentScreen.fields[revealedCount]

    if (!activeField) {
      if (!autoAdvanceScreen) {
        setPlaying(false)
        return
      }
      const nextScreenTimer = window.setTimeout(() => {
        if (screenIdx + 1 < SIMULATION_SCREENS.length) {
          setScreenIdx((s) => s + 1)
          setRevealedCount(0)
          setCharProgress(0)
          useAuraStore.getState().pulse('SUCCESS', 700)
        } else {
          setPlaying(false)
          useAuraStore.getState().pulse('SUCCESS', 1200)
        }
      }, speedSpec.screenPauseMs)
      return () => window.clearTimeout(nextScreenTimer)
    }

    const targetLen = activeField.value.length
    if (charProgress < targetLen) {
      const timer = window.setTimeout(() => {
        setCharProgress((c) => Math.min(targetLen, c + speedSpec.charsPerTick))
      }, speedSpec.charDelayMs)
      return () => window.clearTimeout(timer)
    }

    const nextFieldTimer = window.setTimeout(() => {
      setRevealedCount((r) => r + 1)
      setCharProgress(0)
    }, speedSpec.fieldPauseMs)
    return () => window.clearTimeout(nextFieldTimer)
  }, [open, playing, screenIdx, revealedCount, charProgress, currentScreen, speedSpec, autoAdvanceScreen])

  const overallProgress = useMemo(() => {
    const totalFields = SIMULATION_SCREENS.reduce((acc, s) => acc + s.fields.length, 0)
    const doneBefore = SIMULATION_SCREENS.slice(0, screenIdx).reduce((acc, s) => acc + s.fields.length, 0)
    return Math.min(100, Math.round(((doneBefore + revealedCount) / Math.max(1, totalFields)) * 100))
  }, [screenIdx, revealedCount])

  if (!open || typeof document === 'undefined') return null

  const ScreenIcon = currentScreen.icon
  const isScreenComplete = revealedCount >= currentScreen.fields.length

  const handleCancelAndRestore = () => {
    setPlaying(false)
    useAuraStore.getState().setCoreState('IDLE')
    onCloseAndRestore()
    toast.info('Simulacion finalizada. Todo el sistema regreso a la normalidad.')
  }

  const goToScreen = (idx: number, fillImmediately = false) => {
    const target = Math.max(0, Math.min(SIMULATION_SCREENS.length - 1, idx))
    setScreenIdx(target)
    if (fillImmediately) {
      setRevealedCount(SIMULATION_SCREENS[target]!.fields.length)
      setCharProgress(0)
      setPlaying(false)
    } else {
      setRevealedCount(0)
      setCharProgress(0)
      setPlaying(true)
    }
  }

  const radius = 54
  const circumference = 2 * Math.PI * radius
  const totalDonut = Math.max(1, currentScreen.donutItems.reduce((acc, i) => acc + i.pct, 0))
  let accFraction = 0
  const donutSegments = currentScreen.donutItems.map((item) => {
    const frac = item.pct / totalDonut
    const dash = frac * circumference
    const offset = -accFraction * circumference
    accFraction += frac
    return { ...item, dash, offset }
  })

  return createPortal(
    <div
      ref={scrollContainerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Simulacion pantalla por pantalla de todo el sistema AURA"
      onWheel={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[96] h-dvh w-screen overflow-y-scroll overscroll-contain bg-black/88 backdrop-blur-md"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        {/* Barra Superior Fija (Sticky) con Controles de Pantalla, Velocidad y Cancelar */}
        <header className="modal-surface sticky top-2 z-30 flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="icon-orb-3d flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-aura-400">
              <WandSparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="hud-label text-aura-400">{currentScreen.badgeTitle}</span>
                <AuraBadge tone={isScreenComplete ? 'success' : 'info'}>
                  {isScreenComplete ? 'Pantalla completada' : `Escribiendo datos (${overallProgress}%)`}
                </AuraBadge>
              </div>
              <h2 className="font-display text-base font-bold text-bone md:text-xl">
                {currentScreen.screenTitle}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de Velocidad de Llenado */}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1 text-xs">
              <Gauge className="ml-1.5 h-3.5 w-3.5 text-aura-400" aria-hidden="true" />
              {(['lento', 'normal', 'rapido'] as SimSpeed[]).map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setSpeed(sp)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 font-mono text-[11px] transition',
                    speed === sp ? 'bg-aura-500 font-bold text-ink' : 'text-graphite-300 hover:text-bone',
                  )}
                >
                  {SPEED_CONFIG[sp].label}
                </button>
              ))}
            </div>

            <AuraButton
              size="sm"
              variant="neo"
              icon={playing ? Pause : CirclePlay}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? 'Pausar' : 'Reanudar'}
            </AuraButton>

            <AuraButton
              size="sm"
              variant="danger"
              icon={RotateCcw}
              onClick={handleCancelAndRestore}
            >
              Cancelar y volver a la normalidad
            </AuraButton>

            <button
              type="button"
              onClick={handleCancelAndRestore}
              aria-label="Cerrar simulacion"
              className="rounded-xl border border-white/15 bg-black/40 p-2 text-graphite-300 hover:border-aura-500 hover:text-bone"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Selector de las 6 Pantallas Completas */}
        <nav aria-label="Pantallas de la simulacion" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {SIMULATION_SCREENS.map((scr, idx) => {
            const Icon = scr.icon
            const active = idx === screenIdx
            const completed = idx < screenIdx || (idx === screenIdx && isScreenComplete)
            return (
              <button
                key={scr.id}
                type="button"
                onClick={() => goToScreen(idx, false)}
                className={cn(
                  'card-3d btn-jelly flex flex-col justify-between gap-1.5 rounded-2xl p-3.5 text-left transition',
                  active && 'ring-2 ring-aura-500',
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] font-bold text-aura-400">
                    PANTALLA {scr.screenNumber}
                  </span>
                  {completed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Icon className="h-4 w-4 text-graphite-400" />
                  )}
                </div>
                <p className="line-clamp-2 font-display text-xs font-bold text-bone">{scr.screenTitle}</p>
              </button>
            )
          })}
        </nav>

        {/* Descripcion de la Pantalla Actual + Controles de Avance de Pantalla */}
        <div className="card-3d flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5">
          <div className="flex max-w-3xl items-start gap-3.5">
            <div className="icon-orb-3d flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-aura-400">
              <ScreenIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium leading-relaxed text-bone">{currentScreen.screenSubtitle}</p>
              <p className="mt-1 text-xs text-aura-400">{currentScreen.highlightNote}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AuraButton
              size="sm"
              variant="neo"
              icon={ArrowLeft}
              disabled={screenIdx === 0}
              onClick={() => goToScreen(screenIdx - 1, true)}
            >
              Pantalla anterior
            </AuraButton>
            <AuraButton
              size="sm"
              variant="neo"
              onClick={() => {
                setRevealedCount(currentScreen.fields.length)
                setCharProgress(0)
                setPlaying(false)
              }}
            >
              Mostrar todos los datos de esta pantalla
            </AuraButton>
            <AuraButton
              size="sm"
              icon={ArrowRight}
              disabled={screenIdx >= SIMULATION_SCREENS.length - 1}
              onClick={() => goToScreen(screenIdx + 1, false)}
            >
              Siguiente pantalla ({screenIdx + 2}/{SIMULATION_SCREENS.length})
            </AuraButton>
          </div>
        </div>

        {/* SECCION 1 DE LA PANTALLA: Datos y Formularios Llenandose Paso a Paso */}
        <section className="card-3d flex flex-col gap-4 rounded-3xl p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-aura-400" aria-hidden="true" />
              <h3 className="hud-label text-bone">{currentScreen.fieldsTitle}</h3>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-graphite-300">
              <input
                type="checkbox"
                checked={autoAdvanceScreen}
                onChange={(e) => setAutoAdvanceScreen(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-orange-500"
              />
              <span>Pasar automaticamente a la siguiente pantalla al terminar de escribir</span>
            </label>
          </div>

          <div className="grid gap-3.5 md:grid-cols-2">
            {currentScreen.fields.map((field, fIdx) => {
              const isDone = fIdx < revealedCount
              const isTyping = fIdx === revealedCount
              const textShown = isDone
                ? field.value
                : isTyping
                  ? field.value.slice(0, charProgress)
                  : 'Esperando turno de llenado...'

              return (
                <div
                  key={field.label}
                  className={cn(
                    'flex flex-col justify-between gap-2 rounded-2xl border p-4 transition-all',
                    isDone
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : isTyping
                        ? 'border-aura-500 bg-aura-500/15 shadow-[0_0_22px_rgba(255,122,26,0.2)]'
                        : 'border-white/10 bg-black/25 opacity-65',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-bone">{field.label}</span>
                    <div className="flex items-center gap-1.5">
                      {field.badge && <AuraBadge tone={isDone ? 'success' : 'info'}>{field.badge}</AuraBadge>}
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Listo
                        </span>
                      ) : isTyping ? (
                        <span className="font-mono text-[10px] font-bold text-aura-400">Llenando...</span>
                      ) : (
                        <span className="font-mono text-[10px] text-graphite-400">En cola</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-bone">
                    <span>{textShown}</span>
                    {isTyping && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-aura-400 align-middle" />}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* SECCION 2 DE LA PANTALLA: Graficas Completas (Barras + Pastel/Dona) */}
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Grafica de Barras SVG */}
          <section className="card-3d flex flex-col justify-between gap-4 rounded-3xl p-5 md:p-6">
            <div>
              <div className="flex items-center gap-2">
                <ChartColumn className="h-4 w-4 text-aura-400" aria-hidden="true" />
                <h4 className="hud-label text-bone">{currentScreen.barChartTitle}</h4>
              </div>
              <p className="mt-1 text-xs text-graphite-300">{currentScreen.barChartSubtitle}</p>
            </div>

            <svg
              viewBox="0 0 560 230"
              className="h-auto w-full rounded-2xl border border-white/10 bg-[#09090d] p-2"
              role="img"
              aria-label={currentScreen.barChartTitle}
            >
              {[0, 25, 50, 75, 100].map((pct) => {
                const gy = 26 + (155 * (100 - pct)) / 100
                return (
                  <g key={pct}>
                    <line x1={42} y1={gy} x2={540} y2={gy} stroke="#ffffff" strokeOpacity="0.08" strokeDasharray="3 5" />
                    <text x={34} y={gy + 3} textAnchor="end" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                      {pct}%
                    </text>
                  </g>
                )
              })}

              {currentScreen.bars.map((bar, idx) => {
                const slot = 490 / currentScreen.bars.length
                const centerX = 46 + idx * slot + slot / 2
                const barW = Math.min(26, slot * 0.34)
                const h1 = (bar.primaryVal / 100) * 155
                const h2 = (bar.secondaryVal / 100) * 155
                const y1 = 26 + 155 - h1
                const y2 = 26 + 155 - h2
                return (
                  <g key={bar.label}>
                    <rect
                      x={centerX - barW - 2}
                      y={y1}
                      width={barW}
                      height={Math.max(4, h1)}
                      rx="6"
                      fill="#ff7a1a"
                      className="bar-grow"
                      style={{ '--b-delay': idx } as CSSProperties}
                    />
                    <circle cx={centerX - barW / 2 - 2} cy={y1} r="4.5" fill="#ffb547" />
                    <rect
                      x={centerX + 2}
                      y={y2}
                      width={barW}
                      height={Math.max(4, h2)}
                      rx="6"
                      fill="#38bdf8"
                      className="bar-grow"
                      style={{ '--b-delay': idx + 1 } as CSSProperties}
                    />
                    <circle cx={centerX + barW / 2 + 2} cy={y2} r="4.5" fill="#38bdf8" />
                    <text
                      x={centerX - barW / 2 - 2}
                      y={y1 - 7}
                      textAnchor="middle"
                      fill="#ffb547"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {bar.primaryVal}%
                    </text>
                    <text
                      x={centerX + barW / 2 + 2}
                      y={y2 - 7}
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize="8.5"
                      fontFamily="monospace"
                    >
                      {bar.secondaryVal}%
                    </text>
                    <text x={centerX} y={198} textAnchor="middle" fill="#f8fafc" fontSize="9.5" fontWeight="bold">
                      {bar.label}
                    </text>
                    <text x={centerX} y={213} textAnchor="middle" fill="#94a3b8" fontSize="8.5" fontFamily="monospace">
                      {bar.note}
                    </text>
                  </g>
                )
              })}
            </svg>
          </section>

          {/* Grafica de Pastel / Dona SVG */}
          <section className="card-3d flex flex-col justify-between gap-4 rounded-3xl p-5 md:p-6">
            <div>
              <div className="flex items-center gap-2">
                <ChartPie className="h-4 w-4 text-aura-400" aria-hidden="true" />
                <h4 className="hud-label text-bone">{currentScreen.donutTitle}</h4>
              </div>
              <p className="mt-1 text-xs text-graphite-300">{currentScreen.donutSubtitle}</p>
            </div>

            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
                <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label={currentScreen.donutTitle}>
                  <circle cx="80" cy="80" r={radius} fill="none" stroke="#1f2937" strokeWidth="18" />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.label}
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="18"
                      strokeLinecap="round"
                      strokeDasharray={`${seg.dash} ${circumference}`}
                      strokeDashoffset={seg.offset}
                    />
                  ))}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-mono text-2xl font-bold text-bone">{currentScreen.donutCenterValue}</span>
                  <span className="text-[10px] uppercase tracking-wider text-graphite-400">
                    {currentScreen.donutCenterLabel}
                  </span>
                </div>
              </div>

              <ul className="grid w-full flex-1 gap-2.5">
                {currentScreen.donutItems.map((item) => (
                  <li
                    key={item.label}
                    className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/35 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium text-bone">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.label}</span>
                      </span>
                      <span className="font-mono font-bold text-aura-400">{item.pct}%</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-graphite-300">
                      <span>{item.countLabel}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        {/* SECCION 3 DE LA PANTALLA: Tabla y Embudo de los 4 Postulantes Compitiendo (Quien es Seleccionado) */}
        <section className="card-3d flex flex-col gap-4 rounded-3xl p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-aura-400" aria-hidden="true" />
              <h4 className="hud-label text-bone">
                Comparativa en Vivo de los 4 Postulantes a la Vacante y Seleccion del Mejor Candidato
              </h4>
            </div>
            <AuraBadge tone="success">Ganador seleccionado: Alejandro Rivera Mendoza (96%)</AuraBadge>
          </div>

          <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-4">
            {SIM_CANDIDATES.map((cand, idx) => (
              <div
                key={cand.id}
                className={cn(
                  'flex flex-col justify-between gap-3 rounded-2xl border p-4 transition-all',
                  cand.isWinner
                    ? 'border-2 border-emerald-400 bg-emerald-500/10 shadow-[0_0_28px_rgba(16,185,129,0.22)]'
                    : 'border-white/10 bg-black/35',
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-aura-400">#{idx + 1}</span>
                    <AuraBadge tone={cand.isWinner ? 'success' : 'neutral'}>{cand.statusLabel}</AuraBadge>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {cand.isWinner && <Award className="h-5 w-5 shrink-0 text-emerald-400" />}
                    <h5 className="font-display text-sm font-bold text-bone">{cand.name}</h5>
                  </div>
                  <p className="text-xs text-graphite-300">
                    {cand.role} ({cand.experienceYears} anos exp.)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  <div className="rounded-lg bg-black/45 px-2.5 py-1.5">
                    <span className="text-graphite-400">CV ATS: </span>
                    <strong className="text-bone">{cand.cvScore}%</strong>
                  </div>
                  <div className="rounded-lg bg-black/45 px-2.5 py-1.5">
                    <span className="text-graphite-400">Tecnica: </span>
                    <strong className="text-bone">{cand.techScore}%</strong>
                  </div>
                  <div className="rounded-lg bg-black/45 px-2.5 py-1.5">
                    <span className="text-graphite-400">STAR: </span>
                    <strong className="text-bone">{cand.interviewScore}%</strong>
                  </div>
                  <div className="rounded-lg bg-black/45 px-2.5 py-1.5">
                    <span className="text-graphite-400">Match: </span>
                    <strong className="text-aura-400">{cand.matchScore}%</strong>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-bone">Puntaje Global</span>
                    <span className="font-mono text-sm font-extrabold text-emerald-400">{cand.globalScore}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-aura-500 to-emerald-400"
                      style={{ width: `${cand.globalScore}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-graphite-300">{cand.summaryReason}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Barra Inferior para cambiar de pantalla o Cancelar y regresar a la normalidad */}
        <footer className="modal-surface sticky bottom-2 z-30 flex flex-wrap items-center justify-between gap-4 rounded-3xl px-5 py-4 shadow-2xl">
          <div className="flex items-center gap-2">
            <AuraButton
              size="sm"
              variant="neo"
              icon={ArrowLeft}
              disabled={screenIdx === 0}
              onClick={() => goToScreen(screenIdx - 1, true)}
            >
              Pantalla anterior
            </AuraButton>
            <AuraButton
              size="sm"
              icon={screenIdx < SIMULATION_SCREENS.length - 1 ? ArrowRight : Sparkles}
              onClick={() => {
                if (screenIdx < SIMULATION_SCREENS.length - 1) {
                  goToScreen(screenIdx + 1, false)
                } else {
                  goToScreen(0, false)
                }
              }}
            >
              {screenIdx < SIMULATION_SCREENS.length - 1
                ? `Ir a Pantalla ${screenIdx + 2}: ${SIMULATION_SCREENS[screenIdx + 1]!.screenTitle.slice(0, 32)}...`
                : 'Reiniciar desde Pantalla 1'}
            </AuraButton>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-graphite-300">
              Puedes hacer scroll libremente en cada pantalla o cancelar cuando desees:
            </span>
            <AuraButton
              size="md"
              variant="danger"
              icon={RotateCcw}
              onClick={handleCancelAndRestore}
            >
              Cancelar simulacion y regresar todo a la normalidad
            </AuraButton>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
