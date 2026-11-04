import { locale, t } from './i18n'
import { Fragment, type ReactNode } from 'react'
import { useApp } from '../state'

/** Formatação simples e segura: **negrito**, *itálico*, __sublinhado__, ~~riscado~~, `código`, ```bloco```, links e emojis do servidor. */
export function renderMessage(text: string): ReactNode {
  const blocks = text.split(/```/)
  return blocks.map((part, i) =>
    i % 2 === 1 ? (
      <pre key={i} className="code-block">
        <code>{part.replace(/^\w*\n/, '')}</code>
      </pre>
    ) : (
      <Fragment key={i}>{renderInline(part)}</Fragment>
    ),
  )
}

const TOKEN =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(~~[^~\n]+~~)|(\*[^*\n]+\*)|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|((?<![\w.@])@[a-z0-9_.]{2,32})|(<:[a-z0-9_]{2,32}:[0-9a-f-]{8,36}>)/g

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let k = 0
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0
    if (idx > last) out.push(text.slice(last, idx))
    const t = m[0]
    if (m[1]) out.push(<code key={k++} className="inline-code">{t.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={k++}>{renderInline(t.slice(2, -2))}</strong>)
    else if (m[3]) out.push(<u key={k++}>{renderInline(t.slice(2, -2))}</u>)
    else if (m[4]) out.push(<s key={k++}>{renderInline(t.slice(2, -2))}</s>)
    else if (m[5]) out.push(<em key={k++}>{renderInline(t.slice(1, -1))}</em>)
    else if (m[6])
      out.push(
        <a key={k++} href={t} target="_blank" rel="noopener noreferrer nofollow">
          {t}
        </a>,
      )
    else if (m[7]) out.push(<span key={k++} className="mention">{t}</span>)
    else if (m[8]) out.push(<CustomEmoji key={k++} token={t} />)
    last = idx + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** emoji próprio de servidor (<:nome:id>); quem não está no servidor vê :nome: */
export function CustomEmoji({ token, size }: { token: string; size?: number }) {
  const { emojiById } = useApp()
  const [, name, id] = token.match(/^<:([a-z0-9_]{2,32}):([0-9a-f-]{8,36})>$/) ?? []
  const e = id ? emojiById.get(id) : undefined
  if (!e) return <span className="emoji-missing">:{name}:</span>
  return <img className="custom-emoji" src={e.url} alt={`:${e.name}:`} title={`:${e.name}:`} draggable={false}
    style={size ? { width: size, height: size } : undefined} />
}

/** mostra um emoji comum ou um do servidor */
export function EmojiGlyph({ value, size }: { value: string; size?: number }) {
  if (value.startsWith('<:')) return <CustomEmoji token={value} size={size} />
  return <span className="emoji-glyph" style={size ? { fontSize: size } : undefined}>{value}</span>
}

// formatadores no idioma atual (recriados quando o idioma muda)
const fmt = (opts: Intl.DateTimeFormatOptions) => (d: Date) => new Intl.DateTimeFormat(locale(), opts).format(d)
const timeFmt = { format: fmt({ hour: '2-digit', minute: '2-digit' }) }
const dateFmt = { format: fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }) }
const longDateFmt = { format: fmt({ day: 'numeric', month: 'long', year: 'numeric' }) }

export function formatTimestamp(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return t('Hoje às {hora}', { hora: timeFmt.format(d) })
  if (same(d, yesterday)) return t('Ontem às {hora}', { hora: timeFmt.format(d) })
  return `${dateFmt.format(d)} ${timeFmt.format(d)}`
}

export const formatTime = (iso: string) => timeFmt.format(new Date(iso))
export const formatLongDate = (iso: string) => longDateFmt.format(new Date(iso))

export function formatBirthday(date: string) {
  const [, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' }).format(new Date(2000, m - 1, d))
}
