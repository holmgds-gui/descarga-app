import { useEffect, useRef, useState } from 'react'
import {
  HeadphoneOff, Headphones, Maximize2, Mic, MicOff, Monitor, MonitorOff, PhoneCall, PhoneOff, Video, VideoOff,
  Volume2, WifiOff,
} from 'lucide-react'
import { MAX_IN_CALL, voice, type CallMember } from '../lib/voice/engine'
import { useVoice, useVoicePresence } from '../lib/voice/hooks'
import { SCREEN_PRESETS, keyLabel, type ScreenQuality } from '../lib/voice/settings'
import type { Channel } from '../lib/types'
import { useApp } from '../state'
import { Avatar, displayName } from './Avatar'
import { ChatHeader } from './ChatView'

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
            <p className="muted">Ninguém está na call ainda.</p>
          )}
          <button className="btn btn-success btn-lg" disabled={call.status === 'connecting' || present.length >= MAX_IN_CALL}
            onClick={() => void voice.join(channel.id, channel.server_id, userId)}>
            <PhoneCall size={18} /> {present.length >= MAX_IN_CALL ? 'Call cheia' : 'Entrar na call'}
          </button>
          <p className="muted small">Chamadas direto entre os aparelhos • até {MAX_IN_CALL} pessoas • grátis</p>
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
    const vol = Math.round((call.settings.volumes[t.member.userId] ?? 1) * 100)
    return (
      <div key={t.id} className={`tile ${big ? 'tile-big' : ''} ${speaking ? 'speaking' : ''} ${t.kind}`}
        style={{ ['--tile-color' as string]: p?.accent_color ?? 'var(--accent)' }}
        onClick={() => setFocus(focusTile?.id === t.id ? null : t.id)}>
        {t.stream ? (
          <VideoView stream={t.stream} mirror={t.mine && t.kind === 'person'} contain={t.kind === 'screen'} />
        ) : t.kind === 'screen' ? (
          <div className="tile-waiting"><Monitor size={28} /><span>Carregando a tela…</span></div>
        ) : (
          <div className="tile-avatar"><Avatar profile={p} size={big ? 96 : 72} /></div>
        )}
        <div className="tile-label">
          {t.kind === 'screen' && <Monitor size={14} />}
          <span className="truncate">{t.kind === 'screen' ? `Tela de ${displayName(p)}` : displayName(p)}</span>
          {t.kind === 'person' && (t.member.deafened ? <HeadphoneOff size={14} /> : t.member.muted && <MicOff size={14} />)}
          {!t.mine && conn && conn !== 'connected' && conn !== 'new' && conn !== 'connecting' && (
            <span className="tile-conn" data-tip="Não conectou com essa pessoa"><WifiOff size={14} /></span>
          )}
        </div>
        <div className="tile-tools" onClick={(e) => e.stopPropagation()}>
          {!t.mine && t.kind === 'person' && (
            <button className="icon-btn tiny" aria-label={`Volume de ${displayName(p)}`} data-tip={`Volume ${vol}%`}
              onClick={() => setVolumeFor(volumeFor === t.member.userId ? null : t.member.userId)}>
              <Volume2 size={16} />
            </button>
          )}
          {t.stream && (
            <button className="icon-btn tiny" aria-label="Tela cheia" data-tip="Tela cheia"
              onClick={(e) => void (e.currentTarget.closest('.tile') as HTMLElement)?.requestFullscreen?.().catch(() => undefined)}>
              <Maximize2 size={16} />
            </button>
          )}
        </div>
        {volumeFor === t.member.userId && t.kind === 'person' && (
          <div className="volume-pop" onClick={(e) => e.stopPropagation()}>
            <label htmlFor={`vol-${t.member.userId}`}>Volume de {displayName(p)} — {vol}%</label>
            <input id={`vol-${t.member.userId}`} type="range" min={0} max={200} step={5} value={vol}
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
        topic={`${call.members.length} de ${MAX_IN_CALL} na call`} />
      <div className={`stage ${focusTile ? 'has-focus' : ''}`}>
        {focusTile && <div className="stage-focus">{renderTile(focusTile, true)}</div>}
        <div className={`stage-grid ${focusTile ? 'strip' : ''} n${Math.min(rest.length, 6)}`}>
          {rest.map((t) => renderTile(t))}
        </div>
      </div>

      {ptt && (
        <div className="ptt-hint">
          <span>{call.pttActive ? 'Falando…' : `Segure ${keyLabel(call.settings.pttKey)} para falar`}</span>
          <button className={`btn btn-sm ${call.pttActive ? 'btn-success' : 'btn-ghost'}`}
            onPointerDown={() => voice.setPtt(true)} onPointerUp={() => voice.setPtt(false)}
            onPointerLeave={() => voice.setPtt(false)} onContextMenu={(e) => e.preventDefault()}>
            <Mic size={16} /> Segure para falar
          </button>
        </div>
      )}

      <div className="call-controls">
        <button className={`round-btn ${call.muted || call.deafened ? 'off' : ''}`} aria-label="Microfone"
          data-tip={call.muted ? 'Ativar microfone' : 'Silenciar'} onClick={() => voice.toggleMute()}>
          {call.muted || call.deafened ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button className={`round-btn ${call.deafened ? 'off' : ''}`} aria-label="Áudio"
          data-tip={call.deafened ? 'Ativar áudio' : 'Desativar áudio'} onClick={() => voice.toggleDeafen()}>
          {call.deafened ? <HeadphoneOff size={22} /> : <Headphones size={22} />}
        </button>
        <button className={`round-btn ${call.camera ? 'on' : ''}`} aria-label="Câmera"
          data-tip={call.camera ? 'Desligar câmera' : 'Ligar câmera'} onClick={() => void voice.toggleCamera()}>
          {call.camera ? <Video size={22} /> : <VideoOff size={22} />}
        </button>
        <div className="quality-wrap">
          <button className={`round-btn ${call.screen ? 'on' : ''}`} aria-label="Compartilhar tela"
            data-tip={call.screen ? 'Parar de compartilhar' : 'Compartilhar tela'}
            onClick={() => (call.screen ? voice.stopScreen() : setQualityOpen((v) => !v))}>
            {call.screen ? <MonitorOff size={22} /> : <Monitor size={22} />}
          </button>
          {qualityOpen && (
            <div className="quality-pop">
              <strong>Qualidade da tela</strong>
              {(Object.keys(SCREEN_PRESETS) as ScreenQuality[]).map((q) => (
                <button key={q} className={`dropdown-item ${call.settings.screenQuality === q ? 'selected' : ''}`} onClick={() => share(q)}>
                  {SCREEN_PRESETS[q].label}
                </button>
              ))}
              <span className="muted small">Marque "Compartilhar áudio" na janela do navegador para enviar o som.</span>
            </div>
          )}
        </div>
        <button className="round-btn leave" aria-label="Sair da call" data-tip="Sair da call" onClick={() => void voice.leave()}>
          <PhoneOff size={22} />
        </button>
      </div>
    </section>
  )
}
