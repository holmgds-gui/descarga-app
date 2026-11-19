import type { PointerEvent } from 'react'

/**
 * Arrastar uma mensagem para a direita para responder (dedo no celular, mouse no PC).
 * No mouse só começa fora do texto, para não atrapalhar quem quer selecionar.
 */
const THRESHOLD = 64
const MAX_PULL = 90
interface State { x: number; y: number; id: number; active: boolean; touch: boolean }
const states = new WeakMap<HTMLElement, State>()

const SKIP = '.msg-content, .msg-meta, button, a, video, audio, textarea, input, .att-images, .att-file, .voice-msg, .reactions, .edit-box'

function reset(el: HTMLElement) {
  el.style.removeProperty('--swipe')
  el.style.removeProperty('user-select')
  el.classList.remove('swiping', 'swipe-ready')
  states.delete(el)
}

export function swipeHandlers(onReply: () => void, enabled = true) {
  if (!enabled) return {}
  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      const el = e.currentTarget
      const touch = e.pointerType !== 'mouse'
      if (!touch && (e.target as HTMLElement).closest(SKIP)) return
      states.set(el, { x: e.clientX, y: e.clientY, id: e.pointerId, active: false, touch })
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const el = e.currentTarget
      const s = states.get(el)
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (!s.active) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { states.delete(el); return } // rolagem
        if (dx > 12 && dx > Math.abs(dy) * 1.5) {
          s.active = true
          el.style.userSelect = 'none'
          try { el.setPointerCapture(e.pointerId) } catch { /* ok */ }
          el.classList.add('swiping')
        } else return
      }
      const pull = Math.max(0, Math.min(MAX_PULL, dx))
      el.style.setProperty('--swipe', String(pull))
      el.classList.toggle('swipe-ready', pull >= THRESHOLD)
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const el = e.currentTarget
      const s = states.get(el)
      if (!s || s.id !== e.pointerId) return
      const ready = s.active && e.clientX - s.x >= THRESHOLD
      if (s.active) try { el.releasePointerCapture(e.pointerId) } catch { /* ok */ }
      reset(el)
      if (ready) onReply()
    },
    onPointerCancel(e: PointerEvent<HTMLElement>) {
      reset(e.currentTarget)
    },
  }
}
