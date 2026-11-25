import { Ban, Crown, LogOut } from 'lucide-react'
import { nameColorOf } from '../lib/perks'
import { backend } from '../lib/backend'
import { useServerRole } from './ServerSettings'
import { useApp } from '../state'
import { Avatar, displayName, statusLine } from './Avatar'
import type { Profile } from '../lib/types'
import { locale, t } from '../lib/i18n'
import { useUserMenu } from './ContextMenu'
import { topRole } from '../lib/roles'

export function MemberList({ ids, ownerId }: { ids?: string[]; ownerId?: string | null } = {}) {
  const { memberIds, profiles, servers, activeServerId, toast, ask } = useApp()
  const userMenu = useUserMenu()
  const server = servers.find((s) => s.id === (ids ? undefined : activeServerId))
  const access = useServerRole(server)
  const owner = ids ? ownerId : server?.owner_id
  const members = (ids ?? memberIds).map((id) => profiles[id]).filter((p): p is Profile => !!p)
  const sort = (a: Profile, b: Profile) => displayName(a).localeCompare(displayName(b), locale())
  const live = members.filter((m) => m.status !== 'invisible')
  const offline = members.filter((m) => m.status === 'invisible').sort(sort)
  // grupos por cargo (só em servidores): o cargo de maior poder entre os que aparecem separados
  const hoisted = ids ? [] : access.roleDefs.filter((r) => r.hoist !== false)
  const groups = new Map<string, Profile[]>()
  const online: Profile[] = []
  for (const m of live) {
    const top = topRole(hoisted, access.members[m.id])
    if (top) groups.set(top.id, [...(groups.get(top.id) ?? []), m])
    else online.push(m)
  }
  online.sort(sort)
  // seções na ordem de poder (mais permissões primeiro; empate: o cargo mais antigo)
  const roleSections = [...hoisted]
    .map((r, i) => ({ r, i }))
    .sort((x, y) => y.r.permissions.length - x.r.permissions.length || x.i - y.i)
    .map(({ r }) => ({ role: r, list: (groups.get(r.id) ?? []).sort(sort) }))
    .filter((g) => g.list.length > 0)

  const moderate = (p: Profile) => {
    if (!server || !access.canActOn(p.id)) return []
    const name = displayName(p)
    return [
      ...(access.can('kick') ? [{ label: t('Expulsar {nome}', { nome: name }), icon: <LogOut size={16} />, danger: true, tab: t('Mais'), onClick: () => void (async () => {
        if (!(await ask({ title: t('Expulsar {nome}', { nome: name }), message: t('A pessoa sai do servidor, mas pode voltar com um convite.'), confirmLabel: t('Expulsar'), danger: true }))) return
        try { await backend.kickMember(server.id, p.id); toast(t('{nome} foi expulso(a)', { nome: name })) } catch (err) { toast((err as Error).message) }
      })() }] : []),
      ...(access.can('ban') ? [{ label: t('Banir {nome}', { nome: name }), icon: <Ban size={16} />, danger: true, tab: t('Mais'), onClick: () => void (async () => {
        if (!(await ask({ title: t('Banir {nome}', { nome: name }), message: t('A pessoa sai do servidor e não consegue voltar, nem com convite, até você desbanir.'), confirmLabel: t('Banir'), danger: true }))) return
        try { await backend.banMember(server.id, p.id, ''); toast(t('{nome} foi banido(a)', { nome: name })) } catch (err) { toast((err as Error).message) }
      })() }] : []),
    ]
  }

  const row = (p: Profile) => {
    const roleColor = ids ? undefined : topRole(access.roleDefs, access.members[p.id])?.color
    return (
    <button key={p.id} className={`member ${p.status === 'invisible' ? 'offline' : ''}`}
      onClick={(e) => userMenu(e, p, moderate(p), true)} onContextMenu={(e) => userMenu(e, p, moderate(p))}>
      <Avatar profile={p} size={34} showStatus />
      <span className="member-text">
        <span className="member-name truncate" style={{ color: (ids ? nameColorOf(p) : null) ?? roleColor ?? (p.status === 'invisible' ? undefined : p.accent_color) }}>
          {displayName(p)}
          {owner === p.id && <Crown size={14} className="crown" aria-label={ids ? t('Dono do grupo') : t('Dono do servidor')} />}
        </span>
        {statusLine(p, false) && <span className="member-status truncate">{statusLine(p, false)}</span>}
      </span>
    </button>
    )
  }

  return (
    <aside className="member-list" aria-label={t('Membros')}>
      {roleSections.map(({ role, list }) => (
        <section key={role.id}>
          <h3 className="member-group" title={role.name}>{role.name} — {list.length}</h3>
          {list.map(row)}
        </section>
      ))}
      {online.length > 0 && <h3 className="member-group">{t('Disponíveis')} — {online.length}</h3>}
      {online.map(row)}
      {offline.length > 0 && <h3 className="member-group">{t('Offline')} — {offline.length}</h3>}
      {offline.map(row)}
    </aside>
  )
}
