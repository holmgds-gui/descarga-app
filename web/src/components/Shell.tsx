import { useEffect, useState } from 'react'
import { voice } from '../lib/voice/engine'
import { useVoice } from '../lib/voice/hooks'
import { useApp } from '../state'
import { ChannelSidebar } from './ChannelSidebar'
import { ChatHeader, ChatView } from './ChatView'
import { MemberList } from './MemberList'
import { Modal } from './Modal'
import { ProfilePopover } from './ProfileCard'
import { ServerRail } from './ServerRail'
import { SettingsModal } from './SettingsModal'
import { VoiceStage } from './VoiceStage'
import { local } from '../lib/storage'
import { t } from '../lib/i18n'

export function Shell() {
  const { channels, activeChannelId, activeServerId, mobilePane, setMobilePane, toastMsg, question, toast } = useApp()
  const { error: voiceError } = useVoice()
  useEffect(() => {
    if (voiceError) {
      toast(t(voiceError))
      voice.clearError()
    }
  }, [voiceError, toast])
  const [membersOpen, setMembersOpen] = useState(() => local.get('descarga-membros') !== '0')
  const channel = channels.find((c) => c.id === activeChannelId)

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
    <div className="app" data-pane={mobilePane}>
      <div className="nav-pane">
        <ServerRail />
        <ChannelSidebar />
      </div>
      <div className="main-pane" onClick={() => mobilePane === 'nav' && setMobilePane('chat')}>
        {!activeServerId ? (
          <Home />
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
          <MemberList />
        </div>
      )}
      {mobilePane === 'members' && <div className="mobile-scrim" onClick={() => setMobilePane('chat')} />}
      <ProfilePopover />
      <SettingsModal />
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

function Home() {
  const { me } = useApp()
  return (
    <section className="chat">
      <ChatHeader icon={<img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={24} height={24} />} title={t('Início')} />
      <div className="empty-state">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={180} height={180} />
        <h2>{t('E aí, {nome}!', { nome: me?.display_name || me?.username || '' })}</h2>
        <p className="muted">{t('Escolha um servidor à esquerda, ou crie o seu no botão +.')}</p>
        <p className="muted small">{t('Amigos e mensagens diretas chegam na etapa 3.')}</p>
      </div>
    </section>
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
