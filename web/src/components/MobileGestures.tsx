import { useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useApp, lastChannelKey } from '../state'
import { haptic } from '../lib/haptics'
import { local } from '../lib/storage'

/**
 * Gestos de arrastar do celular (os painéis acompanham o dedo):
 *  • da borda esquerda (ou arrastando no topo/rodapé da conversa) para a direita → abre a lista de conversas e servidores;
 *  • com a lista aberta, arrastar para a esquerda → fecha;
 *  • da borda direita para a esquerda → abre membros / perfil; com ele aberto, arrastar para a direita fecha;
 *  • arrastar a conversa para a esquerda → volta para a última conversa aberta (e de novo, para voltar);
 *  • puxar para baixo no topo das listas → atualiza.
 * Responder uma mensagem arrastando fica em lib/swipe.ts.
 */
type Entry = { k: 'dm'; id: string } | { k: 'ch'; sid: string; cid: string }
const same = (a: Entry, b: Entry) => (a.k === 'dm' && b.k === 'dm' ? a.id === b.id : a.k === 'ch' && b.k === 'ch' && a.cid === b.cid)

const EDGE = 30
const SKIP = 'input, textarea, select, [contenteditable="true"], video, audio, .crop-frame, .no-swipe, .modal-backdrop, .lightbox, .popover, .crop-box, .sheet, [class*="ctx"], [class*="settings"]'
const PTR = '.channel-list, .home-body, .friends-body'

function scrollsX(el: HTMLElement | null, stop: HTMLElement) {
  for (let e = el; e && e !== stop; e = e.parentElement) {
    const o = getComputedStyle(e).overflowX
    if ((o === 'auto' || o === 'scroll') && e.scrollWidth > e.clientWidth + 2) return true
  }
  return false
}

export function MobileGestures({ membersApplicable }: { membersApplicable: boolean }) {
  const app = useApp()
  const live = useRef({ app, membersApplicable })
  live.current = { app, membersApplicable }
  const recents = useRef<Entry[]>([])

  // lembra as conversas na ordem em que foram abertas (a primeira é a atual)
  const { activeDmId, activeServerId, activeChannelId, channels, dms, servers } = app
  const ch = channels.find((c) => c.id === activeChannelId)
  const cur: Entry | null = !activeServerId && activeDmId ? { k: 'dm', id: activeDmId } : activeServerId && ch?.type === 'text' ? { k: 'ch', sid: activeServerId, cid: ch.id } : null
  const curKey = cur ? (cur.k === 'dm' ? 'd' + cur.id : 'c' + cur.cid) : ''
  useEffect(() => {
    if (!cur) return
    recents.current = [cur, ...recents.current.filter((e) => !same(e, cur))].slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curKey])
  const previous = (): Entry | undefined =>
    recents.current.slice(1).find((e) => (e.k === 'dm' ? dms.some((d) => d.id === e.id) : servers.some((s) => s.id === e.sid)))
  const previousRef = useRef(previous)
  previousRef.current = previous

  useEffect(() => {
    const appEl = document.querySelector<HTMLElement>('.app')
    const main = document.querySelector<HTMLElement>('.main-pane')
    if (!appEl || !main) return
    const narrow = () => window.matchMedia('(max-width: 767px)').matches

    // indicador de "puxar para atualizar"
    const ind = document.createElement('div')
    ind.className = 'ptr-indicator'
    ind.innerHTML = '<span></span>'
    document.body.appendChild(ind)

    type Mode = 'nav-open' | 'nav-close' | 'mem-open' | 'mem-close' | 'recent' | 'ptr'
    let t0: { x: number; y: number; target: HTMLElement; scroller: HTMLElement | null; edgeL: boolean; edgeR: boolean; head: boolean } | null = null
    let mode: Mode | null = null
    let dead = false
    let lx = 0, lt = 0, vx = 0, dx = 0, dy = 0, crossed = false, raf = 0
    let refreshing = false

    const W = () => window.innerWidth
    const panelW = () => document.querySelector<HTMLElement>('.members-pane')?.offsetWidth || Math.min(320, W() * 0.85)

    const apply = () => {
      raf = 0
      if (!mode) return
      const w = W()
      if (mode === 'nav-open') {
        const p = Math.max(0, Math.min(w, dx))
        appEl.style.setProperty('--nav-x', p + 'px')
        tick(p > w * 0.3)
      } else if (mode === 'nav-close') {
        const p = Math.max(0, Math.min(w, w + dx))
        appEl.style.setProperty('--nav-x', p + 'px')
        tick(p < w * 0.7)
      } else if (mode === 'mem-open') {
        const P = panelW(), p = Math.max(0, Math.min(P, -dx))
        appEl.style.setProperty('--mem-x', p + 'px'); appEl.style.setProperty('--mem-p', String(p / P))
        tick(p > P * 0.35)
      } else if (mode === 'mem-close') {
        const P = panelW(), p = Math.max(0, Math.min(P, P - dx))
        appEl.style.setProperty('--mem-x', p + 'px'); appEl.style.setProperty('--mem-p', String(p / P))
        tick(p < P * 0.65)
      } else if (mode === 'recent') {
        const p = Math.min(0, dx)
        main.style.transform = `translate3d(${p}px,0,0)`
        main.style.opacity = String(1 - Math.min(0.55, Math.abs(p) / w))
        tick(-p > w * 0.28)
      } else if (mode === 'ptr') {
        const p = Math.max(0, Math.min(110, dy * 0.5))
        ind.style.transform = `translate(-50%, ${p - 44}px)`
        ind.style.opacity = String(Math.min(1, p / 50))
        ind.firstElementChild!.setAttribute('style', `transform: rotate(${p * 5}deg)`)
        tick(p > 55)
      }
    }
    const tick = (past: boolean) => {
      if (past && !crossed) haptic(6)
      crossed = past
    }

    const clear = () => {
      appEl.classList.remove('gesturing')
      appEl.style.removeProperty('--nav-x'); appEl.style.removeProperty('--mem-x'); appEl.style.removeProperty('--mem-p')
      main.style.removeProperty('transform'); main.style.removeProperty('opacity'); main.style.removeProperty('transition')
    }

    const onStart = (e: TouchEvent) => {
      t0 = null; mode = null; dead = false; crossed = false; dx = dy = vx = 0
      if (!narrow() || e.touches.length !== 1) return
      const target = e.target as HTMLElement
      if (target.closest(SKIP) || document.querySelector('.modal-backdrop, .lightbox')) return
      const tc = e.touches[0]
      if (scrollsX(target, appEl)) { dead = true; return }
      lx = tc.clientX; lt = e.timeStamp
      t0 = {
        x: tc.clientX, y: tc.clientY, target, scroller: target.closest<HTMLElement>(PTR),
        edgeL: tc.clientX <= EDGE, edgeR: tc.clientX >= W() - EDGE,
        head: !!target.closest('.chat-header, .composer-wrap'),
      }
    }

    const lock = (): boolean => {
      if (!t0) return false
      const { app: a, membersApplicable: ma } = live.current
      const pane = a.mobilePane
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (pane === 'nav') { if (dx < 0) mode = 'nav-close' }
        else if (pane === 'members') { if (dx > 0) mode = 'mem-close' }
        else if (dx > 0 && (t0.edgeL || t0.head)) mode = 'nav-open'
        else if (dx < 0 && t0.edgeR && ma) mode = 'mem-open'
        else if (dx < 0 && !t0.edgeR && previousRef.current()) mode = 'recent'
        if (!mode) { dead = true; return false }
      } else if (dy > 10 && dy > Math.abs(dx) * 1.4 && t0.scroller && t0.scroller.scrollTop <= 0 && !refreshing) {
        mode = 'ptr'
      } else if (Math.abs(dy) > 14) { dead = true; return false }
      else return false
      appEl.classList.add('gesturing')
      main.style.transition = 'none'
      return true
    }

    const onMove = (e: TouchEvent) => {
      if (!t0 || dead) return
      const tc = e.touches[0]
      dx = tc.clientX - t0.x; dy = tc.clientY - t0.y
      const dt = e.timeStamp - lt
      if (dt > 0) vx = 0.8 * vx + 0.2 * ((tc.clientX - lx) / dt)
      lx = tc.clientX; lt = e.timeStamp
      if (!mode && !lock()) return
      if (e.cancelable) e.preventDefault()
      if (!raf) raf = requestAnimationFrame(apply)
    }

    const finish = async (cancelled: boolean) => {
      const m = mode
      const w = W()
      t0 = null; mode = null
      if (raf) { cancelAnimationFrame(raf); raf = 0 }
      if (!m) return
      const { app: a } = live.current
      if (m === 'ptr') {
        const go = !cancelled && dy * 0.5 > 55
        ind.style.transition = 'transform .25s, opacity .25s'
        appEl.classList.remove('gesturing')
        if (!go) { ind.style.transform = 'translate(-50%, -44px)'; ind.style.opacity = '0'; setTimeout(() => { ind.style.transition = '' }, 260); return }
        refreshing = true; haptic(12)
        ind.style.transform = 'translate(-50%, 24px)'; ind.style.opacity = '1'; ind.classList.add('spin')
        await Promise.all([a.refreshDms(), a.refreshServers(), a.refreshFriends(), new Promise((r) => setTimeout(r, 700))]).catch(() => undefined)
        ind.style.transform = 'translate(-50%, -44px)'; ind.style.opacity = '0'
        setTimeout(() => { ind.classList.remove('spin'); ind.style.transition = ''; refreshing = false }, 280)
        return
      }
      const fast = (dir: number) => !cancelled && vx * dir > 0.45
      if (m === 'recent') {
        const prev = previousRef.current()
        const go = !cancelled && prev && (-dx > w * 0.28 || fast(-1))
        if (!go || !prev) {
          main.style.transition = 'transform .28s cubic-bezier(.32,.72,0,1), opacity .28s'
          main.style.transform = 'translate3d(0,0,0)'; main.style.opacity = '1'
          appEl.classList.remove('gesturing')
          setTimeout(clear, 300)
          return
        }
        haptic(10)
        main.style.transition = 'transform .16s ease-in, opacity .16s'
        main.style.transform = `translate3d(${-w * 0.4}px,0,0)`; main.style.opacity = '0'
        await new Promise((r) => setTimeout(r, 150))
        flushSync(() => {
          if (prev.k === 'dm') a.setActiveDmId(prev.id)
          else {
            local.set(lastChannelKey(prev.sid), prev.cid)
            if (prev.sid === a.activeServerId) a.setActiveChannelId(prev.cid)
            else a.setActiveServerId(prev.sid)
          }
        })
        clear()
        main.classList.remove('slide-in')
        void main.offsetWidth
        main.classList.add('slide-in')
        setTimeout(() => main.classList.remove('slide-in'), 400)
        return
      }
      let open: boolean
      if (m === 'nav-open') open = !cancelled && (dx > w * 0.3 || fast(1))
      else if (m === 'nav-close') open = !(!cancelled && (-dx > w * 0.3 || fast(-1)))
      else if (m === 'mem-open') open = !cancelled && (-dx > panelW() * 0.35 || fast(-1))
      else open = !(!cancelled && (dx > panelW() * 0.35 || fast(1)))
      const next = m.startsWith('nav') ? (open ? 'nav' : 'chat') : open ? 'members' : 'chat'
      if (next !== a.mobilePane) haptic(10)
      flushSync(() => a.setMobilePane(next))
      clear()
    }

    const onEnd = () => void finish(false)
    const onCancel = () => void finish(true)
    const opt = { passive: false } as AddEventListenerOptions
    appEl.addEventListener('touchstart', onStart, { passive: true })
    appEl.addEventListener('touchmove', onMove, opt)
    appEl.addEventListener('touchend', onEnd, { passive: true })
    appEl.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      appEl.removeEventListener('touchstart', onStart)
      appEl.removeEventListener('touchmove', onMove)
      appEl.removeEventListener('touchend', onEnd)
      appEl.removeEventListener('touchcancel', onCancel)
      ind.remove()
      clear()
    }
  }, [])

  return null
}
