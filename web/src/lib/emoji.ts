import { getLang, t } from './i18n'
import { local } from './storage'
import type { ServerEmoji } from './types'

/** [emoji, texto para busca, grupo] — gerado por scripts/emojis.mjs */
export type EmojiRow = [string, string, number]

const cache = new Map<string, Promise<EmojiRow[]>>()

export function loadEmojis(): Promise<EmojiRow[]> {
  const lang = getLang()
  let p = cache.get(lang)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}emoji-${lang}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(t('Não deu para carregar os emojis.'))
        return r.json() as Promise<EmojiRow[]>
      })
      .catch((err) => {
        cache.delete(lang)
        throw err
      })
    cache.set(lang, p)
  }
  return p
}

export const EMOJI_GROUPS: { id: number; icon: string; label: () => string }[] = [
  { id: 0, icon: '😀', label: () => t('Carinhas e emoções') },
  { id: 1, icon: '👋', label: () => t('Pessoas') },
  { id: 3, icon: '🐻', label: () => t('Animais e natureza') },
  { id: 4, icon: '🍔', label: () => t('Comida e bebida') },
  { id: 5, icon: '✈️', label: () => t('Viagens e lugares') },
  { id: 6, icon: '⚽', label: () => t('Atividades') },
  { id: 7, icon: '💡', label: () => t('Objetos') },
  { id: 8, icon: '❤️', label: () => t('Símbolos') },
  { id: 9, icon: '🏳️', label: () => t('Bandeiras') },
]

/** reações rápidas que aparecem antes de a pessoa ter usado alguma */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

const RECENT_KEY = 'descarga-emojis-recentes'

export function recentEmojis(): string[] {
  try {
    const list = JSON.parse(local.get(RECENT_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(0, 24) : []
  } catch {
    return []
  }
}

export function pushRecent(emoji: string) {
  const list = [emoji, ...recentEmojis().filter((e) => e !== emoji)].slice(0, 24)
  local.set(RECENT_KEY, JSON.stringify(list))
}

/** emojis próprios dos servidores aparecem no texto como <:nome:id> */
export const CUSTOM_EMOJI = /<:([a-z0-9_]{2,32}):([0-9a-f-]{8,36})>/
export const customToken = (e: Pick<ServerEmoji, 'name' | 'id'>) => `<:${e.name}:${e.id}>`

/** a mensagem só tem emojis (fica grande, como no Discord) */
export function onlyEmojis(text: string) {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 120) return false
  const rest = trimmed.replace(new RegExp(CUSTOM_EMOJI.source, 'g'), '').replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u{FE0F}|\u{200D}|\u{20E3}|\s/gu, '')
  return rest === '' && (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(trimmed) || CUSTOM_EMOJI.test(trimmed))
}
