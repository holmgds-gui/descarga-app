import { Fragment, type ReactNode } from 'react'

/** Formatação simples e segura: **negrito**, *itálico*, __sublinhado__, ~~riscado~~, `código`, ```bloco``` e links. */
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
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(~~[^~\n]+~~)|(\*[^*\n]+\*)|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|((?<![\w.@])@[a-z0-9_.]{2,32})/g

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
    last = idx + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const longDateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatTimestamp(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return `Hoje às ${timeFmt.format(d)}`
  if (same(d, yesterday)) return `Ontem às ${timeFmt.format(d)}`
  return `${dateFmt.format(d)} ${timeFmt.format(d)}`
}

export const formatTime = (iso: string) => timeFmt.format(new Date(iso))
export const formatLongDate = (iso: string) => longDateFmt.format(new Date(iso))

export function formatBirthday(date: string) {
  const [, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date(2000, m - 1, d))
}
