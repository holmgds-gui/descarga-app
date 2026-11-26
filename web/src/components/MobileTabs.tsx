import { useRef, useState } from 'react'
import { House, MessageCircle, Server, UserRound } from 'lucide-react'
import { useApp } from '../state'
import { t } from '../lib/i18n'
import { haptic } from '../lib/haptics'

/** Barra de abas do celular (como nos apps modernos): Início, Conversas, Servidores e Você. Só aparece nas telas de lista. */
export function MobileTabs() {
  const { servers, activeServerId, setActiveServerId, goHome, mobilePane, setMobilePane, setSettingsOpen, unreadDms, friendships, userId, activeDmId } = useApp()
  const pending = friendships.filter((f) => f.status === 'pending' && f.addressee === userId).length
  const inHome = !activeServerId && !activeDmId

  const tabs = [
    {
      id: 'inicio', label: t('Início'), icon: <House size={22} />, active: inHome && mobilePane !== 'nav',
      badge: 0, onClick: () => goHome(),
    },
    {
      id: 'conversas', label: t('Conversas'), icon: <MessageCircle size={22} />, active: inHome && mobilePane === 'nav',
      badge: unreadDms.size + pending, onClick: () => { goHome(); setMobilePane('nav') },
    },
    {
      id: 'servidores', label: t('Servidores'), icon: <Server size={22} />, active: !!activeServerId,
      badge: 0, onClick: () => { if (!activeServerId && servers[0]) setActiveServerId(servers[0].id); setMobilePane('nav') },
    },
    {
      id: 'voce', label: t('Você'), icon: <UserRound size={22} />, active: false,
      badge: 0, onClick: () => setSettingsOpen(true),
    },
  ]
  // arrastar o dedo pelas abas: a aba sob o dedo acende e, ao soltar, abre
  const [scrub, setScrub] = useState<string | null>(null)
  const down = useRef<{ id: string | null; moved: boolean } | null>(null)
  const tabAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('.mtab')?.dataset.tab ?? null
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    down.current = { id: tabAt(e.clientX, e.clientY), moved: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = down.current
    if (!d) return
    const id = tabAt(e.clientX, e.clientY)
    if (id !== d.id) d.moved = true
    if (d.moved && id !== scrub) { setScrub(id); haptic(5) }
  }
  const onUp = (e: React.PointerEvent) => {
    const d = down.current
    down.current = null
    if (!d?.moved) { setScrub(null); return }
    const id = tabAt(e.clientX, e.clientY)
    setScrub(null)
    if (id && id !== d.id) { haptic(10); tabs.find((x) => x.id === id)?.onClick() }
  }
  return (
    <nav className="mobile-tabs" aria-label={t('Navegação')} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { down.current = null; setScrub(null) }}>
      {tabs.map((x) => (
        <button key={x.id} data-tab={x.id} className={`mtab ${x.active ? 'on' : ''} ${scrub === x.id ? 'scrub' : ''}`} onClick={x.onClick} aria-current={x.active ? 'page' : undefined}>
          <span className="mtab-icon">{x.icon}{x.badge > 0 && <span className="mtab-badge">{x.badge > 9 ? '9+' : x.badge}</span>}</span>
          <span className="mtab-label">{x.label}</span>
        </button>
      ))}
    </nav>
  )
}
