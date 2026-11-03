import { useState } from 'react'
import { Monitor, Mic, PhoneCall, Video, Volume2 } from 'lucide-react'
import { useApp } from '../state'
import { ChannelSidebar } from './ChannelSidebar'
import { ChatHeader, ChatView } from './ChatView'
import { MemberList } from './MemberList'
import { Modal } from './Modal'
import { ProfilePopover } from './ProfileCard'
import { ServerRail } from './ServerRail'
import { SettingsModal } from './SettingsModal'
import type { Channel } from '../lib/types'
import { local } from '../lib/storage'

export function Shell() {
  const { channels, activeChannelId, activeServerId, mobilePane, setMobilePane, toastMsg, question } = useApp()
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
          <VoicePreview channel={channel} />
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
            <button className="btn btn-ghost" onClick={() => question.resolve(false)}>Cancelar</button>
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
      <ChatHeader icon={<img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={24} height={24} />} title="Início" />
      <div className="empty-state">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={180} height={180} />
        <h2>E aí, {me?.display_name || me?.username}!</h2>
        <p className="muted">Escolha um servidor à esquerda, ou crie o seu no botão <strong>+</strong>.</p>
        <p className="muted small">Amigos e mensagens diretas chegam na etapa 3.</p>
      </div>
    </section>
  )
}

function EmptyServer() {
  return (
    <section className="chat">
      <ChatHeader icon={null} title="" />
      <div className="empty-state">
        <p className="muted">Este servidor ainda não tem canais de texto.</p>
      </div>
    </section>
  )
}

function VoicePreview({ channel }: { channel: Channel }) {
  const { toast } = useApp()
  const soon = () => toast('Chamadas de voz, vídeo e tela chegam na etapa 2')
  return (
    <section className="chat voice-stage">
      <ChatHeader icon={<Volume2 size={22} />} title={channel.name} />
      <div className="voice-center">
        <div className="voice-icon"><Volume2 size={44} /></div>
        <h2>{channel.name}</h2>
        <p className="muted">Ninguém está na call ainda.</p>
        <button className="btn btn-success btn-lg" onClick={soon}><PhoneCall size={18} /> Entrar na call</button>
        <div className="voice-controls" aria-hidden="true">
          <span><Mic size={20} /></span>
          <span><Video size={20} /></span>
          <span><Monitor size={20} /></span>
        </div>
        <p className="muted small">Voz, vídeo e compartilhamento de tela com som em 1080p/60fps estão chegando na etapa 2.</p>
      </div>
    </section>
  )
}
