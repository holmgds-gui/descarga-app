import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Camera, Check, Hash, ImagePlus, Pencil, Shield, ShieldOff, Trash2, Volume2, X } from 'lucide-react'
import { backend } from '../lib/backend'
import type { Channel, Server, ServerRole } from '../lib/types'
import { useApp } from '../state'
import { Modal } from './Modal'
import { Avatar, displayName } from './Avatar'
import { t } from '../lib/i18n'

/** Quem é o dono ou moderador do servidor (para mostrar ou esconder as configurações). */
export function useServerRole(server: Server | undefined) {
  const { userId } = useApp()
  const [roles, setRoles] = useState<Record<string, ServerRole>>({})
  const serverId = server?.id
  useEffect(() => {
    if (!serverId) return
    let alive = true
    const load = () => void backend.listMemberRoles(serverId).then((r) => alive && setRoles(r)).catch(() => undefined)
    load()
    const off = backend.onServersChange(load)
    return () => {
      alive = false
      off()
    }
  }, [serverId])
  const isOwner = !!server && server.owner_id === userId
  const isMod = !isOwner && roles[userId] === 'mod'
  return { isOwner, isMod, canManage: isOwner || isMod, roles }
}

type Tab = 'geral' | 'canais' | 'mods'

export function ServerSettingsModal({ server, isOwner, onClose }: { server: Server; isOwner: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('geral')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'geral', label: t('Visão geral') },
    { id: 'canais', label: t('Canais') },
    ...(isOwner ? [{ id: 'mods' as Tab, label: t('Moderadores') }] : []),
  ]
  return (
    <Modal title={t('Configurações de {nome}', { nome: server.name })} onClose={onClose} wide>
      <div className="srv-tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={`srv-tab ${tab === x.id ? 'active' : ''}`} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      {tab === 'geral' && <OverviewTab server={server} onClose={onClose} />}
      {tab === 'canais' && <ChannelsTab server={server} />}
      {tab === 'mods' && isOwner && <ModsTab server={server} />}
    </Modal>
  )
}

function OverviewTab({ server, onClose }: { server: Server; onClose: () => void }) {
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
    </form>
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

function ModsTab({ server }: { server: Server }) {
  const { profiles, ensureProfiles, userId, toast } = useApp()
  const [roles, setRoles] = useState<Record<string, ServerRole>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      void backend.listMemberRoles(server.id).then((r) => {
        if (!alive) return
        setRoles(r)
        ensureProfiles(Object.keys(r))
      }).catch(() => undefined)
    load()
    const off = backend.onServersChange(load)
    return () => {
      alive = false
      off()
    }
  }, [server.id, ensureProfiles])

  const toggle = async (id: string) => {
    const next: ServerRole = roles[id] === 'mod' ? 'member' : 'mod'
    setBusy(id)
    try {
      await backend.setMemberRole(server.id, id, next)
      setRoles((r) => ({ ...r, [id]: next }))
      toast(next === 'mod' ? t('Agora é moderador') : t('Não é mais moderador'))
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const others = Object.keys(roles).filter((id) => id !== userId && id !== server.owner_id)
  return (
    <div className="srv-mods">
      <p className="muted small">{t('Moderadores podem mudar o nome, a foto, o banner e os canais do servidor. Só você escolhe quem é moderador.')}</p>
      {!others.length && <p className="muted small">{t('Ainda não há outros membros no servidor.')}</p>}
      {others.map((id) => (
        <div key={id} className="srv-channel-row">
          <Avatar profile={profiles[id]} size={28} />
          <span className="truncate flex-1">{displayName(profiles[id])}</span>
          {roles[id] === 'mod' && <span className="live-badge mod-badge">{t('Moderador')}</span>}
          <button className="btn btn-ghost btn-sm" disabled={busy === id} onClick={() => void toggle(id)}>
            {roles[id] === 'mod' ? <><ShieldOff size={16} /> {t('Remover cargo')}</> : <><Shield size={16} /> {t('Tornar moderador')}</>}
          </button>
        </div>
      ))}
    </div>
  )
}
