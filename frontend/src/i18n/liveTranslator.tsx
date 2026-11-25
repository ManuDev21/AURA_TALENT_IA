import { Check, Globe, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { AuraButton } from '@/components/aura/AuraButton'
import { useAuraStore } from '@/store/auraStore'
import { cn } from '@/utils/cn'

export type AuraLanguage = 'es' | 'en' | 'fr' | 'zh-CN'

export interface LanguageOption {
  code: AuraLanguage
  label: string
  nativeLabel: string
  badge: string
}

export const AURA_LANGUAGES: LanguageOption[] = [
  { code: 'es', label: 'Espanol', nativeLabel: 'Espanol (Original)', badge: 'ES' },
  { code: 'en', label: 'Ingles', nativeLabel: 'English (US/UK)', badge: 'EN' },
  { code: 'fr', label: 'Frances', nativeLabel: 'Francais (FR)', badge: 'FR' },
  { code: 'zh-CN', label: 'Mandarin', nativeLabel: '中文 (普通话)', badge: '中文' },
]

const STORAGE_LANG_KEY = 'aura_active_language'
const CACHE_PREFIX = 'aura_i18n_cache_v1_'

// Diccionario base instantaneo para respuesta inmediata mientras la API traduce textos largos
const INSTANT_DICTIONARY: Record<Exclude<AuraLanguage, 'es'>, Record<string, string>> = {
  en: {
    'Iniciar sesion': 'Sign in',
    'Crear cuenta': 'Create account',
    'Entrar': 'Sign in',
    'Correo': 'Email',
    'Contrasena': 'Password',
    'Olvide mi contrasena': 'Forgot my password',
    'No tienes cuenta?': "Don't have an account?",
    'Ya tienes cuenta?': 'Already have an account?',
    'Perfil': 'Profile',
    'Portfolio': 'Portfolio',
    'Pasaporte de habilidades': 'Skills Passport',
    'CV': 'Resume / CV',
    'Vacantes': 'Job Openings',
    'Postulaciones': 'Applications',
    'Ensayo de entrevista': 'Interview Practice',
    'Evaluaciones': 'Assessments',
    'Match': 'Match',
    'Recomendaciones': 'Recommendations',
    'Mi progreso': 'My Progress',
    'Practica con camara': 'Camera Practice',
    'Career Map': 'Career Map',
    'Privacidad': 'Privacy & Legal',
    'Candidatos': 'Candidates',
    'Pipeline': 'Selection Pipeline',
    'Analytics': 'Analytics',
    'Reportes': 'Reports',
    'Empresa': 'Company',
    'Algoritmos IA': 'AI Algorithms Lab',
    'Roles': 'Roles & Permissions',
    'Catalogos': 'Catalogs',
    'Instrumentos': 'Instruments',
    'Modelos ML': 'ML Models',
    'Auditoria': 'Audit Logs',
    'Diseno Clasico': 'Classic Layout',
    'Diseno Orbital': 'Orbital 3D Layout',
    'Continuar con Google (Acceso Rapido)': 'Continue with Google (Fast Sign-In)',
    'Registrarse con Google': 'Sign up with Google',
  },
  fr: {
    'Iniciar sesion': 'Se connecter',
    'Crear cuenta': 'Creer un compte',
    'Entrar': 'Connexion',
    'Correo': 'Courriel',
    'Contrasena': 'Mot de passe',
    'Olvide mi contrasena': 'Mot de passe oublie',
    'No tienes cuenta?': "Vous n'avez pas de compte ?",
    'Ya tienes cuenta?': 'Vous avez deja un compte ?',
    'Perfil': 'Profil',
    'Portfolio': 'Portfolio',
    'Pasaporte de habilidades': 'Passeport de competences',
    'CV': 'CV',
    'Vacantes': "Offres d'emploi",
    'Postulaciones': 'Candidatures',
    'Ensayo de entrevista': "Simulation d'entretien",
    'Evaluaciones': 'Evaluations',
    'Match': 'Compatibilite',
    'Recomendaciones': 'Recommandations',
    'Mi progreso': 'Ma progression',
    'Practica con camara': 'Pratique camera',
    'Career Map': 'Carte de carriere',
    'Privacidad': 'Confidentialite',
    'Candidatos': 'Candidats',
    'Pipeline': 'Pipeline de recrutement',
    'Analytics': 'Analytique',
    'Reportes': 'Rapports',
    'Empresa': 'Entreprise',
    'Algoritmos IA': 'Algorithmes IA',
    'Roles': 'Roles',
    'Catalogos': 'Catalogues',
    'Instrumentos': 'Instruments',
    'Modelos ML': 'Modeles ML',
    'Auditoria': 'Audit',
    'Diseno Clasico': 'Design Classique',
    'Diseno Orbital': 'Design Orbital 3D',
    'Continuar con Google (Acceso Rapido)': 'Continuer avec Google (Acces Rapide)',
    'Registrarse con Google': "S'inscrire avec Google",
  },
  'zh-CN': {
    'Iniciar sesion': '登录',
    'Crear cuenta': '创建账户',
    'Entrar': '进入系统',
    'Correo': '电子邮箱',
    'Contrasena': '密码',
    'Olvide mi contrasena': '忘记密码',
    'No tienes cuenta?': '还没有账户？',
    'Ya tienes cuenta?': '已有账户？',
    'Perfil': '个人档案',
    'Portfolio': '作品集',
    'Pasaporte de habilidades': '技能护照',
    'CV': '简历中心',
    'Vacantes': '职位空缺',
    'Postulaciones': '我的申请',
    'Ensayo de entrevista': '面试模拟',
    'Evaluaciones': '能力测评',
    'Match': '人岗匹配',
    'Recomendaciones': '智能推荐',
    'Mi progreso': '我的进度',
    'Practica con camara': '镜头练习',
    'Career Map': '职业发展图',
    'Privacidad': '隐私与法律声明',
    'Candidatos': '候选人库',
    'Pipeline': '招聘流程',
    'Analytics': '数据分析',
    'Reportes': '报表导出',
    'Empresa': '企业信息',
    'Algoritmos IA': 'AI 算法实验室',
    'Roles': '角色权限',
    'Catalogos': '技能目录',
    'Instrumentos': '测评工具',
    'Modelos ML': '机器学习模型',
    'Auditoria': '安全审计',
    'Diseno Clasico': '经典布局',
    'Diseno Orbital': '3D 轨道布局',
    'Continuar con Google (Acceso Rapido)': '通过 Google 快速登录',
    'Registrarse con Google': '通过 Google 注册',
  },
}

interface TranslationState {
  language: AuraLanguage
  translating: boolean
  setLanguage: (lang: AuraLanguage) => void
  setTranslating: (v: boolean) => void
}

function loadInitialLanguage(): AuraLanguage {
  if (typeof window === 'undefined') return 'es'
  const saved = window.localStorage.getItem(STORAGE_LANG_KEY) as AuraLanguage | null
  return saved && AURA_LANGUAGES.some((l) => l.code === saved) ? saved : 'es'
}

export const useTranslationStore = create<TranslationState>((set) => ({
  language: loadInitialLanguage(),
  translating: false,
  setLanguage: (language) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_LANG_KEY, language)
      document.documentElement.lang = language
    }
    set({ language })
  },
  setTranslating: (translating) => set({ translating }),
}))

const memoryCache: Record<Exclude<AuraLanguage, 'es'>, Map<string, string>> = {
  en: new Map(Object.entries(INSTANT_DICTIONARY.en)),
  fr: new Map(Object.entries(INSTANT_DICTIONARY.fr)),
  'zh-CN': new Map(Object.entries(INSTANT_DICTIONARY['zh-CN'])),
}

function hydrateCache(lang: Exclude<AuraLanguage, 'es'>) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${lang}`)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, string>
    const map = memoryCache[lang]
    for (const [k, v] of Object.entries(parsed)) {
      map.set(k, v)
    }
  } catch {
    // ignore storage errors
  }
}

function persistCache(lang: Exclude<AuraLanguage, 'es'>) {
  if (typeof window === 'undefined') return
  try {
    const obj: Record<string, string> = {}
    let count = 0
    for (const [k, v] of memoryCache[lang].entries()) {
      obj[k] = v
      if (++count > 800) break
    }
    window.localStorage.setItem(`${CACHE_PREFIX}${lang}`, JSON.stringify(obj))
  } catch {
    // ignore quota errors
  }
}

async function fetchFreeTranslation(text: string, targetLang: Exclude<AuraLanguage, 'es'>): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length < 2) return text
  const cached = memoryCache[targetLang].get(trimmed)
  if (cached) return cached

  // 1. Conexion a API gratuita de traduccion (Google Translate GTX Free Endpoint)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=${encodeURIComponent(
      targetLang,
    )}&dt=t&q=${encodeURIComponent(trimmed)}`
    const res = await fetch(url)
    if (res.ok) {
      const data = (await res.json()) as unknown
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = (data[0] as unknown[])
          .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
          .join('')
          .trim()
        if (translated) {
          memoryCache[targetLang].set(trimmed, translated)
          return translated
        }
      }
    }
  } catch {
    // Fallback a MyMemory Free Translation API
  }

  // 2. Respaldo gratuito MyMemory API
  try {
    const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      trimmed,
    )}&langpair=es|${encodeURIComponent(targetLang)}`
    const res = await fetch(fallbackUrl)
    if (res.ok) {
      const data = (await res.json()) as { responseData?: { translatedText?: string } }
      const translated = data?.responseData?.translatedText?.trim()
      if (translated) {
        memoryCache[targetLang].set(trimmed, translated)
        return translated
      }
    }
  } catch {
    // mantener texto original si no hay red
  }

  return text
}

const originalTextNodes = new WeakMap<Text, string>()
const lastAppliedText = new WeakMap<Text, string>()

function shouldTranslateTextNode(node: Text): boolean {
  const parent = node.parentElement
  if (!parent) return false
  const tag = parent.tagName
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'CODE' || tag === 'PRE') {
    return false
  }
  if (parent.closest('[data-no-translate="true"]')) return false
  const val = node.nodeValue?.trim() ?? ''
  if (val.length < 2) return false
  // Ignorar cadenas que son solo numeros, porcentajes, simbolos o codigos binarios
  if (/^[0-9.,%+\-*/=()#|[\]:;<>~$@_^\s]+$/.test(val)) return false
  return true
}

export function GlobalLiveTranslator() {
  const language = useTranslationStore((s) => s.language)
  const setTranslating = useTranslationStore((s) => s.setTranslating)
  const activeRunId = useRef(0)

  useEffect(() => {
    hydrateCache('en')
    hydrateCache('fr')
    hydrateCache('zh-CN')
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const runId = ++activeRunId.current

    const collectTextNodes = (): Text[] => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const nodes: Text[] = []
      let current = walker.nextNode()
      while (current) {
        const textNode = current as Text
        if (shouldTranslateTextNode(textNode)) {
          const currentVal = textNode.nodeValue ?? ''
          // Si el nodo cambio desde afuera (por React), actualizar su original en espanol
          const lastVal = lastAppliedText.get(textNode)
          if (!originalTextNodes.has(textNode) || (lastVal !== undefined && currentVal !== lastVal)) {
            originalTextNodes.set(textNode, currentVal)
          }
          nodes.push(textNode)
        }
        current = walker.nextNode()
      }
      return nodes
    }

    const restoreSpanish = () => {
      const nodes = collectTextNodes()
      for (const node of nodes) {
        const orig = originalTextNodes.get(node)
        if (orig !== undefined && node.nodeValue !== orig) {
          lastAppliedText.set(node, orig)
          node.nodeValue = orig
        }
      }
      setTranslating(false)
    }

    if (language === 'es') {
      restoreSpanish()
      return
    }

    let debounceTimer: number | null = null

    const translateDom = async () => {
      if (runId !== activeRunId.current) return
      const nodes = collectTextNodes()
      const pendingByString = new Map<string, Text[]>()

      for (const node of nodes) {
        const origRaw = originalTextNodes.get(node) ?? node.nodeValue ?? ''
        const trimmed = origRaw.trim()
        if (!trimmed) continue

        const cached = memoryCache[language].get(trimmed)
        if (cached) {
          const leading = origRaw.match(/^\s*/)?.[0] ?? ''
          const trailing = origRaw.match(/\s*$/)?.[0] ?? ''
          const nextVal = `${leading}${cached}${trailing}`
          if (node.nodeValue !== nextVal) {
            lastAppliedText.set(node, nextVal)
            node.nodeValue = nextVal
          }
        } else {
          const list = pendingByString.get(trimmed) ?? []
          list.push(node)
          pendingByString.set(trimmed, list)
        }
      }

      if (pendingByString.size === 0) return

      setTranslating(true)
      const entries = [...pendingByString.entries()]
      const batchSize = 6

      for (let i = 0; i < entries.length; i += batchSize) {
        if (runId !== activeRunId.current) return
        const chunk = entries.slice(i, i + batchSize)
        await Promise.all(
          chunk.map(async ([trimmed, targetNodes]) => {
            const translated = await fetchFreeTranslation(trimmed, language)
            if (runId !== activeRunId.current) return
            for (const node of targetNodes) {
              const origRaw = originalTextNodes.get(node) ?? trimmed
              const leading = origRaw.match(/^\s*/)?.[0] ?? ''
              const trailing = origRaw.match(/\s*$/)?.[0] ?? ''
              const nextVal = `${leading}${translated}${trailing}`
              lastAppliedText.set(node, nextVal)
              node.nodeValue = nextVal
            }
          }),
        )
      }

      persistCache(language)
      if (runId === activeRunId.current) {
        setTranslating(false)
      }
    }

    void translateDom()

    const observer = new MutationObserver(() => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        void translateDom()
      }, 180)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      if (debounceTimer) window.clearTimeout(debounceTimer)
    }
  }, [language, setTranslating])

  return null
}

export function LanguageSelectorButton({ compact = false }: { compact?: boolean }) {
  const language = useTranslationStore((s) => s.language)
  const translating = useTranslationStore((s) => s.translating)
  const setLanguage = useTranslationStore((s) => s.setLanguage)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const current = AURA_LANGUAGES.find((l) => l.code === language) ?? AURA_LANGUAGES[0]!

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div ref={menuRef} className="relative" data-no-translate="true">
      <AuraButton
        variant="neo"
        size="sm"
        icon={translating ? Loader2 : Globe}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Traducir todo el contenido del sistema"
        title="Traducir todo el sistema (Espanol, Ingles, Frances, Mandarin)"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-mono text-xs font-bold text-aura-400">{current.badge}</span>
        {!compact && <span className="hidden lg:inline">{current.label}</span>}
      </AuraButton>

      {open && (
        <div
          role="menu"
          aria-label="Seleccionar idioma de traduccion en vivo"
          className="modal-surface fixed inset-x-3 bottom-20 top-auto z-50 flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto rounded-2xl p-3 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-12 sm:w-64 sm:max-h-none sm:overflow-visible"
        >
          <p className="hud-label px-2 py-1 text-aura-400">Traduccion API en Vivo</p>
          {AURA_LANGUAGES.map((lang) => {
            const active = lang.code === language
            return (
              <button
                key={lang.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLanguage(lang.code)
                  useAuraStore.getState().pulse('SUCCESS', 700)
                  setOpen(false)
                }}
                className={cn(
                  'btn-jelly flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition',
                  active
                    ? 'border border-aura-500/45 bg-aura-500/20 font-semibold text-bone'
                    : 'border border-transparent text-graphite-300 hover:bg-white/5 hover:text-bone',
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-6 w-8 items-center justify-center rounded-lg border border-aura-500/35 bg-aura-500/15 font-mono text-[11px] font-bold text-aura-400">
                    {lang.badge}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium text-bone">{lang.nativeLabel}</span>
                    <span className="text-[10px] text-graphite-400">{lang.label}</span>
                  </span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-aura-400" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
