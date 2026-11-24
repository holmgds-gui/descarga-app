import { useEffect, useRef, useState } from 'react'
import { local } from '../lib/storage'
import { t } from '../lib/i18n'

type Panel = 'side' | 'members'

const CFG: Record<Panel, { cssVar: string; key: string; def: number; min: number; max: number; edge: 'right' | 'left'; attr: string }> = {
  side: { cssVar: '--side-w', key: 'descarga-largura-lateral', def: 240, min: 200, max: 480, edge: 'right', attr: 'data-side-compact' },
  members: { cssVar: '--members-w', key: 'descarga-largura-membros', def: 240, min: 200, max: 420, edge: 'left', attr: 'data-members-compact' },
}

/** Largura "só ícones": abaixo de ~150px a aba encolhe de uma vez para este tamanho. */
export const COMPACT_W = 72
const clamp = (n: number, c: { min: number; max: number }) => (n < 150 ? COMPACT_W : Math.max(c.min, Math.min(c.max, Math.round(n))))

function stored(panel: Panel) {
  const c = CFG[panel]
  const n = Number(local.get(c.key))
  return Number.isFinite(n) && n > 0 ? clamp(n, c) : c.def
}

function apply(panel: Panel, w: number) {
  const root = document.documentElement
  root.style.setProperty(CFG[panel].cssVar, `${w}px`)
  if (w <= COMPACT_W) root.setAttribute(CFG[panel].attr, '')
  else root.removeAttribute(CFG[panel].attr)
}

/** Faixa na borda de uma aba: arraste para o lado para aumentar ou diminuir; duplo clique volta ao tamanho padrão. */
export function ResizeHandle({ panel }: { panel: Panel }) {
  const c = CFG[panel]
  const [width, setWidth] = useState(() => stored(panel))
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; w: number } | null>(null)

  useEffect(() => apply(panel, width), [panel, width])

  const commit = (w: number) => {
    const v = clamp(w, c)
    setWidth(v)
    local.set(c.key, String(v))
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, w: width }
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    setWidth(clamp(start.current.w + (c.edge === 'right' ? dx : -dx), c))
  }
  const end = () => {
    if (!start.current) return
    start.current = null
    setDragging(false)
    local.set(c.key, String(width))
  }

  return (
    <div
      className={`resize-handle ${c.edge} ${dragging ? 'dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={t('Arraste para mudar a largura')}
      aria-valuemin={COMPACT_W}
      aria-valuemax={c.max}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => commit(c.def)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 40 : 10
        const dir = c.edge === 'right' ? 1 : -1
        const move = (d: number) => commit(d > 0 && width <= COMPACT_W ? c.min : d < 0 && width <= c.min ? COMPACT_W : width + d)
        if (e.key === 'ArrowRight') { e.preventDefault(); move(step * dir) }
        if (e.key === 'ArrowLeft') { e.preventDefault(); move(-step * dir) }
        if (e.key === 'Home') { e.preventDefault(); commit(c.def) }
      }}
    />
  )
}
