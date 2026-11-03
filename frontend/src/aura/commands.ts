import type { AuraModule } from '@/aura/modules'

/**
 * Interprete de comandos del lado del cliente (Fase 1).
 * Resuelve navegacion y comandos basicos. Desde la Fase 8 los comandos
 * se envian al AURA Orchestrator del backend y este modulo queda como fallback.
 */
export type CommandResult =
  | { kind: 'navigate'; moduleId: string; message: string }
  | { kind: 'home'; message: string }
  | { kind: 'logout'; message: string }
  | { kind: 'help'; message: string }
  | { kind: 'unknown'; message: string }

const ACTION_VERBS = ['analiza', 'crea', 'compara', 'genera', 'busca', 'identifica', 'evalua', 'recomienda']

export function normalizeCommand(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/^\s*aura\b/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function containsPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(text)
}

export function parseCommand(input: string, modules: AuraModule[]): CommandResult {
  const text = normalizeCommand(input)
  if (!text) return { kind: 'unknown', message: 'Escribe un comando o elige una sugerencia.' }

  if (['ayuda', 'help', 'que puedes hacer', 'comandos'].some((p) => containsPhrase(text, p))) {
    const labels = modules.map((m) => m.label).join(', ')
    return { kind: 'help', message: `Puedo llevarte a: ${labels}. Prueba "AURA, abre ${modules[0]?.label ?? 'un modulo'}".` }
  }
  if (['cerrar sesion', 'salir', 'logout'].some((p) => containsPhrase(text, p))) {
    return { kind: 'logout', message: 'Cerrando sesion.' }
  }
  if (['inicio', 'home', 'nucleo', 'centro'].some((p) => containsPhrase(text, p))) {
    return { kind: 'home', message: 'Volviendo al nucleo de AURA.' }
  }

  let best: { module: AuraModule; score: number } | null = null
  for (const module of modules) {
    const score = module.keywords.reduce(
      (acc, keyword) => (containsPhrase(text, normalizeCommand(keyword)) ? acc + keyword.length : acc),
      0,
    )
    if (score > 0 && (!best || score > best.score)) best = { module, score }
  }

  if (!best) {
    return { kind: 'unknown', message: 'Todavia no entiendo ese comando. Escribe "ayuda" para ver opciones.' }
  }

  const { module } = best
  const wantsAnalysis = ACTION_VERBS.some((verb) => containsPhrase(text, verb))
  const note =
    !module.available && wantsAnalysis
      ? ` Las acciones inteligentes de este modulo llegan en la Fase ${module.phase}.`
      : ''
  return { kind: 'navigate', moduleId: module.id, message: `Abriendo ${module.label}.${note}` }
}
