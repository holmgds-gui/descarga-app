import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { Copy, MessageCircle, User } from 'lucide-react'
import { useApp } from '../state'
import { t } from '../lib/i18n'
import type { Profile } from '../lib/types'

/** Menu do botão direito do Descarga (no lugar do menu do navegador). */
export interface MenuItem {
  label: string
  icon?: ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  /** linha de separação antes deste item */
  separator?: boolean
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

/** Menu padrão de uma pessoa: ver perfil, mandar mensagem, copiar o nome de usuário. */
export function useUserMenu() {
  const { openProfile, openDmWith, userId, toast } = useApp()
  return (e: ReactMouseEvent, p: Profile | null | undefined, extra: MenuItem[] = []) => {
    if (!p || p.deleted_at) {
      if (extra.length) showContextMenu(e, extra)
      return
    }
    const at = new DOMRect(e.clientX, e.clientY, 0, 0)
    showContextMenu(e, [
      ...extra,
      { label: t('Ver perfil'), icon: <User size={16} />, onClick: () => openProfile(p.id, at), separator: extra.length > 0 },
      ...(p.id !== userId ? [{ label: t('Mandar mensagem'), icon: <MessageCircle size={16} />, onClick: () => void openDmWith([p.id]).catch((err: Error) => toast(err.message)) }] : []),
      { label: t('Copiar nome de usuário'), icon: <Copy size={16} />, onClick: () => copyText(p.username, toast) },
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
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

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
    setPos({
      left: Math.max(6, Math.min(open.x, window.innerWidth - r.width - 6)),
      top: Math.max(6, Math.min(open.y, window.innerHeight - r.height - 6)),
    })
  }, [open])

  if (!open) return null
  return (
    <div ref={ref} className="dropdown ctx-menu" role="menu" style={{ left: pos?.left ?? open.x, top: pos?.top ?? open.y, visibility: pos ? 'visible' : 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}>
      {open.items.map((it, i) => (
        <div key={i} role="none">
          {it.separator && i > 0 && <div className="dropdown-sep" />}
          <button role="menuitem" className={`dropdown-item ${it.danger ? 'danger' : ''}`} disabled={it.disabled}
            onClick={() => { closeContextMenu(); it.onClick?.() }}>
            {it.icon}{it.label}
          </button>
        </div>
      ))}
    </div>
  )
}
