import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Cake, ExternalLink, MapPin, Pencil } from 'lucide-react'
import { formatBirthday, formatLongDate } from '../lib/format'
import type { Profile } from '../lib/types'
import { useApp } from '../state'
import { Avatar, STATUS_LABEL, displayName } from './Avatar'

/** O cartão de perfil em si — usado no popover e na pré-visualização das configurações. */
export function ProfileCardBody({ profile, onEdit }: { profile: Profile; onEdit?: () => void }) {
  const accent = profile.accent_color
  return (
    <div className="profile-card" style={{ ['--card-accent' as string]: accent }}>
      <div className="profile-banner" style={{ background: profile.banner_url ? undefined : accent }}>
        {profile.banner_url && <img src={profile.banner_url} alt="" />}
      </div>
      <div className="profile-avatar-row">
        <div className="profile-avatar-ring">
          <Avatar profile={profile} size={84} showStatus />
        </div>
        {onEdit && (
          <button className="btn btn-sm btn-ghost profile-edit" onClick={onEdit}>
            <Pencil size={14} /> Editar perfil
          </button>
        )}
      </div>
      <div className="profile-inner">
        <h2 className="profile-name">{displayName(profile)}</h2>
        <p className="profile-handle">
          {profile.username}
          {profile.pronouns && <span> • {profile.pronouns}</span>}
        </p>
        <p className="profile-status-line">
          {profile.custom_status || STATUS_LABEL[profile.status]}
        </p>

        {profile.bio && (
          <section>
            <h3>Sobre mim</h3>
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
            <h3>Links</h3>
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
          <h3>Membro do Descarga desde</h3>
          <p className="small">{formatLongDate(profile.created_at)}</p>
        </section>
      </div>
    </div>
  )
}

export function ProfilePopover() {
  const { profileView, profiles, closeProfile, ensureProfiles, userId, setSettingsOpen } = useApp()
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
        />
      </div>
    </div>
  )
}
