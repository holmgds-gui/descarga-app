import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { AtSign, Check, ChevronRight, Copy, EyeOff, Eye, Fingerprint, MessageCircle, Pencil, Send, ShieldCheck, StickyNote, User, UserMinus } from 'lucide-react'
import { useApp } from '../state'
import { t } from '../lib/i18n'
import type { Profile, Server } from '../lib/types'
import { backend } from '../lib/backend'
import { useServerRole } from './ServerSettings'
import { Modal } from './Modal'
import { realName } from './Avatar'

/** Menu do botão direito do Descarga (no lugar do menu do navegador). */
export interface MenuItem {
  label: string
  icon?: ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  /** linha de separação antes deste item */
  separator?: boolean
  /** submenu (abre ao passar o mouse ou clicar) */
  children?: MenuItem[]
  /** mostra um ✓ (ex.: cargo que a pessoa já tem) */
  checked?: boolean
  /** bolinha colorida antes do texto */
  color?: string
}

interface Open { x: number; y: number; items: MenuItem[] }
let current: Open | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function closeContextMenu() {
  if (!current) return
  current = null
  emit()
}

/** Abre o menu na posição do clique. Chame dentro de um onContextMenu. */
export function showContextMenu(e: ReactMouseEvent | MouseEvent, items: MenuItem[]) {
  e.preventDefault()
  e.stopPropagation()
  const list = items.filter((i) => i.label)
  if (!list.length) return
  current = { x: e.clientX, y: e.clientY, items: list }
  emit()
}

// ---------- nota e apelido ----------
interface NoteOpen { userId: string; focus: 'note' | 'nickname' }
let noteOpen: NoteOpen | null = null
const noteListeners = new Set<() => void>()
const noteSubscribe = (cb: () => void) => {
  noteListeners.add(cb)
  return () => noteListeners.delete(cb)
}
function setNoteOpen(v: NoteOpen | null) {
  noteOpen = v
  noteListeners.forEach((l) => l())
}

/** Janela para escrever a nota e o apelido que EU dou a alguém (só eu vejo). */
export function UserNoteHost() {
  const open = useSyncExternalStore(noteSubscribe, () => noteOpen)
  const { profiles, notes, setNote, toast } = useApp()
  const [nickname, setNickname] = useState('')
  const [note, setNoteText] = useState('')
  const [busy, setBusy] = useState(false)
  const uid = open?.userId
  useEffect(() => {
    if (!uid) return
    setNickname(notes[uid]?.nickname ?? '')
    setNoteText(notes[uid]?.note ?? '')
    // só ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])
  if (!open || !uid) return null
  const p = profiles[uid]
  const save = async () => {
    setBusy(true)
    try {
      await setNote(uid, { nickname, note })
      toast(t('Salvo'))
      setNoteOpen(null)
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={t('Nota e apelido')} subtitle={t('Só você vê isto. {nome} não fica sabendo.', { nome: realName(p) })} onClose={() => setNoteOpen(null)}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <label>
          {t('Apelido')}
          <input value={nickname} maxLength={32} autoFocus={open.focus === 'nickname'} onChange={(e) => setNickname(e.target.value)} placeholder={realName(p)} />
        </label>
        <label>
          {t('Nota')}
          <textarea value={note} maxLength={256} rows={4} autoFocus={open.focus === 'note'} onChange={(e) => setNoteText(e.target.value)} placeholder={t('Clique para adicionar uma nota')} />
          <span className="muted small">{note.length}/256</span>
        </label>
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={() => setNoteOpen(null)}>{t('Cancelar')}</button>
          <button className="btn btn-primary" disabled={busy}>{t('Salvar')}</button>
        </div>
      </form>
    </Modal>
  )
}

/** Menu de uma pessoa (botão direito no nome): perfil, mensagem, mencionar, nota, apelido, convite, amizade, ignorar, cargos, copiar ID. */
export function useUserMenu() {
  const { openProfile, openDmWith, userId, toast, notes, ignored, toggleIgnored, friendships, refreshFriends, refreshDms, ask, servers, activeServerId } = useApp()
  const server = servers.find((s) => s.id === activeServerId)
  const access = useServerRole(server)
  return (e: ReactMouseEvent, p: Profile | null | undefined, extra: MenuItem[] = []) => {
    if (!p || p.deleted_at) {
      if (extra.length) showContextMenu(e, extra)
      return
    }
    const at = new DOMRect(e.clientX, e.clientY, 0, 0)
    const mine = p.id === userId
    const friend = friendships.find((f) => f.status === 'accepted' && ((f.requester === userId && f.addressee === p.id) || (f.requester === p.id && f.addressee === userId)))
    const hasNote = !!notes[p.id]?.note
    const hasNick = !!notes[p.id]?.nickname
    const canMention = !!document.querySelector('.composer-wrap textarea')

    const invite = async (s: Server) => {
      try {
        const dmId = await backend.openDm([p.id])
        const link = `${location.origin}${location.pathname}?convite=${s.invite_code}`
        const m = await backend.sendMessage(dmId, t('Convite para o servidor {nome}: {link}', { nome: s.name, link }), null)
        void backend.notify({ type: 'message', messageId: m.id }).catch(() => undefined)
        void refreshDms()
        toast(t('Convite enviado'))
      } catch (err) {
        toast((err as Error).message)
      }
    }

    const unfriend = async () => {
      if (!friend) return
      const ok = await ask({
        title: t('Remover {nome}', { nome: realName(p) }),
        message: t('Tem certeza de que quer remover {nome} dos seus amigos?', { nome: realName(p) }),
        confirmLabel: t('Remover amizade'),
        danger: true,
      })
      if (!ok) return
      try {
        await backend.removeFriendship(friend.id)
        await refreshFriends()
      } catch (err) {
        toast((err as Error).message)
      }
    }

    // cargos: dono ou quem tem "gerenciar cargos"; só em quem é do servidor e não é o dono
    // (o dono pode se dar cargos, por exemplo para ter a cor do nome; ninguém mais mexe nos próprios cargos nem nos do dono)
    const showRoles = !!server && access.can('manage_roles') && p.id in access.members && (mine ? access.isOwner : p.id !== server.owner_id)
    const roleItems: MenuItem[] = access.roleDefs.length
      ? access.roleDefs.map((r) => {
          const has = !!access.members[p.id]?.includes(r.id)
          const blocked = !access.isOwner && !r.permissions.every((perm) => access.can(perm))
          return {
            label: r.name,
            color: r.color,
            checked: has,
            disabled: blocked,
            onClick: () => void backend.setMemberRole(server!.id, p.id, r.id, !has).catch((err: Error) => toast(err.message)),
          }
        })
      : [{ label: t('Nenhum cargo criado ainda'), disabled: true }]

    showContextMenu(e, [
      ...extra,
      { label: t('Ver perfil'), icon: <User size={16} />, onClick: () => openProfile(p.id, at), separator: extra.length > 0 },
      ...(!mine ? [{ label: t('Mandar mensagem'), icon: <MessageCircle size={16} />, onClick: () => void openDmWith([p.id]).catch((err: Error) => toast(err.message)) }] : []),
      ...(canMention ? [{ label: t('Mencionar'), icon: <AtSign size={16} />, onClick: () => window.dispatchEvent(new CustomEvent('descarga-mention', { detail: p.username })) }] : []),
      ...(!mine ? [
        { label: hasNote ? t('Editar nota') : t('Adicionar nota'), icon: <StickyNote size={16} />, separator: true, onClick: () => setNoteOpen({ userId: p.id, focus: 'note' as const }) },
        { label: hasNick ? t('Editar apelido') : t('Adicionar apelido'), icon: <Pencil size={16} />, onClick: () => setNoteOpen({ userId: p.id, focus: 'nickname' as const }) },
        ...(servers.length ? [{
          label: t('Convidar para o servidor'), icon: <Send size={16} />, separator: true,
          children: servers.map((s) => ({ label: s.name, onClick: () => void invite(s) })),
        }] : []),
        ...(friend ? [{ label: t('Desfazer amizade'), icon: <UserMinus size={16} />, onClick: () => void unfriend() }] : []),
        { label: ignored.has(p.id) ? t('Parar de ignorar') : t('Ignorar'), icon: ignored.has(p.id) ? <Eye size={16} /> : <EyeOff size={16} />, onClick: () => { toggleIgnored(p.id); toast(ignored.has(p.id) ? t('Você voltou a ver {nome}', { nome: realName(p) }) : t('Mensagens de {nome} escondidas', { nome: realName(p) })) } },
      ] : []),
      ...(showRoles ? [{ label: t('Cargos'), icon: <ShieldCheck size={16} />, separator: true, children: roleItems }] : []),
      { label: t('Copiar nome de usuário'), icon: <Copy size={16} />, separator: true, onClick: () => copyText(p.username, toast) },
      { label: t('Copiar ID do usuário'), icon: <Fingerprint size={16} />, onClick: () => copyText(p.id, toast) },
    ])
  }
}

export function copyText(text: string, toast?: (m: string) => void) {
  const done = () => toast?.(t('Copiado'))
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => undefined)
  else {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      done()
    } finally {
      ta.remove()
    }
  }
}

export function ContextMenuHost() {
  const open = useSyncExternalStore(subscribe, () => current)
  const { toast } = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; flip: boolean } | null>(null)
  const [sub, setSub] = useState<number | null>(null)

  // por padrão o menu do navegador nunca aparece em cima do app; em campos de texto ele fica (colar, corrigir)
  useEffect(() => {
    const onNative = (e: MouseEvent) => {
      if (e.defaultPrevented) return
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, [contenteditable="true"]')) return
      e.preventDefault()
      const sel = window.getSelection()?.toString().trim()
      if (sel) showContextMenu(e, [{ label: t('Copiar'), icon: <Copy size={16} />, onClick: () => copyText(sel, toast) }])
    }
    document.addEventListener('contextmenu', onNative)
    return () => document.removeEventListener('contextmenu', onNative)
  }, [toast])

  useEffect(() => {
    if (!open) return
    const close = () => closeContextMenu()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
        const i = btns.indexOf(document.activeElement as HTMLButtonElement)
        btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    window.addEventListener('wheel', close, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('wheel', close)
    }
  }, [open])

  // mantém o menu dentro da tela
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const left = Math.max(6, Math.min(open.x, window.innerWidth - r.width - 6))
    setSub(null)
    setPos({
      left,
      top: Math.max(6, Math.min(open.y, window.innerHeight - r.height - 6)),
      flip: left + r.width + 230 > window.innerWidth,
    })
  }, [open])

  if (!open) return null
  return (
    <div ref={ref} className="dropdown ctx-menu" role="menu" style={{ left: pos?.left ?? open.x, top: pos?.top ?? open.y, visibility: pos ? 'visible' : 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}>
      {open.items.map((it, i) => (
        <div key={i} role="none" className="ctx-row" onMouseEnter={() => setSub(it.children ? i : null)}>
          {it.separator && i > 0 && <div className="dropdown-sep" />}
          <button role="menuitem" aria-haspopup={it.children ? 'menu' : undefined} aria-expanded={it.children ? sub === i : undefined}
            className={`dropdown-item ${it.danger ? 'danger' : ''}`} disabled={it.disabled}
            onClick={() => { if (it.children) { setSub(i); return } closeContextMenu(); it.onClick?.() }}>
            {it.icon}{it.color && <span className="ctx-dot" style={{ background: it.color }} />}
            <span className="ctx-label">{it.label}</span>
            {it.checked && <Check size={15} className="ctx-check" />}
            {it.children && <ChevronRight size={15} className="ctx-chev" />}
          </button>
          {it.children && sub === i && (
            <div className={`dropdown ctx-sub ${pos?.flip ? 'flip' : ''}`} role="menu">
              {it.children.map((c, j) => (
                <button key={j} role="menuitem" className="dropdown-item" disabled={c.disabled} onClick={() => { closeContextMenu(); c.onClick?.() }}>
                  {c.color && <span className="ctx-dot" style={{ background: c.color }} />}
                  <span className="ctx-label">{c.label}</span>
                  {c.checked && <Check size={15} className="ctx-check" />}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
