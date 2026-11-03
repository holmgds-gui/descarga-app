import type { MouseEvent } from 'react'
import type { Profile, Status } from '../lib/types'

export const STATUS_LABEL: Record<Status, string> = {
  online: 'Disponível',
  idle: 'Ausente',
  dnd: 'Não perturbe',
  invisible: 'Invisível',
}

export function displayName(p: Profile | null | undefined) {
  return p ? p.display_name || p.username : 'Carregando…'
}

export function StatusDot({ status, size = 12 }: { status: Status; size?: number }) {
  return <span className={`status-dot status-${status}`} style={{ width: size, height: size }} aria-label={STATUS_LABEL[status]} />
}

export function Avatar({
  profile,
  size = 40,
  showStatus = false,
  onClick,
}: {
  profile: Profile | null | undefined
  size?: number
  showStatus?: boolean
  onClick?: (e: MouseEvent<HTMLElement>) => void
}) {
  const name = displayName(profile)
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      onClick={onClick}
      aria-label={onClick ? `Ver perfil de ${name}` : undefined}
      type={onClick ? 'button' : undefined}
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" draggable={false} />
      ) : (
        <span className="avatar-fallback" style={{ background: profile?.accent_color ?? 'var(--accent)' }}>
          {initials}
        </span>
      )}
      {showStatus && profile && (
        <StatusDot status={profile.status} size={Math.max(10, Math.round(size * 0.32))} />
      )}
    </Tag>
  )
}
