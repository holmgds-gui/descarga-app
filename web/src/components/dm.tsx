import { Users } from 'lucide-react'
import type { DmChannel, Friendship, Profile } from '../lib/types'
import { Avatar, displayName } from './Avatar'
import { t } from '../lib/i18n'

export const otherIds = (dm: DmChannel, me: string) => dm.member_ids.filter((id) => id !== me)

/** Nome da conversa: o nome da pessoa (1:1) ou o título/lista de nomes (grupo). */
export function dmName(dm: DmChannel, profiles: Record<string, Profile>, me: string) {
  const others = otherIds(dm, me)
  if (!dm.is_group) return others[0] ? displayName(profiles[others[0]]) : t('Conversa')
  if (dm.title) return dm.title
  const names = others.map((id) => displayName(profiles[id]))
  if (!names.length) return t('Grupo vazio')
  return names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '')
}

const GROUP_COLORS = ['#7B3FE4', '#E0457B', '#2DBE7A', '#1FB5E0', '#F0643C', '#F5A524', '#3D7BF0']

export function DmAvatar({ dm, profiles, me, size = 32, showStatus = false }: {
  dm: DmChannel
  profiles: Record<string, Profile>
  me: string
  size?: number
  showStatus?: boolean
}) {
  if (!dm.is_group) return <Avatar profile={profiles[otherIds(dm, me)[0]]} size={size} showStatus={showStatus} />
  let h = 0
  for (const c of dm.id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (
    <span className="group-avatar" style={{ width: size, height: size, background: GROUP_COLORS[h % GROUP_COLORS.length] }}>
      <Users size={Math.round(size * 0.55)} />
    </span>
  )
}

export type FriendState =
  | { kind: 'none' }
  | { kind: 'friends' | 'incoming' | 'outgoing'; id: string }

export function friendState(friendships: Friendship[], me: string, other: string): FriendState {
  const f = friendships.find((x) => (x.requester === me && x.addressee === other) || (x.addressee === me && x.requester === other))
  if (!f) return { kind: 'none' }
  if (f.status === 'accepted') return { kind: 'friends', id: f.id }
  return { kind: f.requester === me ? 'outgoing' : 'incoming', id: f.id }
}
