import { useEffect, useRef, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'
import { X } from 'lucide-react'
import { t } from '../lib/i18n'

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  footer,
}: {
  title?: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const box = useRef<HTMLDivElement>(null)
  // celular: a janela é uma "gaveta" de baixo; arrastar para baixo (com o conteúdo no topo) fecha
  useEffect(() => {
    const el = box.current
    if (!el || !window.matchMedia('(max-width: 767px)').matches) return
    let y0 = 0, x0 = 0, dy = 0, on = false, dead = false, vy = 0, ly = 0, lt = 0, past = false
    const scrollTop = (t: HTMLElement | null) => {
      for (let n = t; n && n !== el.parentElement; n = n.parentElement) {
        const o = getComputedStyle(n).overflowY
        if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1 && n.scrollTop > 0) return n.scrollTop
      }
      return 0
    }
    const start = (e: TouchEvent) => {
      on = false; dead = !!(e.target as HTMLElement).closest('input, textarea, select, [role="slider"], canvas, .crop-frame, .no-swipe') || e.touches.length !== 1
      y0 = ly = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; vy = 0; lt = e.timeStamp; past = false
      if (!dead && scrollTop(e.target as HTMLElement) > 0) dead = true
    }
    const move = (e: TouchEvent) => {
      if (dead) return
      const y = e.touches[0].clientY
      dy = y - y0
      const dt = e.timeStamp - lt
      if (dt > 0) vy = 0.8 * vy + 0.2 * ((y - ly) / dt)
      ly = y; lt = e.timeStamp
      if (!on) {
        if (Math.abs(e.touches[0].clientX - x0) > Math.abs(dy)) { dead = true; return }
        if (dy < 10) { if (dy < -10) dead = true; return }
        on = true; el.style.transition = 'none'; el.style.animation = 'none'
      }
      if (e.cancelable) e.preventDefault()
      const p = Math.max(0, dy)
      el.style.transform = `translate3d(0,${p}px,0)`
      const bd = el.parentElement
      if (bd) bd.style.background = `rgba(0,0,0,${0.6 * (1 - Math.min(1, p / 500))})`
      const pp = p > 110
      if (pp && !past) haptic(6)
      past = pp
    }
    const end = () => {
      if (!on) return
      on = false
      const close = dy > 110 || vy > 0.6
      el.style.transition = 'transform .26s cubic-bezier(.32,.72,0,1)'
      if (close) {
        haptic(10)
        el.style.transform = 'translate3d(0,110%,0)'
        window.setTimeout(onClose, 200)
      } else {
        el.style.transform = 'translate3d(0,0,0)'
        const bd = el.parentElement
        if (bd) bd.style.background = ''
      }
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end, { passive: true })
    el.addEventListener('touchcancel', end, { passive: true })
    return () => {
      el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end)
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" aria-hidden="true" />
        <button className="icon-btn modal-close" onClick={onClose} aria-label={t('Fechar')}>
          <X size={20} />
        </button>
        {title && (
          <header className="modal-header">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </header>
        )}
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  )
}
