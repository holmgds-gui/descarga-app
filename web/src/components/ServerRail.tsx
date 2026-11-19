import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { Bell, BellOff, Cog, Fingerprint, LogOut, Plus, UserPlus } from 'lucide-react'
import { backend } from '../lib/backend'
import type { Server, ServerPrefs } from '../lib/types'
import { useApp } from '../state'
import { InviteModal, ServerCreateModal } from './ServerModals'
import { t } from '../lib/i18n'
import { copyText, showContextMenu } from './ContextMenu'

export function ServerRail() {
  const { servers, activeServerId, setActiveServerId, goHome, unreadDms, friendships, userId, toast, ask, refreshServers, serverPrefs, setServerPrefs } = useApp()
  const homeBadge = unreadDms.size + friendships.filter((f) => f.status === 'pending' && f.addressee === userId).length
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState<Server | null>(null)

  const isMuted = (id: string) => {
    const p = serverPrefs[id]
    return !!p && (p.level === 'none' || (!!p.muted_until && new Date(p.muted_until).getTime() > Date.now()))
  }

  /** menu do botão direito no servidor (as permissões dessa pessoa naquele servidor são buscadas na hora) */
  const serverMenu = async (e: ReactMouseEvent, s: Server) => {
    e.preventDefault()
    e.stopPropagation()
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

  return (
    <nav className="server-rail" aria-label={t('Servidores')}>
      <RailItem label={t('Início')} active={activeServerId === null} onClick={goHome} badge={homeBadge}>
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="rail-home" />
      </RailItem>
      <div className="rail-sep" />
      {servers.map((s) => (
        <RailItem key={s.id} label={s.name} active={s.id === activeServerId} onClick={() => setActiveServerId(s.id)}
          muted={isMuted(s.id)}
          onContextMenu={(e) => void serverMenu(e, s)}>
          {s.icon_url ? (
            <img src={s.icon_url} alt="" />
          ) : (
            <span className="rail-initials">{initials(s.name)}</span>
          )}
        </RailItem>
      ))}
      <RailItem label={t('Criar ou entrar em um servidor')} onClick={() => setCreating(true)} variant="add">
        <Plus size={24} />
      </RailItem>
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
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
  variant?: 'add'
  badge?: number
  muted?: boolean
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  // o nome aparece 0,6 s depois de parar o mouse em cima (só onde existe mouse)
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null)
  const timer = useRef<number>()
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
    <div className={`rail-item ${active ? 'active' : ''}`}>
      <span className="rail-pill" />
      <button
        onMouseEnter={(e) => showSoon(e.currentTarget)}
        onMouseLeave={hideTip}
        onMouseDown={hideTip}
        onFocus={hideTip}
        className={`rail-btn ${variant === 'add' ? 'rail-add' : ''} ${muted ? 'rail-muted' : ''}`}
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
