import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../state'
import { ServerCreateModal } from './ServerModals'

export function ServerRail() {
  const { servers, activeServerId, setActiveServerId } = useApp()
  const [creating, setCreating] = useState(false)

  return (
    <nav className="server-rail" aria-label="Servidores">
      <RailItem label="Início" active={activeServerId === null} onClick={() => setActiveServerId(null)}>
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
      <RailItem label="Criar ou entrar em um servidor" onClick={() => setCreating(true)} variant="add">
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
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
  variant?: 'add'
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
    </div>
  )
}
