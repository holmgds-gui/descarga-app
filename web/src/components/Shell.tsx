import { ContextMenuHost, ReportHost, UserNoteHost } from './ContextMenu'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FriendsPage, HomePage } from './Home'
import { voice } from '../lib/voice/engine'
import { useVoice } from '../lib/voice/hooks'
import { useApp } from '../state'
import { ChannelSidebar } from './ChannelSidebar'
import { IncomingCall } from './IncomingCall'
import { ChatHeader, ChatView } from './ChatView'
import { MemberList } from './MemberList'
import { DmProfilePanel } from './ProfileCard'
import { MobileTabs } from './MobileTabs'
import { ResizeHandle } from './ResizeHandle'
import { useMapaPublisher } from '../lib/mapa'
import { Modal } from './Modal'
import { ProfilePopover } from './ProfileCard'
import { UserPanel } from './UserPanel'
import { ServerRail } from './ServerRail'
import { SettingsModal } from './SettingsModal'
import { VoiceStage } from './VoiceStage'
import { local } from '../lib/storage'
import { MobileGestures } from './MobileGestures'
import { t } from '../lib/i18n'

export function Shell() {
  useMapaPublisher()
  const { homeSection, channels, activeChannelId, activeServerId, mobilePane, setMobilePane, toastMsg, question, toast, dms, activeDmId, userId } = useApp()
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

  const dmOther = dm && !dm.is_group ? dm.member_ids.find((id) => id !== userId) : undefined
  const membersApplicable = (!!activeServerId && channel?.type === 'text') || !!dm?.is_group || !!dmOther

  // telas estreitas: a lista de membros/perfil é uma gaveta que fica sempre montada, para acompanhar o dedo
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1000)
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 1000)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const showMembers = membersOpen || mobilePane === 'members' || narrow

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
        <UserPanel />
        {!sideOpen && (
          <div className="pane-strip pane-strip-side">
            <button className="pane-show" aria-label={t('Mostrar canais')} title={t('Mostrar canais')} onClick={toggleSide}><ChevronRight size={18} /></button>
          </div>
        )}
      </div>
      <div className="main-pane" onClick={() => mobilePane === 'nav' && setMobilePane('chat')}>
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
      {activeServerId && channel?.type === 'text' && showMembers && (
        <div className="members-pane">
          <ResizeHandle panel="members" />
          <div className="pane-bar">
            <button className="pane-hide pane-hide-members" aria-label={t('Esconder membros')} title={t('Esconder membros')} onClick={toggleMembers}><ChevronRight size={18} /></button>
          </div>
          <MemberList />
        </div>
      )}
      {dm?.is_group && showMembers && (
        <div className="members-pane">
          <ResizeHandle panel="members" />
          <div className="pane-bar">
            <button className="pane-hide pane-hide-members" aria-label={t('Esconder membros')} title={t('Esconder membros')} onClick={toggleMembers}><ChevronRight size={18} /></button>
          </div>
          <MemberList ids={dm.member_ids} ownerId={dm.owner_id} />
        </div>
      )}
      {dmOther && showMembers && (
        <div className="members-pane dm-profile-pane">
          <ResizeHandle panel="members" />
          <div className="pane-bar">
            <button className="pane-hide pane-hide-members" aria-label={t('Esconder perfil')} title={t('Esconder perfil')} onClick={toggleMembers}><ChevronRight size={18} /></button>
          </div>
          <DmProfilePanel otherId={dmOther} />
        </div>
      )}
      {membersApplicable && !membersOpen && (
        <div className="pane-strip pane-strip-members">
          <button className="pane-show" aria-label={t('Mostrar membros')} title={t('Mostrar membros')} onClick={toggleMembers}><ChevronLeft size={18} /></button>
        </div>
      )}
      {narrow && membersApplicable && <div className="mobile-scrim" onClick={() => setMobilePane('chat')} />}
      <MobileGestures membersApplicable={membersApplicable} />
      {showTabs && <MobileTabs />}
      <IncomingCall />
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
