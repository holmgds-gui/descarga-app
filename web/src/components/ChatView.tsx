import {
  Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState,
  type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode, type RefObject,
} from 'react'
import {
  Check, CornerUpLeft, Hash, Menu, Mic, Pencil, Phone, PlusCircle, Send, Smile, SmilePlus, Square, Trash2, Upload, UserPlus,
  Users, Video, X,
} from 'lucide-react'
import { backend } from '../lib/backend'
import { EmojiGlyph, formatLongDate, formatTime, formatTimestamp, renderMessage } from '../lib/format'
import { QUICK_REACTIONS, onlyEmojis, pushRecent, recentEmojis } from '../lib/emoji'
import { MAX_FILES_PER_MESSAGE, formatBytes, formatDuration, kindOf, readMeta, seedAttachmentUrl } from '../lib/files'
import { MAX_VOICE_SECONDS, VoiceRecorder, canRecordVoice } from '../lib/recorder'
import { voice } from '../lib/voice/engine'
import { useVoice, useVoicePresence } from '../lib/voice/hooks'
import type { Attachment, Channel, DmChannel, Message, Profile, Reaction } from '../lib/types'
import { useApp } from '../state'
import { Avatar, displayName } from './Avatar'
import { Attachments } from './Attachments'
import { DmAvatar, dmName, otherIds } from './dm'
import { AddToGroupModal, NewDmModal, RenameGroupModal } from './DmModals'
import { EmojiPicker } from './EmojiPicker'
import { VoiceStage } from './VoiceStage'
import { t } from '../lib/i18n'

const GROUP_MS = 7 * 60 * 1000

export function ChatHeader({
  icon,
  title,
  topic,
  showMembersToggle,
  membersOpen,
  onToggleMembers,
  actions,
  onTitleClick,
}: {
  icon: ReactNode
  title: string
  topic?: string
  showMembersToggle?: boolean
  membersOpen?: boolean
  onToggleMembers?: () => void
  actions?: ReactNode
  onTitleClick?: () => void
}) {
  const { setMobilePane } = useApp()
  return (
    <header className="chat-header">
      <button className="icon-btn mobile-only" aria-label={t('Abrir canais')} onClick={() => setMobilePane('nav')}>
        <Menu size={22} />
      </button>
      <span className="chat-header-icon">{icon}</span>
      {onTitleClick ? (
        <button className="chat-title-btn truncate" onClick={onTitleClick} data-tip={t('Mudar o nome do grupo')}><h1 className="truncate">{title}</h1></button>
      ) : (
        <h1 className="truncate">{title}</h1>
      )}
      {topic && <span className="chat-topic truncate">{topic}</span>}
      <span className="flex-1" />
      {actions}
      {showMembersToggle && (
        <button className={`icon-btn ${membersOpen ? 'on' : ''}`} aria-label={t('Lista de membros')} data-tip={t('Membros')}
          onClick={onToggleMembers}>
          <Users size={22} />
        </button>
      )}
    </header>
  )
}

export interface PendingFile {
  id: string
  file: File
  preview: string | null
}

type PickerTarget = { anchor: DOMRect; messageId: string | null }

export function ChatView({ channel, dm, membersOpen, onToggleMembers }: {
  channel: Channel
  dm?: DmChannel
  membersOpen: boolean
  onToggleMembers: () => void
}) {
  const { profiles, ensureProfiles, userId, openProfile, toast, ask, memberIds, me } = useApp()
  const [messages, setMessages] = useState<Message[]>([])
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({})
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingFile[]>([])
  const [sending, setSending] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [picker, setPicker] = useState<PickerTarget | null>(null)
  const [dialog, setDialog] = useState<'add' | 'rename' | 'newGroup' | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const prevHeight = useRef<number | null>(null)
  const dragDepth = useRef(0)
  const isDm = channel.type === 'dm'

  // carrega as mensagens e escuta em tempo real
  useEffect(() => {
    let alive = true
    setMessages([])
    setReactions({})
    setLoading(true)
    setHasMore(true)
    setReplyTo(null)
    setEditingId(null)
    setPending([])
    stickToBottom.current = true
    const loadReactions = (ids: string[]) =>
      void backend.listReactions(channel.id, ids).then((list) => {
        if (!alive) return
        setReactions((prev) => {
          const next = { ...prev }
          for (const id of ids) next[id] = []
          for (const r of list) next[r.message_id] = [...(next[r.message_id] ?? []), r]
          return next
        })
      }).catch(() => undefined)
    void backend.listMessages(channel.id).then((list) => {
      if (!alive) return
      setMessages(list)
      setHasMore(list.length >= 50)
      setLoading(false)
      if (list.length) loadReactions(list.map((m) => m.id))
    })
    const off = backend.subscribeMessages(channel.id, {
      onInsert: (m) => setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
      onUpdate: (m) => setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x))),
      onDelete: (id) => setMessages((prev) => prev.filter((x) => x.id !== id)),
    })
    const offR = backend.subscribeReactions(channel.id, {
      onAdd: (r) => setReactions((prev) => {
        const list = prev[r.message_id] ?? []
        if (list.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)) return prev
        return { ...prev, [r.message_id]: [...list, r] }
      }),
      onRemove: (r) => setReactions((prev) => ({
        ...prev,
        [r.message_id]: (prev[r.message_id] ?? []).filter((x) => !(x.user_id === r.user_id && x.emoji === r.emoji)),
      })),
    })
    return () => {
      alive = false
      off()
      offR()
    }
  }, [channel.id])

  useEffect(() => {
    ensureProfiles([...messages.map((m) => m.author_id), ...Object.values(reactions).flat().map((r) => r.user_id)])
  }, [messages, reactions, ensureProfiles])

  // conversa direta: avisa que você leu (se a confirmação de leitura estiver ligada)
  const lastId = messages[messages.length - 1]?.id
  useEffect(() => {
    if (!isDm || !lastId) return
    const mark = () => document.visibilityState === 'visible' && void backend.markRead(channel.id).catch(() => undefined)
    const id = window.setTimeout(mark, 400)
    document.addEventListener('visibilitychange', mark)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('visibilitychange', mark)
    }
  }, [isDm, lastId, channel.id])

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
  }, [messages, reactions])

  const loadOlder = useCallback(async () => {
    if (!hasMore || loading || !messages.length) return
    setLoading(true)
    const older = await backend.listMessages(channel.id, messages[0].created_at)
    prevHeight.current = listRef.current?.scrollHeight ?? null
    setMessages((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev])
    setHasMore(older.length >= 50)
    setLoading(false)
    if (older.length) {
      const list = await backend.listReactions(channel.id, older.map((m) => m.id)).catch(() => [] as Reaction[])
      setReactions((prev) => {
        const next = { ...prev }
        for (const r of list) next[r.message_id] = [...(next[r.message_id] ?? []), r]
        return next
      })
    }
  }, [hasMore, loading, messages, channel.id])

  const onScroll = () => {
    const el = listRef.current!
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (el.scrollTop < 60) void loadOlder()
  }

  const afterSend = (m: Message) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    setReplyTo(null)
    if (isDm || m.reply_to || /(^|\s)@[a-z0-9_.]{2,32}/.test(m.content)) void backend.notify({ type: 'message', messageId: m.id })
  }

  const addFiles = (files: File[]) => {
    if (!files.length) return
    const max = backend.maxUploadBytes
    const ok: PendingFile[] = []
    for (const f of files) {
      if (f.size > max) {
        toast(t('"{nome}" passa do limite de {limite}.', { nome: f.name, limite: formatBytes(max) }))
        continue
      }
      ok.push({ id: crypto.randomUUID(), file: f, preview: kindOf(f.type) === 'image' ? URL.createObjectURL(f) : null })
    }
    setPending((prev) => {
      const next = [...prev, ...ok]
      if (next.length > MAX_FILES_PER_MESSAGE) toast(t('Dá para mandar até {n} arquivos por mensagem.', { n: MAX_FILES_PER_MESSAGE }))
      return next.slice(0, MAX_FILES_PER_MESSAGE)
    })
  }

  const send = async (content: string, files: PendingFile[]): Promise<boolean> => {
    stickToBottom.current = true
    try {
      const atts: Attachment[] = []
      for (let i = 0; i < files.length; i++) {
        setSending(files.length > 1 ? t('Enviando {i} de {n}…', { i: i + 1, n: files.length }) : t('Enviando…'))
        const p = files[i]
        const meta = await readMeta(p.file)
        const a = await backend.uploadAttachment(channel.id, p.file, meta)
        if (p.preview) seedAttachmentUrl(a.path, p.preview)
        atts.push(a)
      }
      afterSend(await backend.sendMessage(channel.id, content, replyTo?.id ?? null, atts))
      return true
    } catch (err) {
      toast((err as Error).message)
      return false
    } finally {
      setSending(null)
    }
  }

  const sendVoice = async (clip: { blob: Blob; type: string; ext: string; duration: number; waveform: number[] }) => {
    stickToBottom.current = true
    setSending(t('Enviando mensagem de voz…'))
    try {
      const file = new File([clip.blob], `${t('mensagem-de-voz')}.${clip.ext}`, { type: clip.type })
      const a = await backend.uploadAttachment(channel.id, file, {
        name: file.name, kind: 'audio', voice: true, duration: clip.duration, waveform: clip.waveform, type: clip.type,
      })
      seedAttachmentUrl(a.path, URL.createObjectURL(clip.blob))
      afterSend(await backend.sendMessage(channel.id, '', replyTo?.id ?? null, [a]))
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setSending(null)
    }
  }

  const remove = async (m: Message) => {
    const ok = await ask({ title: t('Apagar mensagem'), message: t('Tem certeza de que quer apagar esta mensagem? Não dá para desfazer.'), confirmLabel: t('Apagar'), danger: true })
    if (!ok) return
    await backend.deleteMessage(m.id)
    setMessages((prev) => prev.filter((x) => x.id !== m.id))
  }

  const saveEdit = async (m: Message, content: string) => {
    setEditingId(null)
    if (content.trim() === m.content || (!content.trim() && !m.attachments.length)) return
    await backend.editMessage(m.id, content.trim())
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, content: content.trim(), edited_at: new Date().toISOString() } : x)))
  }

  const toggleReaction = async (m: Message, emoji: string) => {
    const mine = (reactions[m.id] ?? []).some((r) => r.user_id === userId && r.emoji === emoji)
    const r: Reaction = { message_id: m.id, channel_id: channel.id, user_id: userId, emoji }
    setReactions((prev) => ({
      ...prev,
      [m.id]: mine
        ? (prev[m.id] ?? []).filter((x) => !(x.user_id === userId && x.emoji === emoji))
        : [...(prev[m.id] ?? []), r],
    }))
    try {
      if (mine) await backend.removeReaction(m.id, emoji)
      else {
        pushRecent(emoji)
        await backend.addReaction(m.id, channel.id, emoji)
      }
    } catch (err) {
      toast((err as Error).message)
      setReactions((prev) => ({
        ...prev,
        [m.id]: mine ? [...(prev[m.id] ?? []), r] : (prev[m.id] ?? []).filter((x) => !(x.user_id === userId && x.emoji === emoji)),
      }))
    }
  }

  // arrastar arquivos para o chat
  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files')
  const dragHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current++
      setDragging(true)
    },
    onDragOver: (e: DragEvent) => hasFiles(e) && e.preventDefault(),
    onDragLeave: (e: DragEvent) => {
      if (!hasFiles(e)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (!dragDepth.current) setDragging(false)
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      addFiles([...e.dataTransfer.files])
    },
  }

  const byId = new Map(messages.map((m) => [m.id, m]))
  const myName = profiles[userId]?.username
  const mentionRe = myName ? new RegExp(`(^|\\s)@${myName.replace(/\./g, '\\.')}(?![a-z0-9_.])`) : null
  const isForMe = (m: Message) =>
    m.author_id !== userId && ((mentionRe?.test(m.content) ?? false) || (!!m.reply_to && byId.get(m.reply_to)?.author_id === userId))

  // nome e cabeçalho
  const title = dm ? dmName(dm, profiles, userId) : channel.name
  const other = dm && !dm.is_group ? profiles[otherIds(dm, userId)[0]] : undefined
  const placeholder = dm
    ? dm.is_group ? t('Conversar em {nome}', { nome: title }) : t('Conversar com @{nome}', { nome: other?.username ?? title })
    : t('Conversar em #{canal}', { canal: channel.name })

  // confirmação de leitura: só aparece para quem também deixa a sua ligada
  const myLast = dm ? [...messages].reverse().find((m) => m.author_id === userId) : undefined
  let seenLabel: string | null = null
  if (dm && myLast && me?.read_receipts !== false) {
    const others = otherIds(dm, userId)
    const readers = others.filter((id) => (dm.reads[id] ?? '') >= myLast.created_at)
    if (readers.length) {
      seenLabel = !dm.is_group ? t('Visto') : readers.length === others.length ? t('Visto por todos') : t('Visto por {n}', { n: readers.length })
    }
  }

  const call = useVoice()
  const startCall = async (video: boolean) => {
    if (!dm) return
    if (call.channelId !== dm.id) await voice.join(dm.id, dm.id, userId)
    if (video && !voice.getSnapshot().camera && voice.getSnapshot().channelId === dm.id) await voice.toggleCamera()
  }

  const header = dm ? (
    <ChatHeader
      icon={<DmAvatar dm={dm} profiles={profiles} me={userId} size={24} />}
      title={title}
      topic={other ? (other.custom_status || undefined) : t('{n} membros', { n: dm.member_ids.length })}
      onTitleClick={dm.is_group ? () => setDialog('rename') : undefined}
      showMembersToggle={dm.is_group}
      membersOpen={membersOpen}
      onToggleMembers={onToggleMembers}
      actions={<>
        <button className="icon-btn" aria-label={t('Começar chamada de voz')} data-tip={t('Começar chamada de voz')}
          disabled={call.channelId === dm.id} onClick={() => void startCall(false)}><Phone size={20} /></button>
        <button className="icon-btn" aria-label={t('Começar chamada de vídeo')} data-tip={t('Começar chamada de vídeo')}
          onClick={() => void startCall(true)}><Video size={22} /></button>
        <button className="icon-btn" aria-label={t('Adicionar amigos à conversa')} data-tip={t('Adicionar amigos à conversa')}
          onClick={() => setDialog(dm.is_group ? 'add' : 'newGroup')}><UserPlus size={20} /></button>
      </>}
    />
  ) : (
    <ChatHeader icon={<Hash size={22} />} title={channel.name} topic={channel.topic} showMembersToggle
      membersOpen={membersOpen} onToggleMembers={onToggleMembers} />
  )

  const welcome = dm ? (
    <div className="channel-welcome">
      <DmAvatar dm={dm} profiles={profiles} me={userId} size={80} />
      <h2>{title}</h2>
      {other && <p className="dm-welcome-handle">{other.username}</p>}
      <p className="muted">
        {dm.is_group
          ? t('Bem-vindo(a) ao começo do grupo {nome}.', { nome: title })
          : t('Este é o começo do seu histórico de mensagens diretas com {nome}.', { nome: title })}
      </p>
    </div>
  ) : (
    <div className="channel-welcome">
      <div className="channel-welcome-icon"><Hash size={40} /></div>
      <h2>{t('Bem-vindo(a) a #{canal}!', { canal: channel.name })}</h2>
      <p className="muted">{t('Este é o começo do canal #{canal}.', { canal: channel.name })}</p>
    </div>
  )

  return (
    <section className="chat" {...dragHandlers}>
      {header}
      {dm && <DmCallArea dm={dm} />}
      <div className="messages" ref={listRef} onScroll={onScroll}>
        {!hasMore && welcome}
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
              <article tabIndex={-1} className={`msg ${grouped ? 'grouped' : ''} ${replyTo?.id === m.id ? 'replying' : ''} ${isForMe(m) ? 'mentioned' : ''}`}>
                {m.reply_to && (
                  <div className="msg-reply-ref">
                    <span className="reply-spine" />
                    {parent ? (
                      <>
                        <Avatar profile={profiles[parent.author_id]} size={16} />
                        <strong style={{ color: profiles[parent.author_id]?.accent_color }}>{displayName(profiles[parent.author_id])}</strong>
                        <span className="truncate">
                          {parent.content.replace(/[*_~`]/g, '') || (parent.attachments.some((a) => a.voice) ? t('Mensagem de voz') : t('Arquivo'))}
                        </span>
                      </>
                    ) : (
                      <em className="muted">{t('Mensagem original indisponível')}</em>
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
                    (m.content || m.edited_at) && (
                      <div className={`msg-content ${onlyEmojis(m.content) ? 'jumbo' : ''}`}>
                        {renderMessage(m.content)}
                        {m.edited_at && <span className="edited">{t('(editado)')}</span>}
                      </div>
                    )
                  )}
                  <Attachments list={m.attachments ?? []} />
                  <ReactionRow list={reactions[m.id] ?? []} me={userId} profiles={profiles}
                    onToggle={(e) => void toggleReaction(m, e)}
                    onAdd={(anchor) => setPicker({ anchor, messageId: m.id })} />
                  {myLast?.id === m.id && seenLabel && (
                    <span className="seen-label"><Check size={14} /> {seenLabel}</span>
                  )}
                </div>
                {editingId !== m.id && (
                  <div className="msg-actions">
                    {quickReactions().map((e) => (
                      <button key={e} className="icon-btn tiny quick-react" aria-label={t('Reagir com {emoji}', { emoji: e })}
                        onClick={() => void toggleReaction(m, e)}><EmojiGlyph value={e} size={18} /></button>
                    ))}
                    <button className="icon-btn tiny" aria-label={t('Adicionar reação')} data-tip={t('Adicionar reação')}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => setPicker(picker?.messageId === m.id ? null : { anchor: e.currentTarget.getBoundingClientRect(), messageId: m.id })}>
                      <SmilePlus size={18} />
                    </button>
                    <button className="icon-btn tiny" aria-label={t('Responder')} data-tip={t('Responder')} onClick={() => setReplyTo(m)}>
                      <CornerUpLeft size={18} />
                    </button>
                    {mine && (
                      <>
                        {!m.attachments.some((a) => a.voice) && (
                          <button className="icon-btn tiny" aria-label={t('Editar')} data-tip={t('Editar')} onClick={() => setEditingId(m.id)}>
                            <Pencil size={18} />
                          </button>
                        )}
                        <button className="icon-btn tiny danger" aria-label={t('Apagar')} data-tip={t('Apagar')} onClick={() => void remove(m)}>
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
        placeholder={placeholder}
        mentionIds={dm ? dm.member_ids : memberIds}
        replyTo={replyTo ? { name: displayName(profiles[replyTo.author_id]) } : null}
        onCancelReply={() => setReplyTo(null)}
        pending={pending}
        setPending={setPending}
        addFiles={addFiles}
        sending={sending}
        onSend={send}
        onSendVoice={sendVoice}
        onEditLast={() => {
          const last = [...messages].reverse().find((m) => m.author_id === userId && !m.attachments.some((a) => a.voice))
          if (last) setEditingId(last.id)
        }}
      />
      {dragging && (
        <div className="drop-overlay">
          <div className="drop-card">
            <Upload size={40} />
            <strong>{t('Enviar para {nome}', { nome: dm ? title : `#${channel.name}` })}</strong>
            <span>{t('Até {n} arquivos de {limite} cada', { n: MAX_FILES_PER_MESSAGE, limite: formatBytes(backend.maxUploadBytes) })}</span>
          </div>
        </div>
      )}
      {picker?.messageId && (
        <EmojiPicker anchor={picker.anchor} onClose={() => setPicker(null)}
          onPick={(e) => {
            const m = byId.get(picker.messageId!)
            if (m && !(reactions[m.id] ?? []).some((r) => r.user_id === userId && r.emoji === e)) void toggleReaction(m, e)
          }} />
      )}
      {dm && dialog === 'add' && <AddToGroupModal dm={dm} onClose={() => setDialog(null)} />}
      {dm && dialog === 'rename' && <RenameGroupModal dm={dm} onClose={() => setDialog(null)} />}
      {dm && dialog === 'newGroup' && <NewDmModal preselect={otherIds(dm, userId)} onClose={() => setDialog(null)} />}
    </section>
  )
}

function quickReactions() {
  const recent = recentEmojis()
  return [...recent, ...QUICK_REACTIONS.filter((e) => !recent.includes(e))].slice(0, 3)
}

function ReactionRow({ list, me, profiles, onToggle, onAdd }: {
  list: Reaction[]
  me: string
  profiles: Record<string, Profile>
  onToggle: (emoji: string) => void
  onAdd: (anchor: DOMRect) => void
}) {
  if (!list.length) return null
  const groups = new Map<string, Reaction[]>()
  for (const r of list) {
    if (!groups.has(r.emoji)) groups.set(r.emoji, [])
    groups.get(r.emoji)!.push(r)
  }
  return (
    <div className="reactions">
      {[...groups.entries()].map(([emoji, rs]) => {
        const mine = rs.some((r) => r.user_id === me)
        const names = rs.map((r) => (r.user_id === me ? t('você') : displayName(profiles[r.user_id])))
        const who = names.length > 3 ? t('{nomes} e mais {n}', { nomes: names.slice(0, 3).join(', '), n: names.length - 3 }) : names.join(', ')
        return (
          <button key={emoji} className={`reaction ${mine ? 'mine' : ''}`} aria-pressed={mine}
            aria-label={t('{emoji}, {n} reações. Clique para {acao}.', { emoji, n: rs.length, acao: mine ? t('tirar a sua') : t('reagir também') })}
            data-tip={who} onClick={() => onToggle(emoji)}>
            <EmojiGlyph value={emoji} size={16} />
            <span>{rs.length}</span>
          </button>
        )
      })}
      <button className="reaction add" aria-label={t('Adicionar reação')} data-tip={t('Adicionar reação')}
        onPointerDown={(e) => e.stopPropagation()} onClick={(e) => onAdd(e.currentTarget.getBoundingClientRect())}>
        <SmilePlus size={16} />
      </button>
    </div>
  )
}

/** Call de uma conversa direta: aparece em cima do chat enquanto alguém está nela. */
function DmCallArea({ dm }: { dm: DmChannel }) {
  const call = useVoice()
  const { userId, profiles, ensureProfiles } = useApp()
  const present = useVoicePresence(dm.id).filter((m) => m.channelId === dm.id)
  const joined = call.channelId === dm.id && call.status !== 'idle'
  useEffect(() => {
    if (present.length) ensureProfiles(present.map((m) => m.userId))
  }, [present, ensureProfiles])
  if (joined) return <div className="dm-call"><VoiceStage channel={dm} embedded /></div>
  if (!present.length) return null
  const first = profiles[present[0].userId]
  return (
    <div className="dm-call-ring">
      <div className="dm-call-people">
        {present.slice(0, 4).map((m) => <Avatar key={m.sessionId} profile={profiles[m.userId]} size={40} />)}
      </div>
      <strong>{present.length === 1 ? t('{nome} está na call', { nome: displayName(first) }) : t('{n} pessoas estão na call', { n: present.length })}</strong>
      <div className="row-gap">
        <button className="btn btn-success" disabled={call.status === 'connecting'} onClick={() => void voice.join(dm.id, dm.id, userId)}>
          <Phone size={16} /> {t('Entrar na call')}
        </button>
        <button className="btn btn-ghost" disabled={call.status === 'connecting'}
          onClick={() => void voice.join(dm.id, dm.id, userId).then(() => { if (voice.getSnapshot().channelId === dm.id) void voice.toggleCamera() })}>
          <Video size={16} /> {t('Entrar com vídeo')}
        </button>
      </div>
    </div>
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
        {t('Esc para')} <button className="link" onClick={onCancel}>{t('cancelar')}</button> • {t('Enter para')} <button className="link" onClick={() => onSave(value)}>{t('salvar')}</button>
      </p>
    </div>
  )
}

function AutoTextarea({
  value, onChange, onKeyDown, placeholder, autoFocus, inputRef, onCaret, onPaste,
}: {
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  autoFocus?: boolean
  inputRef?: RefObject<HTMLTextAreaElement | null>
  onCaret?: () => void
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void
}) {
  const ownRef = useRef<HTMLTextAreaElement>(null)
  const ref = inputRef ?? ownRef
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 240) + 'px'
  }, [value])
  return (
    <textarea ref={ref} rows={1} value={value} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder}
      onChange={(e) => { onChange(e.target.value); onCaret?.() }} onKeyDown={onKeyDown} onSelect={onCaret} onClick={onCaret} onPaste={onPaste} />
  )
}

function Composer({
  placeholder, mentionIds, replyTo, onCancelReply, onSend, onSendVoice, onEditLast, pending, setPending, addFiles, sending,
}: {
  placeholder: string
  mentionIds: string[]
  replyTo: { name: string } | null
  onCancelReply: () => void
  onSend: (content: string, files: PendingFile[]) => Promise<boolean>
  onSendVoice: (clip: Awaited<ReturnType<VoiceRecorder['stop']>>) => Promise<void>
  onEditLast: () => void
  pending: PendingFile[]
  setPending: (fn: (prev: PendingFile[]) => PendingFile[]) => void
  addFiles: (files: File[]) => void
  sending: string | null
}) {
  const { toast, profiles, userId } = useApp()
  const [text, setText] = useState('')
  const [query, setQuery] = useState<string | null>(null)
  const [pick, setPick] = useState(0)
  const [emojiAt, setEmojiAt] = useState<DOMRect | null>(null)
  const [rec, setRec] = useState<VoiceRecorder | null>(null)
  const [recTime, setRecTime] = useState(0)
  const [level, setLevel] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingCaret = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !ref.current) return
    ref.current.focus()
    ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  }, [text])

  // gravação: relógio e limite de tempo
  const finishRef = useRef<(send: boolean) => Promise<void>>(async () => undefined)
  useEffect(() => {
    if (!rec) return
    const id = window.setInterval(() => {
      setRecTime(rec.seconds)
      if (rec.seconds >= MAX_VOICE_SECONDS) void finishRef.current(true)
    }, 200)
    return () => window.clearInterval(id)
  }, [rec])
  useEffect(() => () => rec?.cancel(), [rec])

  const suggestions =
    query === null
      ? []
      : mentionIds
          .map((id) => profiles[id])
          .filter((p): p is Profile => !!p && p.id !== userId)
          .filter((p) => p.username.startsWith(query) || p.display_name.toLowerCase().startsWith(query))
          .slice(0, 6)

  const readCaret = () => {
    const el = ref.current
    if (!el) return
    const before = el.value.slice(0, el.selectionStart ?? el.value.length)
    const m = before.match(/(?:^|\s)@([a-z0-9_.]{0,32})$/i)
    setQuery(m ? m[1].toLowerCase() : null)
    setPick(0)
  }

  const insertAtCaret = (s: string) => {
    const el = ref.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    const next = text.slice(0, start) + s + text.slice(end)
    pendingCaret.current = start + s.length
    setText(next)
  }

  const choose = (p: Profile) => {
    const el = ref.current
    if (!el) return
    const caret = el.selectionStart ?? text.length
    const before = text.slice(0, caret).replace(/@([a-z0-9_.]{0,32})$/i, `@${p.username} `)
    const next = before + text.slice(caret)
    pendingCaret.current = before.length
    setText(next)
    setQuery(null)
  }

  const submit = async () => {
    if (sending) return
    const content = text.trim()
    if (!content && !pending.length) return
    const files = pending
    setText('')
    setQuery(null)
    const ok = await onSend(content, files)
    if (ok) setPending((prev) => prev.filter((p) => !files.includes(p)))
    else setText((cur) => cur || content)
  }

  const startRec = async () => {
    try {
      const r = await VoiceRecorder.start(setLevel)
      setRecTime(0)
      setRec(r)
    } catch (err) {
      toast((err as Error).message)
    }
  }

  const finishRec = async (sendIt: boolean) => {
    const r = rec
    if (!r) return
    setRec(null)
    if (!sendIt) {
      r.cancel()
      return
    }
    const clip = await r.stop()
    if (clip.duration < 0.7) {
      toast(t('Segure um pouco mais: a mensagem de voz ficou curta demais.'))
      return
    }
    await onSendVoice(clip)
  }

  useLayoutEffect(() => {
    finishRef.current = finishRec
  })

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files]
    if (!files.length) return
    e.preventDefault()
    addFiles(files.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `${t('imagem')}-${Date.now()}-${i}.${f.type.split('/')[1] || 'png'}`, { type: f.type }))))
  }

  const canSend = !!text.trim() || pending.length > 0

  return (
    <div className="composer-wrap">
      {suggestions.length > 0 && (
        <div className="mention-pop" role="listbox" aria-label={t('Mencionar alguém')}>
          <span className="mention-pop-title">{t('Membros')}</span>
          {suggestions.map((p, i) => (
            <button key={p.id} role="option" aria-selected={i === pick} className={`mention-option ${i === pick ? 'on' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); choose(p) }}>
              <Avatar profile={p} size={24} />
              <strong>{displayName(p)}</strong>
              <span className="muted">{p.username}</span>
            </button>
          ))}
        </div>
      )}
      {replyTo && (
        <div className="reply-bar">
          <span>{t('Respondendo a')} <strong>{replyTo.name}</strong></span>
          <button className="icon-btn tiny" aria-label={t('Cancelar resposta')} onClick={onCancelReply}><X size={16} /></button>
        </div>
      )}
      <div className={`composer ${replyTo ? 'with-reply' : ''} ${pending.length ? 'with-files' : ''}`}>
        {pending.length > 0 && (
          <div className="pending-files">
            {pending.map((p) => (
              <div key={p.id} className="pending-file">
                {p.preview ? <img src={p.preview} alt="" /> : <span className="pending-icon">{p.file.name.split('.').pop()?.slice(0, 4).toUpperCase() || '?'}</span>}
                <span className="pending-name truncate" title={p.file.name}>{p.file.name}</span>
                <span className="muted small">{formatBytes(p.file.size)}</span>
                <button className="icon-btn tiny danger pending-remove" aria-label={t('Tirar {nome}', { nome: p.file.name })} disabled={!!sending}
                  onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
        {rec ? (
          <div className="rec-bar" role="status">
            <button className="icon-btn danger" aria-label={t('Cancelar gravação')} data-tip={t('Cancelar')} onClick={() => void finishRec(false)}>
              <Trash2 size={20} />
            </button>
            <span className="rec-dot" />
            <span className="rec-time">{formatDuration(recTime)}</span>
            <span className="rec-level"><span style={{ transform: `scaleX(${Math.max(0.04, level)})` }} /></span>
            <span className="muted small rec-hint">{t('Gravando mensagem de voz…')}</span>
            <button className="btn btn-primary btn-sm" onClick={() => void finishRec(true)}>
              <Square size={12} fill="currentColor" /> {t('Enviar')}
            </button>
          </div>
        ) : (
          <div className="composer-row">
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
            <button className="icon-btn" aria-label={t('Enviar arquivo')} data-tip={t('Enviar arquivo (até {limite})', { limite: formatBytes(backend.maxUploadBytes) })}
              disabled={!!sending} onClick={() => fileRef.current?.click()}>
              <PlusCircle size={22} />
            </button>
            <AutoTextarea value={text} onChange={setText} placeholder={placeholder} inputRef={ref} onCaret={readCaret} onPaste={onPaste}
              onKeyDown={(e) => {
                if (suggestions.length) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setPick((pick + 1) % suggestions.length); return }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setPick((pick - 1 + suggestions.length) % suggestions.length); return }
                  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(suggestions[pick]); return }
                  if (e.key === 'Escape') { setQuery(null); return }
                }
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() }
                if (e.key === 'Escape') onCancelReply()
                if (e.key === 'ArrowUp' && !text) { e.preventDefault(); onEditLast() }
              }} />
            <button className="icon-btn" aria-label={t('Emojis')} data-tip={t('Emojis')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => setEmojiAt(emojiAt ? null : e.currentTarget.getBoundingClientRect())}>
              <Smile size={22} />
            </button>
            {canSend ? (
              <button className="icon-btn send-btn" aria-label={t('Enviar mensagem')} data-tip={t('Enviar')} disabled={!!sending} onClick={() => void submit()}>
                <Send size={20} />
              </button>
            ) : canRecordVoice() && (
              <button className="icon-btn" aria-label={t('Gravar mensagem de voz')} data-tip={t('Gravar mensagem de voz')} disabled={!!sending}
                onClick={() => void startRec()}>
                <Mic size={22} />
              </button>
            )}
          </div>
        )}
      </div>
      {sending && <div className="sending-bar" role="status"><span className="spinner" /> {sending}</div>}
      {emojiAt && (
        <EmojiPicker anchor={emojiAt} keepOpen onClose={() => setEmojiAt(null)} onPick={(e) => insertAtCaret(e)} />
      )}
    </div>
  )
}
