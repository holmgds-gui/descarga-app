import { useEffect, useRef, useState } from 'react'
import {
  HeadphoneOff, Headphones, Maximize2, Mic, MicOff, Monitor, MonitorOff, PhoneCall, PhoneOff, Video, VideoOff,
  RefreshCw, Server, Volume2, VolumeX, Wifi, WifiOff,
} from 'lucide-react'
import { MAX_IN_CALL, canShareScreen, voice, type CallMember } from '../lib/voice/engine'
import { useVoice, useVoicePresence } from '../lib/voice/hooks'
import { SCREEN_PRESETS, keyLabel, type ScreenQuality } from '../lib/voice/settings'
import type { Channel } from '../lib/types'
import { useApp } from '../state'
import { Avatar, displayName } from './Avatar'
import { ChatHeader } from './ChatView'
import { t as tr } from '../lib/i18n'

function VideoView({ stream, mirror = false, muted = true, contain = false }: { stream: MediaStream; mirror?: boolean; muted?: boolean; contain?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return (
    <video ref={ref} autoPlay playsInline muted={muted}
      className={`tile-video ${mirror ? 'mirror' : ''} ${contain ? 'contain' : ''}`} />
  )
}

interface Tile {
  id: string
  member: CallMember
  kind: 'person' | 'screen'
  stream: MediaStream | null
  mine: boolean
}

export function VoiceStage({ channel }: { channel: Channel }) {
  const call = useVoice()
  const { profiles, userId, ensureProfiles } = useApp()
  const present = useVoicePresence(channel.server_id).filter((m) => m.channelId === channel.id)
  const joined = call.channelId === channel.id && call.status !== 'idle'
  const [focus, setFocus] = useState<string | null>(null)
  const [qualityOpen, setQualityOpen] = useState(false)
  const [volumeFor, setVolumeFor] = useState<string | null>(null)

  const members = joined ? call.members : present
  useEffect(() => {
    ensureProfiles(members.map((m) => m.userId))
  }, [members, ensureProfiles])

  if (!joined) {
    return (
      <section className="chat voice-stage">
        <ChatHeader icon={<Volume2 size={22} />} title={channel.name} />
        <div className="voice-center">
          <div className="voice-icon"><Volume2 size={44} /></div>
          <h2>{channel.name}</h2>
          {present.length ? (
            <div className="voice-preview-people">
              {present.map((m) => <Avatar key={m.sessionId} profile={profiles[m.userId]} size={48} />)}
            </div>
          ) : (
            <p className="muted">{tr('Ninguém está na call ainda.')}</p>
          )}
          <button className="btn btn-success btn-lg" disabled={call.status === 'connecting' || present.length >= MAX_IN_CALL}
            onClick={() => void voice.join(channel.id, channel.server_id, userId)}>
            <PhoneCall size={18} /> {present.length >= MAX_IN_CALL ? tr('Call cheia') : tr('Entrar na call')}
          </button>
          <p className="muted small">{tr('Chamadas direto entre os aparelhos • até {n} pessoas • grátis', { n: MAX_IN_CALL })}</p>
        </div>
      </section>
    )
  }

  const tiles: Tile[] = []
  for (const m of call.members) {
    const mine = m.sessionId === call.sessionId
    const media = call.media[m.sessionId]
    const cam = mine ? call.camera : m.camera ? media?.camera ?? null : null
    tiles.push({ id: `p-${m.sessionId}`, member: m, kind: 'person', stream: cam, mine })
    const scr = mine ? call.screen : m.screen ? media?.screen ?? null : null
    if (scr || (m.screen && !mine)) tiles.push({ id: `s-${m.sessionId}`, member: m, kind: 'screen', stream: scr, mine })
  }
  const focusTile = tiles.find((t) => t.id === focus) ?? (tiles.find((t) => t.kind === 'screen' && !t.mine) ?? null)
  const rest = focusTile ? tiles.filter((t) => t !== focusTile) : tiles

  const share = (q: ScreenQuality) => {
    setQualityOpen(false)
    void voice.startScreen(q)
  }

  const renderTile = (t: Tile, big = false) => {
    const p = profiles[t.member.userId]
    const speaking = t.kind === 'person' && call.speaking[t.member.sessionId]
    const conn = call.media[t.member.sessionId]?.connection
    const vol = Math.round(Math.min(1, call.settings.volumes[t.member.userId] ?? 1) * 100)
    const broken = !t.mine && (conn === 'failed' || conn === 'disconnected')
    const pending = !t.mine && (!conn || conn === 'new' || conn === 'connecting')
    return (
      <div key={t.id} className={`tile ${big ? 'tile-big' : ''} ${speaking ? 'speaking' : ''} ${t.kind}`}
        style={{ ['--tile-color' as string]: p?.accent_color ?? 'var(--accent)' }}
        onClick={() => setFocus(focusTile?.id === t.id ? null : t.id)}>
        {t.mine && t.kind === 'screen' ? (
          // não mostra a própria tela aqui dentro (evita o efeito de "tela dentro da tela")
          <div className="tile-waiting">
            <Monitor size={28} />
            <span>{tr('Você está compartilhando sua tela')}</span>
            <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); voice.stopScreen() }}>
              <MonitorOff size={16} /> {tr('Parar')}
            </button>
          </div>
        ) : t.stream ? (
          <VideoView stream={t.stream} mirror={t.mine && t.kind === 'person'} contain={t.kind === 'screen'} />
        ) : t.kind === 'screen' ? (
          <div className="tile-waiting">
            <Monitor size={28} />
            <span>{broken ? tr('Sem conexão com essa pessoa') : tr('Carregando a tela…')}</span>
          </div>
        ) : (
          <div className="tile-avatar"><Avatar profile={p} size={big ? 96 : 72} /></div>
        )}
        <div className="tile-label">
          {t.kind === 'screen' && <Monitor size={14} />}
          <span className="truncate">{t.kind === 'screen' ? tr('Tela de {nome}', { nome: displayName(p) }) : displayName(p)}</span>
          {t.kind === 'person' && (t.member.deafened ? <HeadphoneOff size={14} /> : t.member.muted && <MicOff size={14} />)}
          {broken && <span className="tile-conn"><WifiOff size={14} /></span>}
          {!t.mine && t.kind === 'person' && conn === 'connected' && call.media[t.member.sessionId]?.route && (
            <span className={`route-badge ${call.media[t.member.sessionId]?.route}`}
              data-tip={call.media[t.member.sessionId]?.route === 'relay' ? tr('Conectado pelo servidor de apoio') : tr('Conectado direto')}>
              {call.media[t.member.sessionId]?.route === 'relay' ? <Server size={12} /> : <Wifi size={12} />}
            </span>
          )}
        </div>
        {(broken || pending) && t.kind === 'person' && (
          <div className={`tile-status ${broken ? 'bad' : ''}`} onClick={(e) => e.stopPropagation()}>
            {broken ? (
              <>
                <span>{tr('Sem conexão de áudio com essa pessoa')}</span>
                <button className="btn btn-sm btn-ghost" onClick={() => voice.retryPeer(t.member.sessionId)}>
                  <RefreshCw size={14} /> {tr('Tentar de novo')}
                </button>
              </>
            ) : (
              <span>{tr('Conectando…')}</span>
            )}
          </div>
        )}
        <div className="tile-tools" onClick={(e) => e.stopPropagation()}>
          {!t.mine && t.kind === 'person' && (
            <button className="icon-btn tiny" aria-label={tr('Volume de {nome}', { nome: displayName(p) })} data-tip={`${tr('Volume')} ${vol}%`}
              onClick={() => setVolumeFor(volumeFor === t.member.userId ? null : t.member.userId)}>
              <Volume2 size={16} />
            </button>
          )}
          {t.stream && (
            <button className="icon-btn tiny" aria-label={tr('Tela cheia')} data-tip={tr('Tela cheia')}
              onClick={(e) => void (e.currentTarget.closest('.tile') as HTMLElement)?.requestFullscreen?.().catch(() => undefined)}>
              <Maximize2 size={16} />
            </button>
          )}
        </div>
        {volumeFor === t.member.userId && t.kind === 'person' && (
          <div className="volume-pop" onClick={(e) => e.stopPropagation()}>
            <label htmlFor={`vol-${t.member.userId}`}>{tr('Volume de {nome}', { nome: displayName(p) })} — {vol}%</label>
            <input id={`vol-${t.member.userId}`} type="range" min={0} max={100} step={5} value={vol}
              onChange={(e) => voice.setUserVolume(t.member.userId, Number(e.target.value) / 100)} />
          </div>
        )}
      </div>
    )
  }

  const ptt = call.settings.inputMode === 'ptt'

  return (
    <section className="chat voice-stage">
      <ChatHeader icon={<Volume2 size={22} />} title={channel.name}
        topic={tr('{n} de {max} na call', { n: call.members.length, max: MAX_IN_CALL })} />
      <div className={`stage ${focusTile ? 'has-focus' : ''}`}>
        {focusTile && <div className="stage-focus">{renderTile(focusTile, true)}</div>}
        <div className={`stage-grid ${focusTile ? 'strip' : ''} n${Math.min(rest.length, 6)}`}>
          {rest.map((t) => renderTile(t))}
        </div>
      </div>

      {call.audioBlocked && (
        <button className="audio-unlock" onClick={() => voice.unlockAudio()}>
          <VolumeX size={18} /> {tr('O navegador pausou o som da call. Toque aqui para ouvir.')}
        </button>
      )}

      {ptt && (
        <div className="ptt-hint">
          <span>{call.pttActive ? tr('Falando…') : tr('Segure {tecla} para falar', { tecla: keyLabel(call.settings.pttKey) })}</span>
          <button className={`btn btn-sm ${call.pttActive ? 'btn-success' : 'btn-ghost'}`}
            onPointerDown={() => voice.setPtt(true)} onPointerUp={() => voice.setPtt(false)}
            onPointerLeave={() => voice.setPtt(false)} onContextMenu={(e) => e.preventDefault()}>
            <Mic size={16} /> {tr('Segure para falar')}
          </button>
        </div>
      )}

      <div className="call-controls">
        <button className={`round-btn ${call.muted || call.deafened ? 'off' : ''}`} aria-label={tr('Microfone')}
          data-tip={call.muted ? tr('Ativar microfone') : tr('Silenciar')} onClick={() => voice.toggleMute()}>
          {call.muted || call.deafened ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button className={`round-btn ${call.deafened ? 'off' : ''}`} aria-label={tr('Áudio')}
          data-tip={call.deafened ? tr('Ativar áudio') : tr('Desativar áudio')} onClick={() => voice.toggleDeafen()}>
          {call.deafened ? <HeadphoneOff size={22} /> : <Headphones size={22} />}
        </button>
        <button className={`round-btn ${call.camera ? 'on' : ''}`} aria-label={tr('Câmera')}
          data-tip={call.camera ? tr('Desligar câmera') : tr('Ligar câmera')} onClick={() => void voice.toggleCamera()}>
          {call.camera ? <Video size={22} /> : <VideoOff size={22} />}
        </button>
        {(canShareScreen() || call.screen) && <div className="quality-wrap">
          <button className={`round-btn ${call.screen ? 'on' : ''}`} aria-label={tr('Compartilhar tela')}
            data-tip={call.screen ? tr('Parar de compartilhar') : tr('Compartilhar tela')}
            onClick={() => (call.screen ? voice.stopScreen() : setQualityOpen((v) => !v))}>
            {call.screen ? <MonitorOff size={22} /> : <Monitor size={22} />}
          </button>
          {qualityOpen && (
            <div className="quality-pop">
              <strong>{tr('Qualidade da tela')}</strong>
              {(Object.keys(SCREEN_PRESETS) as ScreenQuality[]).map((q) => (
                <button key={q} className={`dropdown-item ${call.settings.screenQuality === q ? 'selected' : ''}`} onClick={() => share(q)}>
                  {SCREEN_PRESETS[q].label}
                </button>
              ))}
              <span className="muted small">{tr('Para enviar o som, escolha "Tela inteira" ou uma aba e marque "Compartilhar áudio".')}</span>
            </div>
          )}
        </div>}
        <button className="round-btn leave" aria-label={tr('Sair da call')} data-tip={tr('Sair da call')} onClick={() => void voice.leave()}>
          <PhoneOff size={22} />
        </button>
      </div>
    </section>
  )
}
