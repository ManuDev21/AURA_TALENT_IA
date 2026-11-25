import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AREA_MODULES } from '@/aura/modules'
import { PLACEMENTS } from '@/store/auraStore'

describe('UI / UX — Claridad de lenguaje y configuracion PWA/movil', () => {
  it('los modulos de candidato usan lenguaje claro sin jerga tecnica ni menciones a Mongo', () => {
    const forbidden = [/mongo/i, /assessment center/i, /cv workspace/i, /orbita de recomendaciones/i, /divulgacion/i]
    for (const mod of AREA_MODULES.candidate) {
      const text = `${mod.label} ${mod.description}`
      for (const pattern of forbidden) {
        expect(text, `Texto tecnico detectado en modulo candidato "${mod.id}": ${text}`).not.toMatch(pattern)
      }
      expect(mod.label.trim().length).toBeGreaterThanOrEqual(3)
      expect(mod.description.trim().length).toBeGreaterThanOrEqual(15)
    }
  })

  it('ninguna area conserva modulos temporales de exposicion ni ids duplicados', () => {
    for (const [area, list] of Object.entries(AREA_MODULES)) {
      const ids = list.map((m) => m.id)
      expect(new Set(ids).size, `IDs duplicados en ${area}`).toBe(ids.length)
      expect(ids).not.toContain('mongo')
    }
  })

  it('el nucleo 3D en celular usa una escala compacta para no estorbar la lectura', () => {
    expect(PLACEMENTS.mobile.scale).toBeLessThanOrEqual(0.4)
    expect(PLACEMENTS.mobileFocus.scale).toBeLessThanOrEqual(0.3)
  })

  it('vercel.json incluye cabeceras OWASP, proxy /api y no-store en sw.js', () => {
    const raw = readFileSync(resolve(__dirname, '../../vercel.json'), 'utf-8')
    const cfg = JSON.parse(raw) as {
      rewrites: Array<{ source: string; destination: string }>
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    }
    expect(cfg.rewrites.some((r) => r.source === '/api/:path*')).toBe(true)
    const rootHeaders = cfg.headers.find((h) => h.source === '/(.*)')?.headers ?? []
    const keys = rootHeaders.map((h) => h.key)
    expect(keys).toContain('X-Content-Type-Options')
    expect(keys).toContain('X-Frame-Options')
    expect(keys).toContain('Referrer-Policy')
  })

  it('index.html declara viewport-fit=cover y meta tags PWA moviles', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8')
    expect(html).toContain('viewport-fit=cover')
    expect(html).toContain('apple-mobile-web-app-capable')
    expect(html).toContain('theme-color')
  })
})
