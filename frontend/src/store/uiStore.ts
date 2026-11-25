import { create } from 'zustand'

export type AuraColorTheme = 'amber' | 'emerald' | 'ocean' | 'violet' | 'crimson' | 'formal'
export type AuraLayoutMode = 'orbital' | 'clasico'
export type ModalSurfaceStyle = 'glass' | 'clay' | 'neo'

export interface ThemePalette {
  id: AuraColorTheme
  label: string
  shortLabel: string
  contrastNote: string
  swatch: string
  secondarySwatch: string
  isLight?: boolean
  coreA: string
  coreB: string
  ring: string
  particle: string
  canvasBg: string
}

export const AURA_THEMES: Record<AuraColorTheme, ThemePalette> = {
  amber: {
    id: 'amber',
    label: 'Ambar Solar + Cian (Original)',
    shortLabel: 'Ambar',
    contrastNote: 'Naranja energetico con contraste Cian Electrico sobre Onix',
    swatch: '#ff7a1a',
    secondarySwatch: '#06b6d4',
    coreA: '#ff6a00',
    coreB: '#ffb347',
    ring: '#ffb347',
    particle: '#38bdf8',
    canvasBg: '#050508',
  },
  emerald: {
    id: 'emerald',
    label: 'Verde Esmeralda + Oro',
    shortLabel: 'Verde',
    contrastNote: 'Esmeralda FinTech con contraste Ambar Dorado sobre Pizarra',
    swatch: '#10b981',
    secondarySwatch: '#f59e0b',
    coreA: '#059669',
    coreB: '#34d399',
    ring: '#34d399',
    particle: '#fbbf24',
    canvasBg: '#040a08',
  },
  ocean: {
    id: 'ocean',
    label: 'Azul Zafiro + Indigo',
    shortLabel: 'Azul',
    contrastNote: 'Cian SaaS con contraste Violeta Indigo sobre Noche Marina',
    swatch: '#0ea5e9',
    secondarySwatch: '#818cf8',
    coreA: '#0284c7',
    coreB: '#38bdf8',
    ring: '#38bdf8',
    particle: '#a5b4fc',
    canvasBg: '#040812',
  },
  violet: {
    id: 'violet',
    label: 'Violeta Cuantico + Magenta',
    shortLabel: 'Violeta',
    contrastNote: 'Violeta IA con contraste Rosa Neon y Cian sobre Obsidiana',
    swatch: '#8b5cf6',
    secondarySwatch: '#ec4899',
    coreA: '#7c3aed',
    coreB: '#c084fc',
    ring: '#c084fc',
    particle: '#f472b6',
    canvasBg: '#070510',
  },
  crimson: {
    id: 'crimson',
    label: 'Carmesi Rubi + Coral',
    shortLabel: 'Carmesi',
    contrastNote: 'Rubi de alto impacto con contraste Dorado Coral sobre Grafito',
    swatch: '#f43f5e',
    secondarySwatch: '#fb923c',
    coreA: '#e11d48',
    coreB: '#fb7185',
    ring: '#fb7185',
    particle: '#fdba74',
    canvasBg: '#0b0508',
  },
  formal: {
    id: 'formal',
    label: 'Modo Claro (Blanco + Naranja + Negro)',
    shortLabel: 'Modo Claro',
    contrastNote: 'Blanco ejecutivo de alto contraste con Naranja y Negro Carbon',
    swatch: '#ff6a00',
    secondarySwatch: '#0a0a0f',
    isLight: true,
    coreA: '#ff6a00',
    coreB: '#ea580c',
    ring: '#0a0a0f',
    particle: '#ff6a00',
    canvasBg: '#f8fafc',
  },
}

const STORAGE_THEME_KEY = 'aura_color_theme'
const STORAGE_LAYOUT_KEY = 'aura_layout_mode'
const STORAGE_SIDEBAR_KEY = 'aura_sidebar_open'
const STORAGE_MODAL_STYLE_KEY = 'aura_modal_style'

function loadStoredTheme(): AuraColorTheme {
  if (typeof window === 'undefined') return 'amber'
  const val = window.localStorage.getItem(STORAGE_THEME_KEY) as AuraColorTheme | null
  return val && val in AURA_THEMES ? val : 'amber'
}

function loadStoredLayout(): AuraLayoutMode {
  if (typeof window === 'undefined') return 'orbital'
  const val = window.localStorage.getItem(STORAGE_LAYOUT_KEY)
  return val === 'clasico' ? 'clasico' : 'orbital'
}

function loadStoredSidebar(): boolean {
  if (typeof window === 'undefined') return true
  const val = window.localStorage.getItem(STORAGE_SIDEBAR_KEY)
  return val === null ? true : val === 'true'
}

function loadStoredModalStyle(): ModalSurfaceStyle {
  if (typeof window === 'undefined') return 'glass'
  const val = window.localStorage.getItem(STORAGE_MODAL_STYLE_KEY)
  return val === 'clay' || val === 'neo' ? val : 'glass'
}

export function applyDocumentTheme(theme: AuraColorTheme, layout: AuraLayoutMode) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.layout = layout
}

interface UiState {
  colorTheme: AuraColorTheme
  layoutMode: AuraLayoutMode
  sidebarOpen: boolean
  modalStyle: ModalSurfaceStyle
  setColorTheme: (theme: AuraColorTheme) => void
  setLayoutMode: (mode: AuraLayoutMode) => void
  toggleLayoutMode: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setModalStyle: (style: ModalSurfaceStyle) => void
}

const initialTheme = loadStoredTheme()
const initialLayout = loadStoredLayout()
applyDocumentTheme(initialTheme, initialLayout)

export const useUiStore = create<UiState>((set, get) => ({
  colorTheme: initialTheme,
  layoutMode: initialLayout,
  sidebarOpen: loadStoredSidebar(),
  modalStyle: loadStoredModalStyle(),
  setColorTheme: (colorTheme) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_THEME_KEY, colorTheme)
    applyDocumentTheme(colorTheme, get().layoutMode)
    set({ colorTheme })
  },
  setLayoutMode: (layoutMode) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_LAYOUT_KEY, layoutMode)
    applyDocumentTheme(get().colorTheme, layoutMode)
    set({ layoutMode })
  },
  toggleLayoutMode: () => {
    const next = get().layoutMode === 'orbital' ? 'clasico' : 'orbital'
    get().setLayoutMode(next)
  },
  setSidebarOpen: (sidebarOpen) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_SIDEBAR_KEY, String(sidebarOpen))
    set({ sidebarOpen })
  },
  toggleSidebar: () => {
    const next = !get().sidebarOpen
    get().setSidebarOpen(next)
  },
  setModalStyle: (modalStyle) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_MODAL_STYLE_KEY, modalStyle)
    set({ modalStyle })
  },
}))
