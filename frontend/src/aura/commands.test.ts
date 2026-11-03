import { Sparkles } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { normalizeCommand, parseCommand } from '@/aura/commands'
import { AREA_MODULES } from '@/aura/modules'

const candidate = AREA_MODULES.candidate
const company = AREA_MODULES.company

describe('normalizeCommand', () => {
  it('quita acentos, signos y el prefijo AURA', () => {
    expect(normalizeCommand('AURA, ¿Qué habilidades necesito mejorar?')).toBe('que habilidades necesito mejorar')
  })
})

describe('parseCommand', () => {
  it('navega al modulo por palabra clave', () => {
    const result = parseCommand('AURA, abre mis evaluaciones', candidate)
    expect(result).toMatchObject({ kind: 'navigate', moduleId: 'assessments' })
  })

  it('agrega nota de fase cuando se pide una accion inteligente no disponible', () => {
    const future = [{ id: 'futuro', label: 'Futuro', description: '', icon: Sparkles, phase: 14, keywords: ['futuro'] }]
    const result = parseCommand('AURA, analiza el futuro', future)
    expect(result).toMatchObject({ kind: 'navigate', moduleId: 'futuro' })
    expect(result.message).toContain('Fase 14')
  })

  it('no agrega nota cuando el modulo ya esta disponible', () => {
    const result = parseCommand('AURA, crea mi CV', candidate)
    expect(result).toMatchObject({ kind: 'navigate', moduleId: 'cv' })
    expect(result.message).not.toContain('Fase')
  })

  it('elige el modulo con la coincidencia mas especifica', () => {
    expect(parseCommand('genera una ruta profesional', candidate)).toMatchObject({ moduleId: 'career' })
    expect(parseCommand('busca vacantes de frontend', candidate)).toMatchObject({ moduleId: 'jobs' })
  })

  it('resuelve comandos por area', () => {
    expect(parseCommand('AURA, analiza los candidatos', company)).toMatchObject({ moduleId: 'candidates' })
  })

  it('reconoce ayuda, inicio y cerrar sesion', () => {
    expect(parseCommand('ayuda', candidate).kind).toBe('help')
    expect(parseCommand('volver al inicio', candidate).kind).toBe('home')
    expect(parseCommand('AURA, cerrar sesión', candidate).kind).toBe('logout')
  })

  it('devuelve unknown sin coincidencias', () => {
    expect(parseCommand('hola que tal el clima', candidate).kind).toBe('unknown')
  })
})
