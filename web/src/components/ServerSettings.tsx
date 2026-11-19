import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Ban as BanIcon, Camera, Check, Hash, ImagePlus, LogOut, Pencil, Plus, Trash2, Undo2, Volume2, X } from 'lucide-react'
import { backend } from '../lib/backend'
import { PERMISSIONS, type Ban, type Channel, type Permission, type RoleDef, type Server } from '../lib/types'
import { useApp } from '../state'
import { Modal } from './Modal'
import { Avatar, displayName } from './Avatar'
import { t } from '../lib/i18n'

export const PERMISSION_LABELS: Record<Permission, { name: string; hint: string }> = {
  manage_server: { name: 'Gerenciar servidor', hint: 'Mudar nome, foto, banner e descrição.' },
  manage_channels: { name: 'Gerenciar canais', hint: 'Criar, renomear, reorganizar e apagar canais.' },
  pin_messages: { name: 'Fixar mensagens', hint: 'Fixar e desafixar mensagens nos canais.' },
  kick: { name: 'Expulsar membros', hint: 'Tirar alguém do servidor (a pessoa pode voltar com um convite).' },
  ban: { name: 'Banir membros', hint: 'Tirar alguém e impedir que volte. Também desbanir.' },
}

/** O que a pessoa pode fazer no servidor: o dono pode tudo; os outros, o que o cargo deles permite. */
export function useServerRole(server: Server | undefined) {
  const { userId } = useApp()
  const [members, setMembers] = useState<Record<string, string | null>>({})
  const [roleDefs, setRoleDefs] = useState<RoleDef[]>([])
  const serverId = server?.id
  useEffect(() => {
    if (!serverId) return
    let alive = true
    const load = () => {
      void backend.listMemberRoles(serverId).then((r) => alive && setMembers(r)).catch(() => undefined)
      void backend.listRoles(serverId).then((r) => alive && setRoleDefs(r)).catch(() => undefined)
    }
    load()
    const off = backend.onServersChange(load)
    return () => {
      alive = false
      off()
    }
  }, [serverId])
  const isOwner = !!server && server.owner_id === userId
  const roleOf = (uid: string) => roleDefs.find((r) => r.id === members[uid])
  const myRole = roleOf(userId)
  const can = (perm: Permission) => isOwner || !!myRole?.permissions.includes(perm)
  const canManage = isOwner || (myRole?.permissions.length ?? 0) > 0
  /** dá para expulsar/banir essa pessoa? (nunca o dono nem você; só o dono age sobre quem tem poderes) */
  const canActOn = (uid: string) =>
    !!server && uid !== userId && uid !== server.owner_id && (isOwner || (roleOf(uid)?.permissions.length ?? 0) === 0)
  return { isOwner, can, canManage, canActOn, members, roleDefs, roleOf }
}
export type ServerAccess = ReturnType<typeof useServerRole>

type Tab = 'geral' | 'canais' | 'membros' | 'cargos'

export function ServerSettingsModal({ server, access, onClose }: { server: Server; access: ServerAccess; onClose: () => void }) {
  const tabs: { id: Tab; label: string }[] = [
    ...(access.can('manage_server') ? [{ id: 'geral' as Tab, label: t('Visão geral') }] : []),
    ...(access.can('manage_channels') ? [{ id: 'canais' as Tab, label: t('Canais') }] : []),
    ...(access.can('kick') || access.can('ban') || access.isOwner ? [{ id: 'membros' as Tab, label: t('Membros') }] : []),
    ...(access.isOwner ? [{ id: 'cargos' as Tab, label: t('Cargos') }] : []),
  ]
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? 'geral')
  return (
    <Modal title={t('Configurações de {nome}', { nome: server.name })} onClose={onClose} wide>
      <div className="srv-tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={`srv-tab ${tab === x.id ? 'active' : ''}`} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      {tab === 'geral' && <OverviewTab server={server} isOwner={access.isOwner} onClose={onClose} />}
      {tab === 'canais' && <ChannelsTab server={server} />}
      {tab === 'membros' && <MembersTab server={server} access={access} />}
      {tab === 'cargos' && access.isOwner && <RolesTab server={server} access={access} />}
    </Modal>
  )
}

function OverviewTab({ server, isOwner, onClose }: { server: Server; isOwner: boolean; onClose: () => void }) {
  const { refreshServers, toast } = useApp()
  const [name, setName] = useState(server.name)
  const [description, setDescription] = useState(server.description ?? '')
  const [icon, setIcon] = useState<string | null>(server.icon_url)
  const [banner, setBanner] = useState<string | null>(server.banner_url)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const iconRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  const pick = async (f: File | undefined, kind: 'server' | 'banner') => {
    if (!f) return
    setError(null)
    try {
      const url = await backend.uploadImage(f, kind)
      if (kind === 'server') setIcon(url)
      else setBanner(url)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const changed =
    name.trim() !== server.name || description !== (server.description ?? '') || icon !== server.icon_url || banner !== server.banner_url

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await backend.updateServer(server.id, { name: name.trim(), description: description.trim(), icon_url: icon, banner_url: banner })
      await refreshServers()
      toast(t('Servidor atualizado'))
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form srv-overview" onSubmit={save}>
      <div className="srv-banner" style={banner ? { backgroundImage: `url(${banner})` } : undefined}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => bannerRef.current?.click()}>
          <ImagePlus size={16} /> {banner ? t('Trocar banner') : t('Adicionar banner')}
        </button>
        {banner && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBanner(null)}>
            <X size={16} /> {t('Remover banner')}
          </button>
        )}
        <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0], 'banner'); e.target.value = '' }} />
      </div>
      <div className="srv-icon-row">
        <button type="button" className="icon-upload" onClick={() => iconRef.current?.click()} aria-label={t('Escolher ícone')}>
          {icon ? <img src={icon} alt="" /> : <><Camera size={22} /><span>{t('Ícone')}</span></>}
        </button>
        <input ref={iconRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0], 'server'); e.target.value = '' }} />
        {icon && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIcon(null)}>{t('Remover ícone')}</button>
        )}
      </div>
      <label>
        {t('Nome do servidor')}
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
      </label>
      <label>
        {t('Descrição')}
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} placeholder={t('Sobre o que é este servidor?')} />
        <span className="muted small">{description.length}/300</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-end">
        <button type="button" className="btn btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
        <button className="btn btn-primary" disabled={busy || !changed || !name.trim()}>{t('Salvar alterações')}</button>
      </div>
      {isOwner && <DeleteServerBox server={server} onDone={onClose} />}
    </form>
  )
}

/** Apagar o servidor: só o dono, e só depois de digitar o nome. */
function DeleteServerBox({ server, onDone }: { server: Server; onDone: () => void }) {
  const { refreshServers, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await backend.deleteServer(server.id)
      await refreshServers()
      toast(t('Servidor apagado'))
      onDone()
    } catch (err) {
      toast((err as Error).message)
      setBusy(false)
    }
  }
  return (
    <div className="srv-danger">
      <h3 className="field-label">{t('Zona de perigo')}</h3>
      {!open ? (
        <button type="button" className="btn btn-ghost danger-text" onClick={() => setOpen(true)}><Trash2 size={16} /> {t('Apagar servidor')}</button>
      ) : (
        <div className="stack">
          <p className="small">{t('Isso apaga o servidor, todos os canais e todas as mensagens para todo mundo. Não dá para desfazer. Digite o nome do servidor para confirmar:')} <strong>{server.name}</strong></p>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={t('Nome do servidor')} placeholder={server.name} />
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); setTyped('') }}>{t('Cancelar')}</button>
            <button type="button" className="btn btn-danger" disabled={busy || typed.trim() !== server.name} onClick={() => void run()}>{t('Apagar para sempre')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelsTab({ server }: { server: Server }) {
  const { channels, activeChannelId, toast, ask } = useApp()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  // categorias na ordem em que aparecem; canais ordenados por posição dentro de cada uma
  const groups = useMemo(() => {
    const map = new Map<string, Channel[]>()
    for (const c of channels) {
      if (!map.has(c.category)) map.set(c.category, [])
      map.get(c.category)!.push(c)
    }
    return [...map.entries()]
  }, [channels])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const move = (category: string, index: number, delta: -1 | 1) => {
    const next = groups.map(([cat, list]) => {
      const copy = [...list]
      if (cat === category) {
        const to = index + delta
        if (to < 0 || to >= copy.length) return copy
        ;[copy[index], copy[to]] = [copy[to], copy[index]]
      }
      return copy
    })
    void run(() => backend.reorderChannels(server.id, next.flat().map((c) => c.id)))
  }

  const startEdit = (c: Channel) => {
    setEditing(c.id)
    setDraft(c.name)
  }

  const saveName = (c: Channel) => {
    const clean = c.type === 'text' ? draft.trim().toLowerCase().replace(/\s+/g, '-') : draft.trim()
    setEditing(null)
    if (!clean || clean === c.name) return
    void run(() => backend.renameChannel(c.id, clean))
  }

  const remove = async (c: Channel) => {
    const ok = await ask({
      title: t('Apagar canal'),
      message: t('Apagar {nome}? As mensagens dele serão apagadas e isso não dá para desfazer.', { nome: c.name }),
      confirmLabel: t('Apagar'),
      danger: true,
    })
    if (!ok) return
    void run(async () => {
      await backend.deleteChannel(c.id)
      toast(t('Canal apagado'))
    })
  }

  if (!channels.length) return <p className="muted small">{t('Este servidor ainda não tem canais.')}</p>

  return (
    <div className="srv-channels">
      {groups.map(([category, list]) => (
        <section key={category}>
          <h3 className="field-label">{t(category)}</h3>
          {list.map((c, i) => (
            <div key={c.id} className="srv-channel-row">
              {c.type === 'text' ? <Hash size={18} /> : <Volume2 size={18} />}
              {editing === c.id ? (
                <form className="srv-rename" onSubmit={(e) => { e.preventDefault(); saveName(c) }}>
                  <input autoFocus value={draft} maxLength={60} onChange={(e) => setDraft(e.target.value)} aria-label={t('Nome do canal')} />
                  <button className="icon-btn tiny" aria-label={t('Salvar nome')}><Check size={16} /></button>
                  <button type="button" className="icon-btn tiny" aria-label={t('Cancelar')} onClick={() => setEditing(null)}><X size={16} /></button>
                </form>
              ) : (
                <span className="truncate flex-1">{c.name}</span>
              )}
              {editing !== c.id && (
                <span className="srv-channel-actions">
                  <button className="icon-btn tiny" aria-label={t('Subir {nome}', { nome: c.name })} disabled={busy || i === 0} onClick={() => move(category, i, -1)}><ArrowUp size={16} /></button>
                  <button className="icon-btn tiny" aria-label={t('Descer {nome}', { nome: c.name })} disabled={busy || i === list.length - 1} onClick={() => move(category, i, 1)}><ArrowDown size={16} /></button>
                  <button className="icon-btn tiny" aria-label={t('Renomear {nome}', { nome: c.name })} disabled={busy} onClick={() => startEdit(c)}><Pencil size={16} /></button>
                  <button className="icon-btn tiny danger" aria-label={t('Apagar {nome}', { nome: c.name })} disabled={busy || (channels.length <= 1 && c.id === activeChannelId)} onClick={() => void remove(c)}><Trash2 size={16} /></button>
                </span>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

function MembersTab({ server, access }: { server: Server; access: ServerAccess }) {
  const { profiles, ensureProfiles, userId, toast, ask } = useApp()
  const [bans, setBans] = useState<Ban[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const ids = Object.keys(access.members).filter((id) => id !== userId)

  useEffect(() => {
    ensureProfiles(Object.keys(access.members))
  }, [access.members, ensureProfiles])

  const canBan = access.can('ban')
  useEffect(() => {
    if (!canBan) return
    let alive = true
    const load = () => void backend.listBans(server.id).then((b) => alive && setBans(b)).catch(() => undefined)
    load()
    const off = backend.onServersChange(load)
    return () => {
      alive = false
      off()
    }
  }, [server.id, canBan])

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id)
    try {
      await fn()
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const kick = async (id: string) => {
    const name = displayName(profiles[id])
    const ok = await ask({ title: t('Expulsar {nome}', { nome: name }), message: t('A pessoa sai do servidor, mas pode voltar com um convite.'), confirmLabel: t('Expulsar'), danger: true })
    if (ok) await run(id, async () => { await backend.kickMember(server.id, id); toast(t('{nome} foi expulso(a)', { nome: name })) })
  }

  const ban = async (id: string) => {
    const name = displayName(profiles[id])
    const ok = await ask({ title: t('Banir {nome}', { nome: name }), message: t('A pessoa sai do servidor e não consegue voltar, nem com convite, até você desbanir.'), confirmLabel: t('Banir'), danger: true })
    if (ok) await run(id, async () => { await backend.banMember(server.id, id, ''); toast(t('{nome} foi banido(a)', { nome: name })) })
  }

  return (
    <div className="srv-mods">
      {!ids.length && <p className="muted small">{t('Ainda não há outros membros no servidor.')}</p>}
      {ids.map((id) => {
        const role = access.roleOf(id)
        const acts = access.canActOn(id)
        return (
          <div key={id} className="srv-channel-row">
            <Avatar profile={profiles[id]} size={28} />
            <span className="truncate flex-1">{displayName(profiles[id])}</span>
            {access.isOwner ? (
              <select className="srv-role-select" aria-label={t('Cargo de {nome}', { nome: displayName(profiles[id]) })} value={access.members[id] ?? ''} disabled={busy === id}
                onChange={(e) => void run(id, () => backend.setMemberRole(server.id, id, e.target.value || null))}>
                <option value="">{t('Sem cargo')}</option>
                {access.roleDefs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            ) : role && <span className="role-chip" style={{ borderColor: role.color, color: role.color }}>{role.name}</span>}
            {acts && access.can('kick') && (
              <button className="btn btn-ghost btn-sm" disabled={busy === id} onClick={() => void kick(id)}><LogOut size={16} /> {t('Expulsar')}</button>
            )}
            {acts && access.can('ban') && (
              <button className="btn btn-ghost btn-sm danger-text" disabled={busy === id} onClick={() => void ban(id)}><BanIcon size={16} /> {t('Banir')}</button>
            )}
          </div>
        )
      })}
      {access.can('ban') && (
        <section className="srv-bans">
          <h3 className="field-label">{t('Banidos')} — {bans.length}</h3>
          {!bans.length && <p className="muted small">{t('Ninguém foi banido.')}</p>}
          {bans.map((b) => (
            <div key={b.user_id} className="srv-channel-row">
              <span className="truncate flex-1">{b.display_name || b.username || b.user_id}{b.username && <span className="muted small"> @{b.username}</span>}</span>
              <button className="btn btn-ghost btn-sm" disabled={busy === b.user_id} onClick={() => void run(b.user_id, async () => { await backend.unbanMember(server.id, b.user_id); setBans((x) => x.filter((y) => y.user_id !== b.user_id)); toast(t('Desbanido(a)')) })}>
                <Undo2 size={16} /> {t('Desbanir')}
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function RolesTab({ server, access }: { server: Server; access: ServerAccess }) {
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="srv-roles">
      <p className="muted small">{t('Cargos dão permissões a quem você escolher na aba Membros. Só você cria cargos e escolhe quem tem cada um.')}</p>
      {access.roleDefs.map((r) => <RoleCard key={r.id} role={r} busy={busy} run={run} />)}
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(async () => {
        await backend.createRole(server.id, { name: t('Novo cargo'), color: '#7B3FE4', permissions: [] })
        toast(t('Cargo criado'))
      })}><Plus size={16} /> {t('Criar cargo')}</button>
    </div>
  )
}

function RoleCard({ role, busy, run }: { role: RoleDef; busy: boolean; run: (fn: () => Promise<void>) => Promise<void> }) {
  const { toast, ask } = useApp()
  const [name, setName] = useState(role.name)
  const [color, setColor] = useState(role.color)
  const [perms, setPerms] = useState<Permission[]>(role.permissions)
  const changed = name.trim() !== role.name || color !== role.color || perms.join() !== role.permissions.join()
  const toggle = (p: Permission) => setPerms((cur) => PERMISSIONS.filter((x) => (x === p ? !cur.includes(x) : cur.includes(x))))
  return (
    <div className="role-card">
      <div className="role-card-head">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t('Cor do cargo')} />
        <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label={t('Nome do cargo')} />
        <button className="icon-btn tiny danger" aria-label={t('Apagar cargo {nome}', { nome: role.name })} disabled={busy} onClick={() => void (async () => {
          const ok = await ask({ title: t('Apagar cargo'), message: t('Quem tem o cargo {nome} fica sem cargo.', { nome: role.name }), confirmLabel: t('Apagar'), danger: true })
          if (ok) await run(async () => { await backend.deleteRole(role.id); toast(t('Cargo apagado')) })
        })()}><Trash2 size={16} /></button>
      </div>
      <div className="role-perms">
        {PERMISSIONS.map((p) => (
          <label key={p} className="check-row">
            <input type="checkbox" checked={perms.includes(p)} onChange={() => toggle(p)} />
            <span><strong>{t(PERMISSION_LABELS[p].name)}</strong><br /><span className="muted small">{t(PERMISSION_LABELS[p].hint)}</span></span>
          </label>
        ))}
      </div>
      {changed && (
        <div className="row-end">
          <button className="btn btn-ghost btn-sm" onClick={() => { setName(role.name); setColor(role.color); setPerms(role.permissions) }}>{t('Desfazer')}</button>
          <button className="btn btn-primary btn-sm" disabled={busy || !name.trim()} onClick={() => void run(async () => {
            await backend.updateRole(role.id, { name: name.trim(), color, permissions: perms })
            toast(t('Cargo salvo'))
          })}><Check size={16} /> {t('Salvar')}</button>
        </div>
      )}
    </div>
  )
}
