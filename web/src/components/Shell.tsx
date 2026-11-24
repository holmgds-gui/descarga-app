import { ContextMenuHost, ReportHost, UserNoteHost } from './ContextMenu'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FriendsPage, HomePage } from './Home'
import { voice } from '../lib/voice/engine'
import { useVoice } from '../lib/voice/hooks'
import { useApp } from '../state'
import { ChannelSidebar } from './ChannelSidebar'
import { ChatHeader, ChatView } from './ChatView'
import { MemberList } from './MemberList'
import { MobileTabs } from './MobileTabs'
import { ResizeHandle } from './ResizeHandle'
import { useMapaPublisher } from '../lib/mapa'
import { Modal } from './Modal'
import { ProfilePopover } from './ProfileCard'
import { ServerRail } from './ServerRail'
import { SettingsModal } from './SettingsModal'
import { VoiceStage } from './VoiceStage'
import { local } from '../lib/storage'
import { t } from '../lib/i18n'

export function Shell() {
  useMapaPublisher()
  const { homeSection, channels, activeChannelId, activeServerId, mobilePane, setMobilePane, toastMsg, question, toast, dms, activeDmId } = useApp()
  const { error: voiceError } = useVoice()
  useEffect(() => {
    if (voiceError) {
      toast(t(voiceError))
      voice.clearError()
    }
  }, [voiceError, toast])
  const [membersOpen, setMembersOpen] = useState(() => local.get('descarga-membros') !== '0')
  const [sideOpen, setSideOpen] = useState(() => local.get('descarga-lateral') !== '0')
  const toggleSide = () => setSideOpen((v) => { local.set('descarga-lateral', v ? '0' : '1'); return !v })
  const channel = channels.find((c) => c.id === activeChannelId)
  const dm = !activeServerId && activeDmId ? dms.find((d) => d.id === activeDmId) : undefined

  // celular: a barra de abas aparece nas telas de lista (Início e lista de conversas/servidores), não dentro de uma conversa
  const showTabs = mobilePane === 'nav' || (!activeServerId && !dm)

  const membersApplicable = (!!activeServerId && channel?.type === 'text') || !!dm?.is_group

  const toggleMembers = () => {
    if (window.innerWidth < 1000) {
      setMobilePane(mobilePane === 'members' ? 'chat' : 'members')
      return
    }
    setMembersOpen((v) => {
      local.set('descarga-membros', v ? '0' : '1')
      return !v
    })
  }

  return (
    <div className={`app ${showTabs ? 'has-tabs' : ''} ${sideOpen ? '' : 'side-hidden'}`} data-pane={mobilePane}>
      <div className="nav-pane">
        <ServerRail />
        <ChannelSidebar onHide={toggleSide} />
      </div>
      <div className="main-pane" onClick={() => mobilePane === 'nav' && setMobilePane('chat')}>
        {!sideOpen && (
          <button className="pane-show pane-show-side" aria-label={t('Mostrar canais')} title={t('Mostrar canais')} onClick={(e) => { e.stopPropagation(); toggleSide() }}>
            <ChevronRight size={18} />
          </button>
        )}
        {membersApplicable && !membersOpen && (
          <button className="pane-show pane-show-members" aria-label={t('Mostrar membros')} title={t('Mostrar membros')} onClick={(e) => { e.stopPropagation(); toggleMembers() }}>
            <ChevronLeft size={18} />
          </button>
        )}
        {!activeServerId ? (
          dm ? (
            <ChatView key={dm.id} channel={dm} dm={dm} membersOpen={membersOpen} onToggleMembers={toggleMembers} />
          ) : (
            homeSection === 'amigos' ? <FriendsPage /> : <HomePage />
          )
        ) : !channel ? (
          <EmptyServer />
        ) : channel.type === 'voice' ? (
          <VoiceStage channel={channel} />
        ) : (
          <ChatView channel={channel} membersOpen={membersOpen} onToggleMembers={toggleMembers} />
        )}
      </div>
      {activeServerId && channel?.type === 'text' && (membersOpen || mobilePane === 'members') && (
        <div className="members-pane">
          <ResizeHandle panel="members" />
          <button className="pane-hide pane-hide-members" aria-label={t('Esconder membros')} title={t('Esconder membros')} onClick={toggleMembers}><ChevronRight size={18} /></button>
          <MemberList />
        </div>
      )}
      {dm?.is_group && (membersOpen || mobilePane === 'members') && (
        <div className="members-pane">
          <ResizeHandle panel="members" />
          <button className="pane-hide pane-hide-members" aria-label={t('Esconder membros')} title={t('Esconder membros')} onClick={toggleMembers}><ChevronRight size={18} /></button>
          <MemberList ids={dm.member_ids} ownerId={dm.owner_id} />
        </div>
      )}
      {mobilePane === 'members' && <div className="mobile-scrim" onClick={() => setMobilePane('chat')} />}
      {showTabs && <MobileTabs />}
      <ProfilePopover />
      <SettingsModal />
      <ContextMenuHost />
      <UserNoteHost />
      <ReportHost />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      {question && (
        <Modal title={question.title} onClose={() => question.resolve(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => question.resolve(false)}>{t('Cancelar')}</button>
            <button className={`btn ${question.danger ? 'btn-danger' : 'btn-primary'}`} autoFocus onClick={() => question.resolve(true)}>{question.confirmLabel}</button>
          </>}>
          <p className="muted confirm-text">{question.message}</p>
        </Modal>
      )}
    </div>
  )
}


function EmptyServer() {
  return (
    <section className="chat">
      <ChatHeader icon={null} title="" />
      <div className="empty-state">
        <p className="muted">{t('Este servidor ainda não tem canais de texto.')}</p>
      </div>
    </section>
  )
}
