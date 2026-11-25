import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Bell, BellOff, Cog, Compass, Fingerprint, LogOut, Plus, UserPlus } from 'lucide-react'
import { backend } from '../lib/backend'
import type { Server, ServerPrefs } from '../lib/types'
import { useApp } from '../state'
import { DiscoverModal, InviteModal, ServerCreateModal } from './ServerModals'
import { t } from '../lib/i18n'
import { copyText, showContextMenu } from './ContextMenu'

export function ServerRail() {
  const { servers, activeServerId, setActiveServerId, goHome, unreadDms, friendships, userId, toast, ask, refreshServers, serverPrefs, setServerPrefs, reorderServers } = useApp()
  const homeBadge = unreadDms.size + friendships.filter((f) => f.status === 'pending' && f.addressee === userId).length
  const [creating, setCreating] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [inviting, setInviting] = useState<Server | null>(null)

  const isMuted = (id: string) => {
    const p = serverPrefs[id]
    return !!p && (p.level === 'none' || (!!p.muted_until && new Date(p.muted_until).getTime() > Date.now()))
  }

  /** menu do botão direito no servidor (as permissões dessa pessoa naquele servidor são buscadas na hora) */
  const serverMenu = async (e: { clientX: number; clientY: number }, s: Server) => {
    const at = { clientX: e.clientX, clientY: e.clientY, preventDefault() {}, stopPropagation() {} } as unknown as MouseEvent
    const owner = s.owner_id === userId
    let perms = new Set<string>()
    if (!owner) {
      try {
        const [roles, members] = await Promise.all([backend.listRoles(s.id), backend.listMemberRoles(s.id)])
        const mine = members[userId] ?? []
        perms = new Set(roles.filter((r) => mine.includes(r.id)).flatMap((r) => r.permissions))
      } catch { /* sem permissões extras */ }
    }
    const can = (p: string) => owner || perms.has(p)
    const prefs = serverPrefs[s.id] ?? { level: 'all' as const, muted_until: null }
    const save = (p: ServerPrefs) => void setServerPrefs(s.id, p).catch((err: Error) => toast(err.message))
    const muteFor = (ms: number | null) => save({ ...prefs, muted_until: ms === null ? '9999-12-31T00:00:00Z' : new Date(Date.now() + ms).toISOString() })
    const open = (ev: string) => {
      setActiveServerId(s.id)
      window.setTimeout(() => window.dispatchEvent(new CustomEvent(ev, { detail: s.id })), 120)
    }
    const MIN = 60_000
    showContextMenu(at, [
      { label: t('Convidar para o servidor'), icon: <UserPlus size={16} />, onClick: () => setInviting(s) },
      isMuted(s.id) && prefs.level !== 'none'
        ? { label: t('Reativar servidor'), icon: <Bell size={16} />, separator: true, onClick: () => save({ ...prefs, muted_until: null }) }
        : {
            label: t('Silenciar servidor'), icon: <BellOff size={16} />, separator: true,
            children: [
              { label: t('Por 15 minutos'), onClick: () => muteFor(15 * MIN) },
              { label: t('Por 1 hora'), onClick: () => muteFor(60 * MIN) },
              { label: t('Por 8 horas'), onClick: () => muteFor(8 * 60 * MIN) },
              { label: t('Por 24 horas'), onClick: () => muteFor(24 * 60 * MIN) },
              { label: t('Até eu reativar'), onClick: () => muteFor(null) },
            ],
          },
      {
        label: t('Configurar avisos'), icon: <Bell size={16} />,
        children: [
          { label: t('Menções, respostas e chamadas'), checked: prefs.level === 'all', onClick: () => save({ ...prefs, level: 'all' }) },
          { label: t('Só menções e respostas'), checked: prefs.level === 'mentions', onClick: () => save({ ...prefs, level: 'mentions' }) },
          { label: t('Nada'), checked: prefs.level === 'none', onClick: () => save({ ...prefs, level: 'none' }) },
        ],
      },
      ...(owner || perms.size > 0 ? [{ label: t('Configurações do servidor'), icon: <Cog size={16} />, separator: true, onClick: () => open('descarga-server-settings') }] : []),
      ...(can('manage_channels') ? [{ label: t('Criar canal'), icon: <Plus size={16} />, onClick: () => open('descarga-create-channel') }] : []),
      ...(!owner ? [{
        label: t('Sair do servidor'), icon: <LogOut size={16} />, danger: true, separator: true,
        onClick: () => void (async () => {
          const ok = await ask({ title: t('Sair de {nome}', { nome: s.name }), message: t('Você vai precisar de um novo convite para voltar.'), confirmLabel: t('Sair do servidor'), danger: true })
          if (!ok) return
          try {
            await backend.leaveServer(s.id)
            await refreshServers()
            toast(t('Você saiu do servidor'))
          } catch (err) {
            toast((err as Error).message)
          }
        })(),
      }] : []),
      { label: t('Copiar ID do servidor'), icon: <Fingerprint size={16} />, separator: true, onClick: () => copyText(s.id, toast) },
    ])
  }

  // ordem escolhida por mim (arrastando); servidores sem posição ficam no fim, na ordem original
  const sorted = useMemo(() => {
    const pos = (s: Server, i: number) => serverPrefs[s.id]?.position ?? 1e6 + i
    return servers.map((s, i) => ({ s, k: pos(s, i) })).sort((a, b) => a.k - b.k).map((x) => x.s)
  }, [servers, serverPrefs])

  // arrastar para reorganizar: segurar (celular, ~0,35 s) ou puxar com o mouse
  const [drag, setDrag] = useState<{ id: string; from: number; to: number; dy: number } | null>(null)
  const press = useRef<{
    id: string; from: number; to: number; pointerId: number; type: string; x: number; y: number; tops: number[]; stride: number; grab: number
    started: boolean; moved: boolean; timer?: number; ids: string[]; server: Server
  } | null>(null)
  const justDragged = useRef(false)
  const lastType = useRef('mouse')

  const stopTouchScroll = useCallback((e: TouchEvent) => { if (e.cancelable) e.preventDefault() }, [])

  const begin = useCallback((st: NonNullable<typeof press.current>) => {
    st.started = true
    document.addEventListener('touchmove', stopTouchScroll, { passive: false })
    document.body.classList.add('rail-dragging')
    try { navigator.vibrate?.(12) } catch { /* sem vibração */ }
    setDrag({ id: st.id, from: st.from, to: st.from, dy: 0 })
  }, [stopTouchScroll])

  const startPress = (e: ReactPointerEvent<HTMLElement>, s: Server, from: number) => {
    lastType.current = e.pointerType
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (sorted.length < 2) return
    const items = Array.from(e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('.rail-item[data-sid]') ?? [])
    if (items.length !== sorted.length) return
    const tops = items.map((i) => i.getBoundingClientRect().top)
    const stride = tops.length > 1 ? tops[1] - tops[0] : 60
    const st = {
      id: s.id, from, to: from, pointerId: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, tops, stride,
      grab: e.clientY - tops[from], started: false, moved: false, ids: sorted.map((x) => x.id), server: s,
    } as NonNullable<typeof press.current>
    press.current = st
    if (e.pointerType !== 'mouse') st.timer = window.setTimeout(() => begin(st), 350)

    const cleanup = () => {
      window.clearTimeout(st.timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      document.removeEventListener('touchmove', stopTouchScroll)
      document.body.classList.remove('rail-dragging')
      press.current = null
      setDrag(null)
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== st.pointerId) return
      const dist = Math.hypot(ev.clientX - st.x, ev.clientY - st.y)
      if (!st.started) {
        if (st.type === 'mouse' && dist > 6) begin(st)
        else if (st.type !== 'mouse' && dist > 10) cleanup() // a pessoa só estava rolando a lista
        if (!st.started) return
      }
      if (dist > 4) st.moved = true
      const top = ev.clientY - st.grab
      const to = Math.max(0, Math.min(st.tops.length - 1, Math.round((top - st.tops[0]) / st.stride)))
      st.to = to
      setDrag({ id: st.id, from: st.from, to, dy: top - st.tops[st.from] })
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== st.pointerId) return
      const { started, moved, to, from, ids, type, server } = st
      cleanup()
      if (started) {
        justDragged.current = true
        window.setTimeout(() => { justDragged.current = false }, 80)
        if (to !== from) {
          const next = ids.filter((_, i) => i !== from)
          next.splice(to, 0, ids[from])
          void reorderServers(next)
        } else if (!moved && type !== 'mouse') {
          void serverMenu({ clientX: ev.clientX, clientY: ev.clientY }, server) // segurou e soltou: abre o menu
        }
      }
    }
    const cancel = (ev: PointerEvent) => { if (ev.pointerId === st.pointerId) cleanup() }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  useEffect(() => () => { document.body.classList.remove('rail-dragging') }, [])

  /** quanto cada item se afasta do lugar natural enquanto outro é arrastado */
  const shift = (i: number): number => {
    if (!drag || i === drag.from) return 0
    const stride = press.current?.stride ?? 60
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -stride
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return stride
    return 0
  }

  return (
    <nav className={`server-rail ${drag ? 'is-dragging' : ''}`} aria-label={t('Servidores')}>
      <RailItem label={t('Início')} active={activeServerId === null} onClick={goHome} badge={homeBadge}>
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="rail-home" />
      </RailItem>
      <div className="rail-sep" />
      {sorted.map((s, i) => (
        <RailItem key={s.id} sid={s.id} label={s.name} active={s.id === activeServerId}
          onClick={() => { if (!justDragged.current) setActiveServerId(s.id) }}
          muted={isMuted(s.id)}
          dragging={drag?.id === s.id}
          style={drag ? { transform: `translateY(${drag.id === s.id ? drag.dy : shift(i)}px)` } : undefined}
          onPointerDown={(e) => startPress(e, s, i)}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // no toque, segurar já é "arrastar" (e, se soltar parado, abre o menu: tratado ali em cima)
            if (lastType.current !== 'mouse' && sorted.length > 1) return
            void serverMenu(e, s)
          }}>
          {s.icon_url ? (
            <img src={s.icon_url} alt="" draggable={false} />
          ) : (
            <span className="rail-initials">{initials(s.name)}</span>
          )}
        </RailItem>
      ))}
      <RailItem label={t('Criar ou entrar em um servidor')} onClick={() => setCreating(true)} variant="add">
        <Plus size={24} />
      </RailItem>
      <RailItem label={t('Descobrir servidores')} onClick={() => setDiscovering(true)} variant="discover">
        <Compass size={24} />
      </RailItem>
      {discovering && <DiscoverModal onClose={() => setDiscovering(false)} />}
      {creating && <ServerCreateModal onClose={() => setCreating(false)} />}
      {inviting && <InviteModal server={inviting} onClose={() => setInviting(null)} />}
    </nav>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
}

function RailItem({
  label,
  active = false,
  onClick,
  children,
  variant,
  badge = 0,
  muted = false,
  onContextMenu,
  onPointerDown,
  sid,
  dragging = false,
  style,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
  variant?: 'add' | 'discover'
  badge?: number
  muted?: boolean
  onContextMenu?: (e: React.MouseEvent) => void
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void
  sid?: string
  dragging?: boolean
  style?: CSSProperties
}) {
  // o nome aparece 0,6 s depois de parar o mouse em cima (só onde existe mouse)
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const showSoon = (el: HTMLElement) => {
    window.clearTimeout(timer.current)
    if (!window.matchMedia('(hover: hover)').matches) return
    timer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect()
      setTip({ top: r.top + r.height / 2, left: r.right + 14 })
    }, 600)
  }
  const hideTip = () => {
    window.clearTimeout(timer.current)
    setTip(null)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <div className={`rail-item ${active ? 'active' : ''} ${dragging ? 'dragging' : ''}`} data-sid={sid} style={style} onPointerDown={onPointerDown}>
      <span className="rail-pill" />
      <button
        onMouseEnter={(e) => showSoon(e.currentTarget)}
        onMouseLeave={hideTip}
        onMouseDown={hideTip}
        onFocus={hideTip}
        className={`rail-btn ${variant === 'add' ? 'rail-add' : variant === 'discover' ? 'rail-discover' : ''} ${muted ? 'rail-muted' : ''}`}
        onClick={onClick}
        onContextMenu={(e) => { hideTip(); onContextMenu?.(e) }}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
      >
        {children}
      </button>
      {tip && <div className="rail-tip" role="tooltip" style={{ top: tip.top, left: tip.left }}>{label}</div>}
      {badge > 0 && <span className="rail-badge" aria-label={t('{n} novidades', { n: badge })}>{badge > 99 ? '99+' : badge}</span>}
    </div>
  )
}
