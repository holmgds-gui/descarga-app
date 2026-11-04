import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../state'
import { ServerCreateModal } from './ServerModals'
import { t } from '../lib/i18n'

export function ServerRail() {
  const { servers, activeServerId, setActiveServerId, unreadDms, friendships, userId } = useApp()
  const homeBadge = unreadDms.size + friendships.filter((f) => f.status === 'pending' && f.addressee === userId).length
  const [creating, setCreating] = useState(false)

  return (
    <nav className="server-rail" aria-label={t('Servidores')}>
      <RailItem label={t('Início')} active={activeServerId === null} onClick={() => setActiveServerId(null)} badge={homeBadge}>
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="rail-home" />
      </RailItem>
      <div className="rail-sep" />
      {servers.map((s) => (
        <RailItem key={s.id} label={s.name} active={s.id === activeServerId} onClick={() => setActiveServerId(s.id)}>
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
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
  variant?: 'add'
  badge?: number
}) {
  return (
    <div className={`rail-item ${active ? 'active' : ''}`}>
      <span className="rail-pill" />
      <button
        className={`rail-btn ${variant === 'add' ? 'rail-add' : ''}`}
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        data-tip={label}
      >
        {children}
      </button>
      {badge > 0 && <span className="rail-badge" aria-label={t('{n} novidades', { n: badge })}>{badge > 99 ? '99+' : badge}</span>}
    </div>
  )
}
