import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown, ChevronRight, Hash, Headphones, LogOut, Mic, Plus, Settings, UserPlus, Volume2, X,
} from 'lucide-react'
import { backend } from '../lib/backend'
import type { Channel, Status } from '../lib/types'
import { useApp } from '../state'
import { Avatar, STATUS_LABEL, StatusDot, displayName } from './Avatar'
import { CreateChannelModal, InviteModal } from './ServerModals'

export function ChannelSidebar() {
  const { servers, activeServerId, channels, activeChannelId, setActiveChannelId, userId, toast, refreshServers, ask } = useApp()
  const server = servers.find((s) => s.id === activeServerId)
  const [menuOpen, setMenuOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [creating, setCreating] = useState<{ category: string; type: Channel['type'] } | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const isOwner = server?.owner_id === userId

  const groups = useMemo(() => {
    const map = new Map<string, Channel[]>()
    for (const c of channels) {
      if (!map.has(c.category)) map.set(c.category, [])
      map.get(c.category)!.push(c)
    }
    return [...map.entries()]
  }, [channels])

  const leave = async () => {
    if (!server) return
    const ok = await ask({ title: `Sair de ${server.name}`, message: 'Você vai precisar de um novo convite para voltar.', confirmLabel: 'Sair do servidor', danger: true })
    if (!ok) return
    await backend.leaveServer(server.id)
    await refreshServers()
    toast('Você saiu do servidor')
  }

  return (
    <aside className="channel-sidebar">
      {server ? (
        <>
          <div className="sidebar-header-wrap">
            <button className="sidebar-header" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
              <span className="truncate">{server.name}</span>
              {menuOpen ? <X size={18} /> : <ChevronDown size={18} />}
            </button>
            {menuOpen && (
              <div className="dropdown" onMouseLeave={() => setMenuOpen(false)}>
                <button className="dropdown-item accent" onClick={() => { setInviting(true); setMenuOpen(false) }}>
                  Convidar pessoas <UserPlus size={16} />
                </button>
                {isOwner && (
                  <button className="dropdown-item" onClick={() => { setCreating({ category: 'Canais de texto', type: 'text' }); setMenuOpen(false) }}>
                    Criar canal <Plus size={16} />
                  </button>
                )}
                {!isOwner && (
                  <button className="dropdown-item danger" onClick={() => { setMenuOpen(false); void leave() }}>
                    Sair do servidor <LogOut size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="channel-list">
            {groups.map(([category, list]) => (
              <div key={category} className="channel-group">
                <div className="category">
                  <button className="category-toggle" onClick={() => setCollapsed((c) => ({ ...c, [category]: !c[category] }))}>
                    {collapsed[category] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <span>{category}</span>
                  </button>
                  {isOwner && (
                    <button className="icon-btn tiny" aria-label={`Criar canal em ${category}`} data-tip="Criar canal"
                      onClick={() => setCreating({ category, type: list[0]?.type ?? 'text' })}>
                      <Plus size={16} />
                    </button>
                  )}
                </div>
                {list
                  .filter((c) => !collapsed[category] || c.id === activeChannelId)
                  .map((c) => (
                    <button
                      key={c.id}
                      className={`channel-item ${c.id === activeChannelId ? 'active' : ''}`}
                      onClick={() => setActiveChannelId(c.id)}
                    >
                      {c.type === 'text' ? <Hash size={20} /> : <Volume2 size={20} />}
                      <span className="truncate">{c.name}</span>
                      {c.id === activeChannelId && c.type === 'text' && (
                        <span className="channel-action" role="button" tabIndex={0} aria-label="Convidar" data-tip="Convidar pessoas"
                          onClick={(e) => { e.stopPropagation(); setInviting(true) }}>
                          <UserPlus size={16} />
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            ))}
          </div>
          {inviting && <InviteModal server={server} onClose={() => setInviting(false)} />}
          {creating && (
            <CreateChannelModal serverId={server.id} defaultType={creating.type} defaultCategory={creating.category} onClose={() => setCreating(null)} />
          )}
        </>
      ) : (
        <>
          <div className="sidebar-header static">Início</div>
          <div className="channel-list">
            <p className="muted small pad">Amigos e mensagens diretas chegam na etapa 3. Por enquanto, escolha um servidor à esquerda.</p>
          </div>
        </>
      )}
      <UserPanel />
    </aside>
  )
}

function UserPanel() {
  const { me, setSettingsOpen, upsertProfile, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(me?.custom_status ?? '')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setCustom(me?.custom_status ?? ''), [me?.custom_status])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const setStatus = async (status: Status) => {
    upsertProfile(await backend.updateProfile({ status }))
    setOpen(false)
  }
  const saveCustom = async () => {
    upsertProfile(await backend.updateProfile({ custom_status: custom.trim() }))
    toast('Status atualizado')
  }
  const soon = () => toast('Microfone e áudio chegam na etapa 2 (chamadas)')

  return (
    <div className="user-panel" ref={ref}>
      <button className="user-panel-me" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Avatar profile={me} size={34} showStatus />
        <span className="user-panel-text">
          <strong className="truncate">{displayName(me)}</strong>
          <span className="truncate">{me?.custom_status || (me ? STATUS_LABEL[me.status] : '')}</span>
        </span>
      </button>
      <button className="icon-btn" aria-label="Microfone" data-tip="Microfone" onClick={soon}><Mic size={18} /></button>
      <button className="icon-btn" aria-label="Áudio" data-tip="Áudio" onClick={soon}><Headphones size={18} /></button>
      <button className="icon-btn" aria-label="Configurações" data-tip="Configurações" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>

      {open && me && (
        <div className="status-menu">
          <div className="status-custom">
            <input value={custom} maxLength={80} placeholder="Defina um status personalizado"
              onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void saveCustom()} />
            <button className="btn btn-primary btn-sm" onClick={() => void saveCustom()}>Salvar</button>
          </div>
          {(['online', 'idle', 'dnd', 'invisible'] as Status[]).map((s) => (
            <button key={s} className={`dropdown-item ${me.status === s ? 'selected' : ''}`} onClick={() => void setStatus(s)}>
              <span className="row-gap"><StatusDot status={s} /> {STATUS_LABEL[s]}</span>
            </button>
          ))}
          <div className="dropdown-sep" />
          <button className="dropdown-item" onClick={() => { setOpen(false); setSettingsOpen(true) }}>
            Editar perfil <Settings size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
