import { Monitor, MonitorOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import { canShareScreen, voice } from '../lib/voice/engine'
import { useVoice } from '../lib/voice/hooks'
import { useApp } from '../state'

/** "Voz conectada": aparece acima do seu perfil enquanto você está numa call. */
export function VoiceConnectedPanel() {
  const call = useVoice()
  const { servers, setActiveServerId, setActiveChannelId } = useApp()
  if (call.status === 'idle' || !call.channelId) return null
  const server = servers.find((s) => s.id === call.serverId)
  const connecting = call.status === 'connecting'
  const others = call.members.filter((m) => m.sessionId !== call.sessionId)
  const failed = others.filter((m) => call.media[m.sessionId]?.connection === 'failed').length

  const goToCall = () => {
    if (call.serverId) setActiveServerId(call.serverId)
    if (call.channelId) setActiveChannelId(call.channelId)
  }

  return (
    <div className="voice-panel">
      <div className="voice-panel-top">
        <button className="voice-panel-info" onClick={goToCall}>
          <strong className={connecting ? 'warn' : failed ? 'danger' : 'ok'}>
            {connecting ? 'Conectando…' : failed ? 'Problema de conexão' : 'Voz conectada'}
          </strong>
          <span className="truncate">{server?.name ?? 'Call'}</span>
        </button>
        <button className="icon-btn danger" aria-label="Sair da call" data-tip="Sair da call" onClick={() => void voice.leave()}>
          <PhoneOff size={18} />
        </button>
      </div>
      <div className="voice-panel-actions">
        <button className={`btn btn-ghost btn-sm ${call.camera ? 'on' : ''}`} onClick={() => void voice.toggleCamera()}>
          {call.camera ? <VideoOff size={16} /> : <Video size={16} />} {call.camera ? 'Desligar' : 'Câmera'}
        </button>
        {(canShareScreen() || call.screen) && (
          <button className={`btn btn-ghost btn-sm ${call.screen ? 'on' : ''}`}
            onClick={() => (call.screen ? voice.stopScreen() : void voice.startScreen(call.settings.screenQuality))}>
            {call.screen ? <MonitorOff size={16} /> : <Monitor size={16} />} {call.screen ? 'Parar' : 'Tela'}
          </button>
        )}
      </div>
    </div>
  )
}
