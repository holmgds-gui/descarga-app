/**
 * Idiomas do Descarga. O texto em português é a própria chave: t('Entrar') → "Sign in" em inglês.
 * Variáveis: t('Sair de {nome}', { nome: 'Galera' }).
 */
import { useSyncExternalStore } from 'react'
import { local } from './storage'
import { EN } from './i18n.en'

export type Lang = 'pt' | 'en'
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'pt', label: 'Português (Brasil)' },
  { id: 'en', label: 'English' },
]

const KEY = 'descarga-idioma'
const listeners = new Set<() => void>()

function detect(): Lang {
  const saved = local.get(KEY)
  if (saved === 'pt' || saved === 'en') return saved
  const nav = (navigator.languages?.[0] ?? navigator.language ?? 'pt').toLowerCase()
  return nav.startsWith('pt') ? 'pt' : 'en'
}

let lang: Lang = detect()
document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'

export const getLang = () => lang
export const locale = () => (lang === 'pt' ? 'pt-BR' : 'en-US')

export function setLang(next: Lang) {
  if (next === lang) return
  lang = next
  local.set(KEY, next)
  document.documentElement.lang = next === 'pt' ? 'pt-BR' : 'en'
  for (const cb of listeners) cb()
}

export function useLang() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => lang,
  )
}

const missing = new Set<string>()

export function t(pt: string, vars?: Record<string, string | number>): string {
  let s = pt
  if (lang === 'en') {
    const en = EN[pt]
    if (en !== undefined) s = en
    else if (import.meta.env.DEV && !missing.has(pt)) {
      missing.add(pt)
      console.warn('[i18n] sem tradução:', pt)
    }
  }
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}
