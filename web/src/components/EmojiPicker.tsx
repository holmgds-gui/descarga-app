import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock, Search, X } from 'lucide-react'
import { EMOJI_GROUPS, customToken, loadEmojis, pushRecent, recentEmojis, type EmojiRow } from '../lib/emoji'
import { EmojiGlyph } from '../lib/format'
import type { ServerEmoji } from '../lib/types'
import { useApp } from '../state'
import { t } from '../lib/i18n'

const W = 360
const H = 430

/**
 * Seletor de emojis: busca, recentes, emojis dos seus servidores e todos os emojis comuns.
 * Abre perto do botão que foi clicado (no celular, sobe de baixo).
 */
export function EmojiPicker({ anchor, onPick, onClose, keepOpen = false }: {
  anchor: DOMRect
  onPick: (emoji: string) => void
  onClose: () => void
  /** continua aberto depois de escolher (útil no campo de mensagem) */
  keepOpen?: boolean
}) {
  const { emojis, servers } = useApp()
  const [rows, setRows] = useState<EmojiRow[] | null>(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [hover, setHover] = useState<{ glyph: string; name: string } | null>(null)
  const [recent] = useState(recentEmojis)
  const ref = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const mobile = window.innerWidth < 600

  useEffect(() => {
    let alive = true
    loadEmojis().then((r) => alive && setRows(r)).catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose())
    const id = window.setTimeout(() => document.addEventListener('pointerdown', onDown))
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  useLayoutEffect(() => {
    if (mobile) return
    let top = anchor.top - H - 8
    if (top < 8) top = Math.min(anchor.bottom + 8, window.innerHeight - H - 8)
    let left = anchor.right - W
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8))
    setPos({ top: Math.max(8, top), left })
  }, [anchor, mobile])

  const pick = (glyph: string) => {
    pushRecent(glyph)
    onPick(glyph)
    if (!keepOpen) onClose()
  }

  const q = query.trim().toLowerCase()
  const byServer = useMemo(() => {
    const map = new Map<string, ServerEmoji[]>()
    for (const e of emojis) {
      if (q && !e.name.includes(q.replace(/:/g, ''))) continue
      if (!map.has(e.server_id)) map.set(e.server_id, [])
      map.get(e.server_id)!.push(e)
    }
    return [...map.entries()]
  }, [emojis, q])

  const filtered = useMemo(() => {
    if (!rows || !q) return null
    const words = q.split(/\s+/).filter(Boolean)
    return rows.filter(([, text]) => words.every((w) => text.includes(w))).slice(0, 240)
  }, [rows, q])

  const nameOf = (glyph: string) => {
    if (glyph.startsWith('<:')) return glyph.split(':')[1]
    return rows?.find((r) => r[0] === glyph)?.[1].split(' ')[0] ?? ''
  }

  const jump = (id: string) => {
    const el = scrollRef.current?.querySelector(`[data-sec="${id}"]`) as HTMLElement | null
    if (el && scrollRef.current) scrollRef.current.scrollTop = el.offsetTop - 4
  }

  const btn = (glyph: string, name: string, key?: string) => (
    <button key={key ?? glyph} type="button" className="emoji-btn" aria-label={name || glyph}
      onMouseEnter={() => setHover({ glyph, name })} onFocus={() => setHover({ glyph, name })} onClick={() => pick(glyph)}>
      <EmojiGlyph value={glyph} />
    </button>
  )

  const serverName = (id: string) => servers.find((s) => s.id === id)?.name ?? ''

  const body = (
    <div ref={ref} className={`emoji-picker ${mobile ? 'sheet' : ''}`} role="dialog" aria-label={t('Escolher emoji')}
      style={pos && !mobile ? { top: pos.top, left: pos.left } : undefined}>
      <div className="emoji-search">
        <Search size={16} />
        <input autoFocus={!mobile} value={query} placeholder={t('Procurar emoji')} onChange={(e) => setQuery(e.target.value)} />
        {query && <button type="button" className="icon-btn tiny" aria-label={t('Limpar')} onClick={() => setQuery('')}><X size={14} /></button>}
      </div>
      <div className="emoji-main">
        {!q && (
          <nav className="emoji-cats" aria-label={t('Categorias')}>
            {recent.length > 0 && (
              <button type="button" aria-label={t('Usados recentemente')} data-tip={t('Usados recentemente')} onClick={() => jump('recent')}><Clock size={18} /></button>
            )}
            {byServer.map(([sid, list]) => (
              <button key={sid} type="button" aria-label={serverName(sid)} data-tip={serverName(sid)} onClick={() => jump(sid)}>
                <EmojiGlyph value={customToken(list[0])} size={20} />
              </button>
            ))}
            {EMOJI_GROUPS.map((g) => (
              <button key={g.id} type="button" aria-label={g.label()} data-tip={g.label()} onClick={() => jump(`g${g.id}`)}>{g.icon}</button>
            ))}
          </nav>
        )}
        <div className="emoji-scroll" ref={scrollRef}>
          {error && <p className="muted small pad">{t('Não deu para carregar os emojis.')}</p>}
          {!rows && !error && <div className="loading-dots"><span /><span /><span /></div>}
          {!q && recent.length > 0 && (
            <section data-sec="recent">
              <h4>{t('Usados recentemente')}</h4>
              <div className="emoji-grid">{recent.map((g) => btn(g, nameOf(g), `r-${g}`))}</div>
            </section>
          )}
          {byServer.map(([sid, list]) => (
            <section key={sid} data-sec={sid}>
              <h4>{serverName(sid)}</h4>
              <div className="emoji-grid">{list.map((e) => btn(customToken(e), e.name, e.id))}</div>
            </section>
          ))}
          {filtered ? (
            <section>
              {!filtered.length && !byServer.length && <p className="muted small pad">{t('Nenhum emoji encontrado.')}</p>}
              <div className="emoji-grid">{filtered.map(([g, text]) => btn(g, text.split(' ')[0]))}</div>
            </section>
          ) : (
            rows && EMOJI_GROUPS.map((g) => (
              <section key={g.id} data-sec={`g${g.id}`}>
                <h4>{g.label()}</h4>
                <div className="emoji-grid">
                  {rows.filter((r) => r[2] === g.id).map(([glyph, text]) => btn(glyph, text.split(' ')[0]))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
      <footer className="emoji-preview">
        {hover ? (
          <>
            <EmojiGlyph value={hover.glyph} size={28} />
            <span className="truncate">{hover.glyph.startsWith('<:') ? `:${hover.name}:` : hover.name}</span>
          </>
        ) : (
          <span className="muted small">{t('Passe o mouse num emoji para ver o nome')}</span>
        )}
      </footer>
    </div>
  )

  return createPortal(mobile ? <div className="sheet-backdrop emoji-backdrop">{body}</div> : body, document.body)
}
