import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown, ChevronRight, Hash, Headphones, HeadphoneOff, LogOut, Mic, MicOff, Plus, Settings,
  UserPlus, Video, Volume2, X,
} from 'lucide-react'
import { voice } from '../lib/voice/engine'
import { useVoice, useVoicePresence } from '../lib/voice/hooks'
import { VoiceConnectedPanel } from './VoiceConnectedPanel'
import { backend } from '../lib/backend'
import type { Channel, Status } from '../lib/types'
import { useApp } from '../state'
import { Avatar, STATUS_LABEL, StatusDot, displayName } from './Avatar'
import { CreateChannelModal, InviteModal } from './ServerModals'
import { t } from '../lib/i18n'

export function ChannelSidebar() {
  const { servers, activeServerId, channels, activeChannelId, setActiveChannelId, userId, toast, refreshServers, ask, openProfile } = useApp()
  const server = servers.find((s) => s.id === activeServerId)
  const [menuOpen, setMenuOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [creating, setCreating] = useState<{ category: string; type: Channel['type'] } | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const isOwner = server?.owner_id === userId
  const inVoice = useVoicePresence(server?.id ?? null)
  const call = useVoice()
  const { profiles, ensureProfiles } = useApp()
  useEffect(() => {
    if (inVoice.length) ensureProfiles(inVoice.map((m) => m.userId))
  }, [inVoice, ensureProfiles])

  const openChannel = (c: Channel) => {
    setActiveChannelId(c.id)
    if (c.type === 'voice' && server && call.channelId !== c.id) void voice.join(c.id, server.id, userId)
  }

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
    const ok = await ask({ title: t('Sair de {nome}', { nome: server.name }), message: t('Você vai precisar de um novo convite para voltar.'), confirmLabel: t('Sair do servidor'), danger: true })
    if (!ok) return
    await backend.leaveServer(server.id)
    await refreshServers()
    toast(t('Você saiu do servidor'))
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
                  {t('Convidar pessoas')} <UserPlus size={16} />
                </button>
                {isOwner && (
                  <button className="dropdown-item" onClick={() => { setCreating({ category: 'Canais de texto', type: 'text' }); setMenuOpen(false) }}>
                    {t('Criar canal')} <Plus size={16} />
                  </button>
                )}
                {!isOwner && (
                  <button className="dropdown-item danger" onClick={() => { setMenuOpen(false); void leave() }}>
                    {t('Sair do servidor')} <LogOut size={16} />
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
                    <span>{t(category)}</span>
                  </button>
                  {isOwner && (
                    <button className="icon-btn tiny" aria-label={t('Criar canal em {categoria}', { categoria: t(category) })} data-tip={t('Criar canal')}
                      onClick={() => setCreating({ category, type: list[0]?.type ?? 'text' })}>
                      <Plus size={16} />
                    </button>
                  )}
                </div>
                {list
                  .filter((c) => !collapsed[category] || c.id === activeChannelId)
                  .map((c) => (
                    <div key={c.id}>
                    <button
                      className={`channel-item ${c.id === activeChannelId ? 'active' : ''} ${call.channelId === c.id ? 'in-call' : ''}`}
                      onClick={() => openChannel(c)}
                    >
                      {c.type === 'text' ? <Hash size={20} /> : <Volume2 size={20} />}
                      <span className="truncate">{c.name}</span>
                      {c.id === activeChannelId && c.type === 'text' && (
                        <span className="channel-action" role="button" tabIndex={0} aria-label={t('Convidar pessoas')} data-tip={t('Convidar pessoas')}
                          onClick={(e) => { e.stopPropagation(); setInviting(true) }}>
                          <UserPlus size={16} />
                        </span>
                      )}
                    </button>
                    {c.type === 'voice' && (
                      <div className="voice-members">
                        {inVoice.filter((m) => m.channelId === c.id).map((m) => (
                          <button key={m.sessionId} className="voice-member"
                            onClick={(e) => openProfile(m.userId, e.currentTarget.getBoundingClientRect())}>
                            <span className={`speak-ring ${call.speaking[m.sessionId] ? 'on' : ''}`}>
                              <Avatar profile={profiles[m.userId]} size={24} />
                            </span>
                            <span className="truncate">{displayName(profiles[m.userId])}</span>
                            <span className="voice-member-icons">
                              {m.screen && <span className="live-badge">AO VIVO</span>}
                              {m.camera && <Video size={14} />}
                              {m.deafened ? <HeadphoneOff size={14} className="danger-icon" /> : m.muted && <MicOff size={14} className="danger-icon" />}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    </div>
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
          <div className="sidebar-header static">{t('Início')}</div>
          <div className="channel-list">
            <p className="muted small pad">{t('Amigos e mensagens diretas chegam na etapa 3. Por enquanto, escolha um servidor à esquerda.')}</p>
          </div>
        </>
      )}
      <VoiceConnectedPanel />
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
    toast(t('Status atualizado'))
  }
  const call = useVoice()

  return (
    <div className="user-panel" ref={ref}>
      <button className="user-panel-me" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Avatar profile={me} size={34} showStatus />
        <span className="user-panel-text">
          <strong className="truncate">{displayName(me)}</strong>
          <span className="truncate">{me?.custom_status || (me ? STATUS_LABEL[me.status] : '')}</span>
        </span>
      </button>
      <button className={`icon-btn ${call.muted || call.deafened ? 'danger-on' : ''}`} aria-label={call.muted ? t('Ativar microfone') : t('Silenciar microfone')}
        data-tip={call.muted ? t('Ativar microfone') : t('Silenciar')} onClick={() => voice.toggleMute()}>
        {call.muted || call.deafened ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
      <button className={`icon-btn ${call.deafened ? 'danger-on' : ''}`} aria-label={call.deafened ? t('Ativar áudio') : t('Desativar áudio')}
        data-tip={call.deafened ? t('Ativar áudio') : t('Desativar áudio')} onClick={() => voice.toggleDeafen()}>
        {call.deafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
      </button>
      <button className="icon-btn" aria-label={t('Configurações')} data-tip={t('Configurações')} onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>

      {open && me && (
        <div className="status-menu">
          <div className="status-custom">
            <input value={custom} maxLength={80} placeholder={t('Defina um status personalizado')}
              onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void saveCustom()} />
            <button className="btn btn-primary btn-sm" onClick={() => void saveCustom()}>{t('Salvar')}</button>
          </div>
          {(['online', 'idle', 'dnd', 'invisible'] as Status[]).map((s) => (
            <button key={s} className={`dropdown-item ${me.status === s ? 'selected' : ''}`} onClick={() => void setStatus(s)}>
              <span className="row-gap"><StatusDot status={s} /> {STATUS_LABEL[s]}</span>
            </button>
          ))}
          <div className="dropdown-sep" />
          <button className="dropdown-item" onClick={() => { setOpen(false); setSettingsOpen(true) }}>
            {t('Editar perfil')} <Settings size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
