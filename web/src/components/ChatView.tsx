import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { CornerUpLeft, Hash, Menu, Pencil, PlusCircle, Smile, Trash2, Users, X } from 'lucide-react'
import { backend } from '../lib/backend'
import { formatLongDate, formatTime, formatTimestamp, renderMessage } from '../lib/format'
import type { Channel, Message } from '../lib/types'
import { useApp } from '../state'
import { Avatar, displayName } from './Avatar'

const GROUP_MS = 7 * 60 * 1000

export function ChatHeader({
  icon,
  title,
  topic,
  showMembersToggle,
  membersOpen,
  onToggleMembers,
}: {
  icon: ReactNode
  title: string
  topic?: string
  showMembersToggle?: boolean
  membersOpen?: boolean
  onToggleMembers?: () => void
}) {
  const { setMobilePane } = useApp()
  return (
    <header className="chat-header">
      <button className="icon-btn mobile-only" aria-label="Abrir canais" onClick={() => setMobilePane('nav')}>
        <Menu size={22} />
      </button>
      <span className="chat-header-icon">{icon}</span>
      <h1 className="truncate">{title}</h1>
      {topic && <span className="chat-topic truncate">{topic}</span>}
      <span className="flex-1" />
      {showMembersToggle && (
        <button className={`icon-btn ${membersOpen ? 'on' : ''}`} aria-label="Lista de membros" data-tip="Membros"
          onClick={onToggleMembers}>
          <Users size={22} />
        </button>
      )}
    </header>
  )
}

export function ChatView({ channel, membersOpen, onToggleMembers }: { channel: Channel; membersOpen: boolean; onToggleMembers: () => void }) {
  const { profiles, ensureProfiles, userId, openProfile, toast, ask } = useApp()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const prevHeight = useRef<number | null>(null)

  // carrega as mensagens e escuta em tempo real
  useEffect(() => {
    let alive = true
    setMessages([])
    setLoading(true)
    setHasMore(true)
    setReplyTo(null)
    setEditingId(null)
    stickToBottom.current = true
    void backend.listMessages(channel.id).then((list) => {
      if (!alive) return
      setMessages(list)
      setHasMore(list.length >= 50)
      setLoading(false)
    })
    const off = backend.subscribeMessages(channel.id, {
      onInsert: (m) => setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
      onUpdate: (m) => setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x))),
      onDelete: (id) => setMessages((prev) => prev.filter((x) => x.id !== id)),
    })
    return () => {
      alive = false
      off()
    }
  }, [channel.id])

  useEffect(() => {
    ensureProfiles(messages.map((m) => m.author_id))
  }, [messages, ensureProfiles])

  // mantém a rolagem no fim quando chegam mensagens novas
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current
      prevHeight.current = null
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  const loadOlder = useCallback(async () => {
    if (!hasMore || loading || !messages.length) return
    setLoading(true)
    const older = await backend.listMessages(channel.id, messages[0].created_at)
    prevHeight.current = listRef.current?.scrollHeight ?? null
    setMessages((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev])
    setHasMore(older.length >= 50)
    setLoading(false)
  }, [hasMore, loading, messages, channel.id])

  const onScroll = () => {
    const el = listRef.current!
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (el.scrollTop < 60) void loadOlder()
  }

  const send = async (content: string) => {
    stickToBottom.current = true
    try {
      const m = await backend.sendMessage(channel.id, content, replyTo?.id ?? null)
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
      setReplyTo(null)
    } catch (err) {
      toast((err as Error).message)
    }
  }

  const remove = async (m: Message) => {
    const ok = await ask({ title: 'Apagar mensagem', message: 'Tem certeza de que quer apagar esta mensagem? Não dá para desfazer.', confirmLabel: 'Apagar', danger: true })
    if (!ok) return
    await backend.deleteMessage(m.id)
    setMessages((prev) => prev.filter((x) => x.id !== m.id))
  }

  const saveEdit = async (m: Message, content: string) => {
    setEditingId(null)
    if (content.trim() === m.content || !content.trim()) return
    await backend.editMessage(m.id, content.trim())
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, content: content.trim(), edited_at: new Date().toISOString() } : x)))
  }

  const byId = new Map(messages.map((m) => [m.id, m]))

  return (
    <section className="chat">
      <ChatHeader icon={<Hash size={22} />} title={channel.name} topic={channel.topic} showMembersToggle
        membersOpen={membersOpen} onToggleMembers={onToggleMembers} />
      <div className="messages" ref={listRef} onScroll={onScroll}>
        {!hasMore && (
          <div className="channel-welcome">
            <div className="channel-welcome-icon"><Hash size={40} /></div>
            <h2>Bem-vindo(a) a #{channel.name}!</h2>
            <p className="muted">Este é o começo do canal #{channel.name}.</p>
          </div>
        )}
        {loading && hasMore && <div className="loading-dots"><span /><span /><span /></div>}
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
          const grouped =
            !newDay && !!prev && prev.author_id === m.author_id && !m.reply_to &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_MS
          const author = profiles[m.author_id]
          const parent = m.reply_to ? byId.get(m.reply_to) : null
          const mine = m.author_id === userId
          return (
            <Fragment key={m.id}>
              {newDay && <div className="day-sep"><span>{formatLongDate(m.created_at)}</span></div>}
              <article tabIndex={-1} className={`msg ${grouped ? 'grouped' : ''} ${replyTo?.id === m.id ? 'replying' : ''}`}>
                {m.reply_to && (
                  <div className="msg-reply-ref">
                    <span className="reply-spine" />
                    {parent ? (
                      <>
                        <Avatar profile={profiles[parent.author_id]} size={16} />
                        <strong style={{ color: profiles[parent.author_id]?.accent_color }}>{displayName(profiles[parent.author_id])}</strong>
                        <span className="truncate">{parent.content.replace(/[*_~`]/g, '')}</span>
                      </>
                    ) : (
                      <em className="muted">Mensagem original indisponível</em>
                    )}
                  </div>
                )}
                <div className="msg-gutter">
                  {grouped ? (
                    <time className="msg-hover-time">{formatTime(m.created_at)}</time>
                  ) : (
                    <Avatar profile={author} size={40} onClick={(e) => openProfile(m.author_id, e.currentTarget.getBoundingClientRect())} />
                  )}
                </div>
                <div className="msg-body">
                  {!grouped && (
                    <div className="msg-meta">
                      <button className="msg-author" style={{ color: author?.accent_color }}
                        onClick={(e) => openProfile(m.author_id, e.currentTarget.getBoundingClientRect())}>
                        {displayName(author)}
                      </button>
                      <time>{formatTimestamp(m.created_at)}</time>
                    </div>
                  )}
                  {editingId === m.id ? (
                    <EditBox initial={m.content} onCancel={() => setEditingId(null)} onSave={(c) => void saveEdit(m, c)} />
                  ) : (
                    <div className="msg-content">
                      {renderMessage(m.content)}
                      {m.edited_at && <span className="edited">(editado)</span>}
                    </div>
                  )}
                </div>
                {editingId !== m.id && (
                  <div className="msg-actions">
                    <button className="icon-btn tiny" aria-label="Responder" data-tip="Responder" onClick={() => setReplyTo(m)}>
                      <CornerUpLeft size={18} />
                    </button>
                    {mine && (
                      <>
                        <button className="icon-btn tiny" aria-label="Editar" data-tip="Editar" onClick={() => setEditingId(m.id)}>
                          <Pencil size={18} />
                        </button>
                        <button className="icon-btn tiny danger" aria-label="Apagar" data-tip="Apagar" onClick={() => void remove(m)}>
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </article>
            </Fragment>
          )
        })}
      </div>
      <Composer
        channelName={channel.name}
        replyTo={replyTo ? { name: displayName(profiles[replyTo.author_id]) } : null}
        onCancelReply={() => setReplyTo(null)}
        onSend={send}
        onEditLast={() => {
          const last = [...messages].reverse().find((m) => m.author_id === userId)
          if (last) setEditingId(last.id)
        }}
      />
    </section>
  )
}

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (c: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial)
  return (
    <div className="edit-box">
      <AutoTextarea value={value} onChange={setValue} autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(value) }
          if (e.key === 'Escape') onCancel()
        }} />
      <p className="small muted">
        Esc para <button className="link" onClick={onCancel}>cancelar</button> • Enter para <button className="link" onClick={() => onSave(value)}>salvar</button>
      </p>
    </div>
  )
}

function AutoTextarea({
  value, onChange, onKeyDown, placeholder, autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 240) + 'px'
  }, [value])
  return (
    <textarea ref={ref} rows={1} value={value} placeholder={placeholder} autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
  )
}

function Composer({
  channelName, replyTo, onCancelReply, onSend, onEditLast,
}: {
  channelName: string
  replyTo: { name: string } | null
  onCancelReply: () => void
  onSend: (content: string) => Promise<void>
  onEditLast: () => void
}) {
  const { toast } = useApp()
  const [text, setText] = useState('')
  const submit = () => {
    const t = text.trim()
    if (!t) return
    setText('')
    void onSend(t)
  }
  return (
    <div className="composer-wrap">
      {replyTo && (
        <div className="reply-bar">
          <span>Respondendo a <strong>{replyTo.name}</strong></span>
          <button className="icon-btn tiny" aria-label="Cancelar resposta" onClick={onCancelReply}><X size={16} /></button>
        </div>
      )}
      <div className={`composer ${replyTo ? 'with-reply' : ''}`}>
        <button className="icon-btn" aria-label="Enviar arquivo" data-tip="Arquivos e áudios chegam na etapa 3"
          onClick={() => toast('Envio de arquivos e mensagens de voz chega na etapa 3')}>
          <PlusCircle size={22} />
        </button>
        <AutoTextarea value={text} onChange={setText} placeholder={`Conversar em #${channelName}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
            if (e.key === 'Escape') onCancelReply()
            if (e.key === 'ArrowUp' && !text) { e.preventDefault(); onEditLast() }
          }} />
        <button className="icon-btn" aria-label="Emojis" data-tip="Emojis chegam na etapa 3"
          onClick={() => toast('Seletor de emojis e reações chega na etapa 3')}>
          <Smile size={22} />
        </button>
      </div>
    </div>
  )
}
