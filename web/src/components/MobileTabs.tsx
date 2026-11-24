import { House, MessageCircle, Server, UserRound } from 'lucide-react'
import { useApp } from '../state'
import { t } from '../lib/i18n'

/** Barra de abas do celular (como no Discord novo): Início, Conversas, Servidores e Você. Só aparece nas telas de lista. */
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
  return (
    <nav className="mobile-tabs" aria-label={t('Navegação')}>
      {tabs.map((x) => (
        <button key={x.id} className={`mtab ${x.active ? 'on' : ''}`} onClick={x.onClick} aria-current={x.active ? 'page' : undefined}>
          <span className="mtab-icon">{x.icon}{x.badge > 0 && <span className="mtab-badge">{x.badge > 9 ? '9+' : x.badge}</span>}</span>
          <span className="mtab-label">{x.label}</span>
        </button>
      ))}
    </nav>
  )
}
