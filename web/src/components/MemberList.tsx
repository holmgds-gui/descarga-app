import { Crown } from 'lucide-react'
import { useApp } from '../state'
import { Avatar, displayName } from './Avatar'
import type { Profile } from '../lib/types'
import { locale, t } from '../lib/i18n'

export function MemberList({ ids, ownerId }: { ids?: string[]; ownerId?: string | null } = {}) {
  const { memberIds, profiles, servers, activeServerId, openProfile } = useApp()
  const server = servers.find((s) => s.id === activeServerId)
  const owner = ids ? ownerId : server?.owner_id
  const members = (ids ?? memberIds).map((id) => profiles[id]).filter((p): p is Profile => !!p)
  const sort = (a: Profile, b: Profile) => displayName(a).localeCompare(displayName(b), locale())
  const online = members.filter((m) => m.status !== 'invisible').sort(sort)
  const offline = members.filter((m) => m.status === 'invisible').sort(sort)

  const row = (p: Profile) => (
    <button key={p.id} className={`member ${p.status === 'invisible' ? 'offline' : ''}`}
      onClick={(e) => openProfile(p.id, e.currentTarget.getBoundingClientRect())}>
      <Avatar profile={p} size={34} showStatus />
      <span className="member-text">
        <span className="member-name truncate" style={{ color: p.status === 'invisible' ? undefined : p.accent_color }}>
          {displayName(p)}
          {owner === p.id && <Crown size={14} className="crown" aria-label={ids ? t('Dono do grupo') : t('Dono do servidor')} />}
        </span>
        {p.custom_status && <span className="member-status truncate">{p.custom_status}</span>}
      </span>
    </button>
  )

  return (
    <aside className="member-list" aria-label={t('Membros')}>
      {online.length > 0 && <h3 className="member-group">{t('Disponíveis')} — {online.length}</h3>}
      {online.map(row)}
      {offline.length > 0 && <h3 className="member-group">{t('Offline')} — {offline.length}</h3>}
      {offline.map(row)}
    </aside>
  )
}
