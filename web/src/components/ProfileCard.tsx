import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Cake, Check, Clock, ExternalLink, MapPin, MessageCircle, Pencil, UserPlus } from 'lucide-react'
import { backend } from '../lib/backend'
import { friendState } from './dm'
import { formatBirthday, formatLongDate } from '../lib/format'
import type { Friendship, Profile } from '../lib/types'
import { useApp } from '../state'
import { Avatar, displayName, fullHandle, statusLine } from './Avatar'
import { t } from '../lib/i18n'
import { activePerks, nameColorOf, plusLevel, visibleBanner } from '../lib/perks'
import { PlusMark } from './PlusMark'

/** O cartão de perfil em si — usado no popover e na pré-visualização das configurações. */
export function ProfileCardBody({ profile, onEdit, actions, friendSince }: { profile: Profile; onEdit?: () => void; actions?: ReactNode; friendSince?: string | null }) {
  const accent = profile.accent_color
  // sem Plus o banner volta a ser só a cor (a imagem fica guardada)
  const banner = visibleBanner(profile)
  // o símbolo do plano aparece só no cartão e no painel; administrador não ganha símbolo sem Plus
  const badge = plusLevel({ plus_level: profile.plus_level ?? 0, plus_until: profile.plus_until ?? null })
  // o identificador para adicionar amigo (nick#0000) aparece sempre abaixo do nome
  const handle = fullHandle(profile)
  return (
    <div className="profile-card" data-skin={activePerks(profile).skin ?? undefined} style={{ ['--card-accent' as string]: accent }}>
      <div className="profile-banner" style={{ background: banner ? undefined : accent }}>
        {banner && <img src={banner} alt="" />}
      </div>
      <div className="profile-avatar-row">
        <div className="profile-avatar-ring">
          <Avatar profile={profile} size={84} showStatus />
        </div>
        {onEdit && (
          <button className="btn btn-sm btn-ghost profile-edit" onClick={onEdit}>
            <Pencil size={14} /> {t('Editar perfil')}
          </button>
        )}
      </div>
      <div className="profile-inner">
        <h2 className="profile-name" style={nameColorOf(profile) ? { color: nameColorOf(profile)! } : undefined}>
          {displayName(profile)}
          {badge > 0 && <PlusMark level={badge as 1 | 2 | 3} size={36} />}
        </h2>
        {(handle || profile.pronouns) && (
          <p className="profile-handle">
            {handle}
            {profile.pronouns && <span>{handle ? ' • ' : ''}{profile.pronouns}</span>}
          </p>
        )}
        <p className="profile-status-line">
          {statusLine(profile)}
        </p>
        {actions}

        {profile.bio && (
          <section>
            <h3>{t('Sobre mim')}</h3>
            <p className="profile-bio">{profile.bio}</p>
          </section>
        )}

        {(profile.birthday || profile.city) && (
          <section className="profile-facts">
            {profile.birthday && <span><Cake size={15} /> {formatBirthday(profile.birthday)}</span>}
            {profile.city && <span><MapPin size={15} /> {profile.city}</span>}
          </section>
        )}

        {profile.links.length > 0 && (
          <section>
            <h3>{t('Links')}</h3>
            <div className="profile-links">
              {profile.links.map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer nofollow">
                  <ExternalLink size={14} /> {l.label || l.url.replace(/^https?:\/\//, '')}
                </a>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3>{t('Dando descarga desde')}</h3>
          <p className="small">{formatLongDate(profile.created_at)}</p>
        </section>
        {friendSince && (
          <section>
            <h3>{t('Amigos desde')}</h3>
            <p className="small">{formatLongDate(friendSince)}</p>
          </section>
        )}
      </div>
    </div>
  )
}

export function ProfilePopover() {
  const { profileView, profiles, closeProfile, ensureProfiles, userId, setSettingsOpen, friendships } = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const profile = profileView ? profiles[profileView.userId] : null

  useEffect(() => {
    if (profileView) ensureProfiles([profileView.userId])
  }, [profileView, ensureProfiles])

  useEffect(() => {
    if (!profileView) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && closeProfile()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeProfile()
    const t = setTimeout(() => document.addEventListener('mousedown', onDown))
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [profileView, closeProfile])

  useLayoutEffect(() => {
    const el = ref.current
    const a = profileView?.anchor
    if (!el || !a || window.innerWidth < 768) {
      setPos(null)
      return
    }
    const w = el.offsetWidth
    const h = el.offsetHeight
    let left = a.right + 12
    if (left + w > window.innerWidth - 12) left = a.left - w - 12
    const top = Math.min(Math.max(12, a.top - 40), window.innerHeight - h - 12)
    setPos({ top, left: Math.max(12, left) })
  }, [profileView, profile])

  if (!profileView || !profile) return null
  const mobile = window.innerWidth < 768 || !profileView.anchor

  return (
    <div className={mobile ? 'sheet-backdrop' : 'popover-layer'}>
      <div ref={ref} className={mobile ? 'sheet' : 'popover'} style={pos ? { top: pos.top, left: pos.left } : undefined}>
        <ProfileCardBody
          profile={profile}
          onEdit={profile.id === userId ? () => { closeProfile(); setSettingsOpen(true) } : undefined}
          actions={profile.id !== userId ? <ProfileActions profile={profile} /> : undefined}
          friendSince={friendSinceOf(friendships, userId, profile.id)}
        />
      </div>
    </div>
  )
}

/** Botões do cartão de outra pessoa: mandar mensagem e amizade. */
function ProfileActions({ profile }: { profile: Profile }) {
  const { friendships, userId, openDmWith, closeProfile, toast, refreshFriends } = useApp()
  const [busy, setBusy] = useState(false)
  const state = friendState(friendships, userId, profile.id)
  const run = async (fn: () => Promise<void>, msg?: string) => {
    setBusy(true)
    try {
      await fn()
      await refreshFriends()
      if (msg) toast(msg)
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="profile-actions">
      <button className="btn btn-primary btn-sm" disabled={busy}
        onClick={() => void openDmWith([profile.id]).then(closeProfile).catch((err) => toast((err as Error).message))}>
        <MessageCircle size={16} /> {t('Enviar mensagem')}
      </button>
      {state.kind === 'none' && (
        <button className="btn btn-ghost btn-sm" disabled={busy}
          onClick={() => void run(() => backend.sendFriendRequest(profile.username), t('Pedido de amizade enviado'))}>
          <UserPlus size={16} /> {t('Adicionar amigo')}
        </button>
      )}
      {state.kind === 'incoming' && (
        <button className="btn btn-success btn-sm" disabled={busy}
          onClick={() => void run(() => backend.acceptFriend(state.id), t('Agora vocês são amigos!'))}>
          <Check size={16} /> {t('Aceitar pedido')}
        </button>
      )}
      {state.kind === 'outgoing' && (
        <span className="profile-chip"><Clock size={14} /> {t('Pedido enviado')}</span>
      )}
      {state.kind === 'friends' && (
        <span className="profile-chip ok"><Check size={14} /> {t('Amigos')}</span>
      )}
    </div>
  )
}

/** desde quando somos amigos (null se não somos) */
export function friendSinceOf(friendships: Friendship[], me: string, other: string): string | null {
  const f = friendships.find((x) => x.status === 'accepted' && ((x.requester === me && x.addressee === other) || (x.addressee === me && x.requester === other)))
  return f?.created_at ?? null
}

/** Painel de perfil que fica ao lado de uma conversa 1 a 1 (como no app de conversa que todo mundo conhece): dá para esconder pela setinha. */
export function DmProfilePanel({ otherId }: { otherId: string }) {
  const { profiles, ensureProfiles, friendships, userId } = useApp()
  useEffect(() => { ensureProfiles([otherId]) }, [otherId, ensureProfiles])
  const profile = profiles[otherId]
  if (!profile) return <div className="loading-dots"><span /><span /><span /></div>
  return (
    <div className="dm-profile-panel">
      <ProfileCardBody profile={profile} friendSince={friendSinceOf(friendships, userId, otherId)} />
    </div>
  )
}
