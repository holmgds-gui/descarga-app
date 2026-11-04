import { useState, type FormEvent } from 'react'
import { Check, MessageCircle, Plus, Search, UserMinus, Users, X } from 'lucide-react'
import { backend } from '../lib/backend'
import type { Friendship, Profile } from '../lib/types'
import { useApp } from '../state'
import { useVoice } from '../lib/voice/hooks'
import { Avatar, STATUS_LABEL, displayName } from './Avatar'
import { ChatHeader } from './ChatView'
import { DmAvatar, dmName } from './dm'
import { NewDmModal } from './DmModals'
import { locale, t } from '../lib/i18n'

/** Barra lateral do Início: amigos e lista de conversas diretas. */
export function HomeSidebar() {
  const { dms, activeDmId, setActiveDmId, profiles, userId, unreadDms, friendships, hideDm, hiddenDms, ask, toast, refreshDms } = useApp()
  const [creating, setCreating] = useState(false)
  const call = useVoice()
  const incoming = friendships.filter((f) => f.status === 'pending' && f.addressee === userId).length
  const visible = dms.filter((d) => {
    const hiddenAt = hiddenDms[d.id]
    return !hiddenAt || (d.last_message_at ?? '') > hiddenAt || d.id === activeDmId
  })

  const close = async (id: string, isGroup: boolean, name: string) => {
    if (!isGroup) {
      hideDm(id)
      return
    }
    const ok = await ask({
      title: t('Sair de {nome}', { nome: name }),
      message: t('Você não vai mais receber mensagens deste grupo. Para voltar, alguém precisa te adicionar de novo.'),
      confirmLabel: t('Sair do grupo'),
      danger: true,
    })
    if (!ok) return
    try {
      await backend.leaveDm(id)
      await refreshDms()
      if (activeDmId === id) setActiveDmId(null)
    } catch (err) {
      toast((err as Error).message)
    }
  }

  return (
    <>
      <div className="sidebar-header static">
        <button className="find-dm" onClick={() => setCreating(true)}>{t('Encontre ou comece uma conversa')}</button>
      </div>
      <div className="channel-list">
        <button className={`channel-item home-item ${activeDmId === null ? 'active' : ''}`} onClick={() => setActiveDmId(null)}>
          <Users size={22} />
          <span className="truncate">{t('Amigos')}</span>
          {incoming > 0 && <span className="badge" aria-label={t('{n} pedidos de amizade', { n: incoming })}>{incoming}</span>}
        </button>
        <div className="category dm-category">
          <span className="category-toggle">{t('Mensagens diretas')}</span>
          <button className="icon-btn tiny" aria-label={t('Criar DM')} data-tip={t('Criar DM')} onClick={() => setCreating(true)}>
            <Plus size={16} />
          </button>
        </div>
        {!visible.length && <p className="muted small pad">{t('Suas conversas aparecem aqui.')}</p>}
        {visible.map((d) => {
          const name = dmName(d, profiles, userId)
          const other = !d.is_group ? profiles[d.member_ids.find((id) => id !== userId) ?? ''] : undefined
          const unread = unreadDms.has(d.id)
          return (
            <div key={d.id} className={`dm-item ${d.id === activeDmId ? 'active' : ''} ${unread ? 'unread' : ''}`}>
              <button className="dm-item-main" onClick={() => setActiveDmId(d.id)}>
                <DmAvatar dm={d} profiles={profiles} me={userId} size={32} showStatus />
                <span className="dm-item-text">
                  <span className="truncate dm-item-name">{name}</span>
                  <span className="truncate dm-item-sub">
                    {call.channelId === d.id ? t('Na call') : d.is_group ? t('{n} membros', { n: d.member_ids.length }) : other?.custom_status || ''}
                  </span>
                </span>
                {unread && <span className="unread-dot" aria-label={t('Mensagens novas')} />}
              </button>
              <button className="icon-btn tiny dm-close" aria-label={d.is_group ? t('Sair do grupo') : t('Fechar conversa')}
                data-tip={d.is_group ? t('Sair do grupo') : t('Fechar conversa')} onClick={() => void close(d.id, d.is_group, name)}>
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
      {creating && <NewDmModal onClose={() => setCreating(false)} />}
    </>
  )
}

type Tab = 'online' | 'all' | 'pending' | 'add'

/** Página de amigos: disponíveis, todos, pedidos e adicionar. */
export function FriendsPage() {
  const { friendships, userId, profiles, openDmWith, toast, ask, refreshFriends, openProfile } = useApp()
  const incoming = friendships.filter((f) => f.status === 'pending' && f.addressee === userId)
  const [tab, setTab] = useState<Tab>(() => (incoming.length ? 'pending' : 'online'))
  const [q, setQ] = useState('')
  const otherOf = (f: Friendship) => (f.requester === userId ? f.addressee : f.requester)
  const accepted = friendships.filter((f) => f.status === 'accepted')
  const pending = friendships.filter((f) => f.status === 'pending')
  const sort = (a: Friendship, b: Friendship) =>
    displayName(profiles[otherOf(a)]).localeCompare(displayName(profiles[otherOf(b)]), locale())

  const list = (tab === 'pending' ? pending : accepted)
    .filter((f) => tab !== 'online' || (profiles[otherOf(f)] && profiles[otherOf(f)].status !== 'invisible'))
    .filter((f) => {
      const p = profiles[otherOf(f)]
      const query = q.trim().toLowerCase()
      return !query || (p && (p.username.includes(query) || p.display_name.toLowerCase().includes(query)))
    })
    .sort(sort)

  const act = async (fn: () => Promise<void>, msg?: string) => {
    try {
      await fn()
      await refreshFriends()
      if (msg) toast(msg)
    } catch (err) {
      toast((err as Error).message)
    }
  }

  const removeFriend = async (f: Friendship, p: Profile | undefined) => {
    const ok = await ask({
      title: t('Remover {nome}', { nome: displayName(p) }),
      message: t('Tem certeza de que quer remover {nome} dos seus amigos?', { nome: displayName(p) }),
      confirmLabel: t('Remover amizade'),
      danger: true,
    })
    if (ok) await act(() => backend.removeFriendship(f.id))
  }

  const title = tab === 'online' ? t('Disponíveis') : tab === 'all' ? t('Todos os amigos') : t('Pendentes')

  return (
    <section className="chat friends-page">
      <ChatHeader icon={<Users size={22} />} title={t('Amigos')}
        actions={
          <nav className="friend-tabs" aria-label={t('Amigos')}>
            <button className={tab === 'online' ? 'on' : ''} onClick={() => setTab('online')}>{t('Disponíveis')}</button>
            <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>{t('Todos')}</button>
            <button className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>
              {t('Pendentes')}{incoming.length > 0 && <span className="badge">{incoming.length}</span>}
            </button>
            <button className={`add-friend-tab ${tab === 'add' ? 'on' : ''}`} onClick={() => setTab('add')}>{t('Adicionar amigo')}</button>
          </nav>
        } />
      <div className="friends-body">
        {tab === 'add' ? (
          <AddFriend />
        ) : (
          <>
            <label className="search-field">
              <Search size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Buscar')} aria-label={t('Buscar amigos')} />
            </label>
            <h3 className="friends-count">{title} — {list.length}</h3>
            {!list.length && (
              <div className="empty-state small-empty">
                <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={120} height={120} />
                <p className="muted">
                  {tab === 'pending' ? t('Nenhum pedido de amizade por aqui.')
                    : tab === 'online' ? t('Nenhum amigo disponível agora.')
                      : t('Você ainda não adicionou ninguém. Que tal mandar um pedido?')}
                </p>
                {tab !== 'pending' && <button className="btn btn-primary" onClick={() => setTab('add')}>{t('Adicionar amigo')}</button>}
              </div>
            )}
            {list.map((f) => {
              const p = profiles[otherOf(f)]
              const isIncoming = f.status === 'pending' && f.addressee === userId
              return (
                <div key={f.id} className="friend-row" role={f.status === 'accepted' ? 'button' : undefined} tabIndex={f.status === 'accepted' ? 0 : -1}
                  aria-label={f.status === 'accepted' ? t('Conversar com {nome}', { nome: displayName(p) }) : undefined}
                  onClick={(e) => (f.status === 'accepted' ? void openDmWith([otherOf(f)]).catch((err) => toast((err as Error).message)) : openProfile(otherOf(f), e.currentTarget.getBoundingClientRect()))}
                  onKeyDown={(e) => e.key === 'Enter' && f.status === 'accepted' && void openDmWith([otherOf(f)])}>
                  <Avatar profile={p} size={36} showStatus />
                  <span className="friend-text">
                    <span className="friend-name">
                      <strong className="truncate">{displayName(p)}</strong>
                      <span className="muted small friend-handle">{p?.username}</span>
                    </span>
                    <span className="muted small truncate">
                      {f.status === 'pending' ? (isIncoming ? t('Pedido de amizade recebido') : t('Pedido de amizade enviado'))
                        : p?.custom_status || (p ? STATUS_LABEL[p.status] : '')}
                    </span>
                  </span>
                  <span className="friend-actions" onClick={(e) => e.stopPropagation()}>
                    {f.status === 'accepted' && (
                      <>
                        <button className="round-icon" aria-label={t('Mensagem para {nome}', { nome: displayName(p) })} data-tip={t('Mensagem')}
                          onClick={() => void openDmWith([otherOf(f)]).catch((err) => toast((err as Error).message))}><MessageCircle size={18} /></button>
                        <button className="round-icon danger" aria-label={t('Remover amizade com {nome}', { nome: displayName(p) })} data-tip={t('Remover amizade')}
                          onClick={() => void removeFriend(f, p)}><UserMinus size={18} /></button>
                      </>
                    )}
                    {isIncoming && (
                      <button className="round-icon success" aria-label={t('Aceitar pedido de {nome}', { nome: displayName(p) })} data-tip={t('Aceitar')}
                        onClick={() => void act(() => backend.acceptFriend(f.id), t('Agora vocês são amigos!'))}><Check size={18} /></button>
                    )}
                    {f.status === 'pending' && (
                      <button className="round-icon danger" aria-label={isIncoming ? t('Recusar pedido de {nome}', { nome: displayName(p) }) : t('Cancelar pedido para {nome}', { nome: displayName(p) })}
                        data-tip={isIncoming ? t('Recusar') : t('Cancelar')} onClick={() => void act(() => backend.removeFriendship(f.id))}><X size={18} /></button>
                    )}
                  </span>
                </div>
              )
            })}
          </>
        )}
      </div>
    </section>
  )
}

function AddFriend() {
  const { refreshFriends } = useApp()
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const u = name.trim()
    if (!u) return
    setBusy(true)
    try {
      await backend.sendFriendRequest(u)
      await refreshFriends()
      setMsg({ ok: true, text: t('Pedido enviado para {nome}!', { nome: u.replace(/^@/, '') }) })
      setName('')
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="add-friend">
      <h2>{t('Adicionar amigo')}</h2>
      <p className="muted">{t('Você pode adicionar amigos pelo nome de usuário deles.')}</p>
      <form className={`add-friend-form ${msg ? (msg.ok ? 'ok' : 'bad') : ''}`} onSubmit={submit}>
        <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setMsg(null) }} maxLength={40}
          placeholder={t('Digite o nome de usuário')} aria-label={t('Nome de usuário')} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button className="btn btn-primary" disabled={!name.trim() || busy}>{t('Enviar pedido de amizade')}</button>
      </form>
      {msg && <p className={`small ${msg.ok ? 'ok-text' : 'error-text'}`} role="status">{msg.text}</p>}
    </div>
  )
}
