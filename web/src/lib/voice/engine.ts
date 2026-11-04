/**
 * Motor de chamadas do Descarga — direto entre os aparelhos (WebRTC em malha).
 * Cada pessoa conecta com cada outra; a sinalização passa pelo tempo real do Supabase.
 * Sem servidor de mídia: grátis, ideal para até 6 pessoas.
 */
import { backend } from '../backend'
import type { PresenceEntry, RealtimeRoom } from '../types'
import { acquireRoom } from './rooms'
import {
  SCREEN_PRESETS, loadVoiceSettings, saveVoiceSettings, type ScreenQuality, type VoiceSettings,
} from './settings'
import { playJoin, playLeave, playMute, playUnmute, setSoundVolume, soundContext } from './sounds'
import { t } from '../i18n'

export const MAX_IN_CALL = 6

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
]

/** O navegador deste aparelho consegue compartilhar a tela? (celulares não conseguem) */
export const canShareScreen = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices

type StreamKind = 'mic' | 'camera' | 'screen'

export interface CallMember {
  sessionId: string
  userId: string
  channelId: string
  muted: boolean
  deafened: boolean
  camera: boolean
  screen: boolean
}

export interface RemoteMedia {
  camera: MediaStream | null
  screen: MediaStream | null
  connection: RTCPeerConnectionState
}

export interface VoiceSnapshot {
  status: 'idle' | 'connecting' | 'connected'
  channelId: string | null
  serverId: string | null
  sessionId: string
  members: CallMember[]
  media: Record<string, RemoteMedia>
  speaking: Record<string, boolean>
  muted: boolean
  deafened: boolean
  pttActive: boolean
  camera: MediaStream | null
  screen: MediaStream | null
  screenQuality: ScreenQuality
  settings: VoiceSettings
  error: string | null
  /** o navegador bloqueou o som automático: precisa de um clique para liberar */
  audioBlocked: boolean
}

interface Peer {
  sessionId: string
  pc: RTCPeerConnection
  polite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
  kinds: Record<string, StreamKind>
  senders: Map<string, RTCRtpSender>
  audio: Map<string, { el: HTMLAudioElement; source: MediaStreamAudioSourceNode; analyser: AnalyserNode }>
  watchdog: number | undefined
  camera: MediaStream | null
  screen: MediaStream | null
}

class VoiceEngine {
  private listeners = new Set<() => void>()
  private snap: VoiceSnapshot
  private peers = new Map<string, Peer>()
  private callRoom: RealtimeRoom | null = null
  private serverRoom: { room: RealtimeRoom; release: () => void } | null = null
  private offs: (() => void)[] = []
  private mic: MediaStream | null = null
  private micAnalyser: AnalyserNode | null = null
  private speakTimer: number | undefined
  private userId = ''
  private firstSync = true
  private knownMembers = new Set<string>()
  private ice: RTCIceServer[] = DEFAULT_ICE

  constructor() {
    const settings = loadVoiceSettings()
    setSoundVolume(settings.soundVolume)
    this.snap = {
      status: 'idle', channelId: null, serverId: null, sessionId: crypto.randomUUID(), members: [], media: {},
      speaking: {}, muted: false, deafened: false, pttActive: false, camera: null, screen: null,
      screenQuality: settings.screenQuality, settings, error: null, audioBlocked: false,
    }
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKey)
    window.addEventListener('blur', () => this.setPtt(false))
    window.addEventListener('pagehide', () => void this.leave(false))
  }

  // ---------- assinatura para o React ----------
  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  getSnapshot = () => this.snap
  private set(patch: Partial<VoiceSnapshot>) {
    this.snap = { ...this.snap, ...patch }
    for (const cb of this.listeners) cb()
  }

  // ---------- entrar e sair ----------
  async join(channelId: string, serverId: string, userId: string) {
    if (this.snap.channelId === channelId && this.snap.status !== 'idle') return
    if (this.snap.status !== 'idle') await this.leave(false)
    soundContext() // libera o áudio a partir do clique
    this.userId = userId
    this.firstSync = true
    this.knownMembers.clear()
    this.set({
      status: 'connecting', channelId, serverId, error: null, members: [], media: {}, speaking: {},
      sessionId: crypto.randomUUID(),
    })

    try {
      this.mic = await this.openMic()
    } catch {
      this.set({ status: 'idle', channelId: null, serverId: null, error: t('Permita o uso do microfone para entrar na call.') })
      return
    }
    this.setupMicAnalyser()
    this.applyMicState()
    this.ice = await backend.getIceServers().catch(() => DEFAULT_ICE)

    const room = backend.openRoom(`call:${channelId}`)
    this.callRoom = room
    this.serverRoom = acquireRoom(`voz:${serverId}`)
    try {
      await room.ready
      await this.serverRoom.room.ready
    } catch (err) {
      await this.leave(false)
      this.set({ error: (err as Error).message })
      return
    }

    // espera a primeira lista de quem está na call para checar o limite
    const others = await new Promise<PresenceEntry[]>((resolve) => {
      let done = false
      let off: (() => void) | null = null
      let first: PresenceEntry[] | null = null
      const finish = (list: PresenceEntry[]) => {
        if (done) return
        done = true
        off?.()
        resolve(list)
      }
      // a sala pode responder na hora (antes de "off" existir) ou um pouco depois
      off = room.onPresence((list) => {
        if (off) finish(list)
        else first = list
      })
      if (first && (first as PresenceEntry[]).length) finish(first)
      window.setTimeout(() => finish(first ?? []), 1200)
    })
    if (others.filter((e) => e.sessionId !== this.snap.sessionId).length >= MAX_IN_CALL) {
      await this.leave(false)
      this.set({ error: t('Essa call está cheia (máximo de {n} pessoas).', { n: MAX_IN_CALL }) })
      return
    }

    this.offs.push(
      room.onPresence((list) => this.reconcile(list)),
      room.onBroadcast((event, payload) => {
        if (event === 'signal') void this.onSignal(payload)
      }),
    )
    await this.publishState()
    this.set({ status: 'connected' })
    playJoin()
    this.speakTimer = window.setInterval(() => this.measureSpeaking(), 120)
    void backend.notify({ type: 'call', channelId })
  }

  async leave(withSound = true) {
    if (this.snap.status === 'idle' && !this.callRoom) return
    window.clearInterval(this.speakTimer)
    for (const off of this.offs.splice(0)) off()
    for (const id of [...this.peers.keys()]) this.closePeer(id)
    try {
      await this.callRoom?.untrack()
      await this.serverRoom?.room.untrack()
    } catch {
      /* a conexão pode já ter caído */
    }
    this.callRoom?.leave()
    this.serverRoom?.release()
    this.callRoom = null
    this.serverRoom = null
    for (const s of [this.mic, this.snap.camera, this.snap.screen]) s?.getTracks().forEach((t) => t.stop())
    this.mic = null
    this.micAnalyser = null
    if (withSound) playLeave()
    this.set({
      status: 'idle', channelId: null, serverId: null, members: [], media: {}, speaking: {}, camera: null,
      screen: null, pttActive: false, audioBlocked: false,
    })
  }

  // ---------- presença ----------
  private stateForPresence() {
    return {
      sessionId: this.snap.sessionId,
      userId: this.userId,
      channelId: this.snap.channelId,
      muted: this.snap.muted || this.snap.deafened,
      deafened: this.snap.deafened,
      camera: !!this.snap.camera,
      screen: !!this.snap.screen,
    }
  }

  private async publishState() {
    const state = this.stateForPresence()
    await Promise.all([this.callRoom?.track(state), this.serverRoom?.room.track(state)])
  }

  private reconcile(list: PresenceEntry[]) {
    const members = list
      .filter((e) => typeof e.sessionId === 'string')
      .map((e) => e as unknown as CallMember)
    const ids = new Set(members.map((m) => m.sessionId))
    const me = this.snap.sessionId

    for (const m of members) {
      if (m.sessionId === me) continue
      if (!this.peers.has(m.sessionId)) this.createPeer(m.sessionId)
      if (!this.firstSync && !this.knownMembers.has(m.sessionId)) playJoin()
    }
    for (const id of [...this.peers.keys()]) {
      if (!ids.has(id)) {
        this.closePeer(id)
        playLeave()
      }
    }
    this.knownMembers = new Set([...ids].filter((id) => id !== me))
    this.firstSync = false
    this.set({ members })
  }

  // ---------- conexões entre aparelhos ----------
  private localKinds(): Record<string, StreamKind> {
    const k: Record<string, StreamKind> = {}
    if (this.mic) k[this.mic.id] = 'mic'
    if (this.snap.camera) k[this.snap.camera.id] = 'camera'
    if (this.snap.screen) k[this.snap.screen.id] = 'screen'
    return k
  }

  private sendSignal(to: string, data: Record<string, unknown>) {
    this.callRoom?.send('signal', { from: this.snap.sessionId, to, kinds: this.localKinds(), ...data })
  }

  private createPeer(remote: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.ice })
    const peer: Peer = {
      sessionId: remote, pc, polite: this.snap.sessionId > remote, makingOffer: false, ignoreOffer: false,
      kinds: {}, senders: new Map(), audio: new Map(), camera: null, screen: null, watchdog: undefined,
    }
    this.peers.set(remote, peer)

    const add = (stream: MediaStream | null) =>
      stream?.getTracks().forEach((t) => peer.senders.set(t.id, pc.addTrack(t, stream)))
    add(this.mic)
    add(this.snap.camera)
    add(this.snap.screen)

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true
        await pc.setLocalDescription()
        this.sendSignal(remote, { description: pc.localDescription?.toJSON() })
      } catch (err) {
        console.warn('negociação falhou', err)
      } finally {
        peer.makingOffer = false
      }
    }
    pc.onicecandidate = (e) => e.candidate && this.sendSignal(remote, { candidate: e.candidate.toJSON() })
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      window.clearTimeout(peer.watchdog)
      if (st === 'failed') pc.restartIce()
      // caiu por um instante (troca de Wi-Fi, 4G oscilando): tenta reconectar se não voltar sozinho
      if (st === 'disconnected') peer.watchdog = window.setTimeout(() => pc.connectionState === 'disconnected' && pc.restartIce(), 4000)
      this.updateMedia(peer)
    }
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track])
      const kind = peer.kinds[stream.id] ?? (e.track.kind === 'audio' ? 'mic' : 'camera')
      if (e.track.kind === 'audio') this.playRemoteAudio(peer, stream, kind)
      if (e.track.kind === 'video') {
        if (kind === 'screen') peer.screen = stream
        else peer.camera = stream
      }
      stream.onremovetrack = () => this.updateMedia(peer)
      e.track.onended = () => this.updateMedia(peer)
      this.updateMedia(peer)
    }
    this.updateMedia(peer)
    return peer
  }

  private async onSignal(p: Record<string, unknown>) {
    if (p.to !== this.snap.sessionId || typeof p.from !== 'string') return
    const peer = this.peers.get(p.from) ?? this.createPeer(p.from)
    if (p.kinds) Object.assign(peer.kinds, p.kinds as Record<string, StreamKind>)
    const pc = peer.pc
    try {
      if (p.description) {
        const desc = p.description as RTCSessionDescriptionInit
        const collision = desc.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable')
        peer.ignoreOffer = !peer.polite && collision
        if (peer.ignoreOffer) return
        await pc.setRemoteDescription(desc)
        if (desc.type === 'offer') {
          await pc.setLocalDescription()
          this.sendSignal(p.from, { description: pc.localDescription?.toJSON() })
        }
        this.tuneSenders(peer)
      } else if (p.candidate) {
        try {
          await pc.addIceCandidate(p.candidate as RTCIceCandidateInit)
        } catch (err) {
          if (!peer.ignoreOffer) throw err
        }
      }
    } catch (err) {
      console.warn('sinal da call falhou', err)
    }
  }

  private closePeer(id: string) {
    const peer = this.peers.get(id)
    if (!peer) return
    window.clearTimeout(peer.watchdog)
    for (const a of peer.audio.values()) {
      a.source.disconnect()
      a.el.pause()
      a.el.srcObject = null
      a.el.remove()
    }
    peer.pc.close()
    this.peers.delete(id)
    const media = { ...this.snap.media }
    delete media[id]
    this.set({ media })
  }

  private updateMedia(peer: Peer) {
    const live = (s: MediaStream | null) => (s && s.getVideoTracks().some((t) => t.readyState === 'live') ? s : null)
    this.set({
      media: {
        ...this.snap.media,
        [peer.sessionId]: { camera: live(peer.camera), screen: live(peer.screen), connection: peer.pc.connectionState },
      },
    })
  }

  /**
   * O som de cada pessoa toca num elemento <audio> de verdade (funciona em PC, Android e iPhone).
   * O Web Audio só é usado para medir quem está falando.
   */
  private playRemoteAudio(peer: Peer, stream: MediaStream, kind: StreamKind) {
    if (peer.audio.has(stream.id)) return
    const el = document.createElement('audio')
    el.autoplay = true
    el.setAttribute('playsinline', '')
    el.dataset.descarga = kind
    el.srcObject = stream
    el.style.display = 'none'
    document.body.appendChild(el)
    const ctx = soundContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    peer.audio.set(stream.id, { el, source, analyser })
    this.applyVolumes()
    this.tryPlay(el)
  }

  private tryPlay(el: HTMLAudioElement) {
    void el.play().catch((err: DOMException) => {
      if (err?.name === 'NotAllowedError') this.set({ audioBlocked: true })
    })
  }

  /** Chamado num clique quando o navegador bloqueou o som automático. */
  unlockAudio() {
    void soundContext().resume()
    for (const peer of this.peers.values()) for (const a of peer.audio.values()) this.tryPlay(a.el)
    this.set({ audioBlocked: false })
  }

  /** Tenta reconectar com uma pessoa que não conectou. */
  retryPeer(sessionId: string) {
    this.peers.get(sessionId)?.pc.restartIce()
  }

  /** Ajusta qualidade da tela (resolução, fps e taxa de bits) em cada conexão. */
  private tuneSenders(peer: Peer) {
    const screenTrack = this.snap.screen?.getVideoTracks()[0]
    if (!screenTrack) return
    const sender = peer.senders.get(screenTrack.id)
    if (!sender) return
    const preset = SCREEN_PRESETS[this.snap.screenQuality]
    const params = sender.getParameters()
    if (!params.encodings?.length) return
    params.encodings[0].maxBitrate = preset.bitrate
    params.encodings[0].maxFramerate = preset.fps
    void sender.setParameters(params).catch(() => undefined)
  }

  // ---------- microfone ----------
  private async openMic() {
    const s = this.snap.settings
    return navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: s.inputDeviceId ? { exact: s.inputDeviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: s.noiseSuppression,
        autoGainControl: true,
      },
    })
  }

  private setupMicAnalyser() {
    if (!this.mic) return
    const ctx = soundContext()
    const src = ctx.createMediaStreamSource(this.mic)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    src.connect(analyser)
    this.micAnalyser = analyser
  }

  /** Troca o microfone (outro aparelho ou redução de ruído) sem cair da call. */
  private async restartMic() {
    if (!this.mic) return
    const old = this.mic
    const fresh = await this.openMic()
    const newTrack = fresh.getAudioTracks()[0]
    const oldTrack = old.getAudioTracks()[0]
    for (const peer of this.peers.values()) {
      const sender = peer.senders.get(oldTrack.id)
      if (sender) {
        await sender.replaceTrack(newTrack)
        peer.senders.delete(oldTrack.id)
        peer.senders.set(newTrack.id, sender)
      }
    }
    // mantém o mesmo id de stream para o outro lado continuar sabendo que é o microfone
    old.removeTrack(oldTrack)
    old.addTrack(newTrack)
    oldTrack.stop()
    this.setupMicAnalyser()
    this.applyMicState()
  }

  private transmitting() {
    const s = this.snap
    if (s.muted || s.deafened) return false
    if (s.settings.inputMode === 'ptt') return s.pttActive
    return true
  }

  private applyMicState() {
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = this.transmitting()))
  }

  private applyVolumes() {
    for (const peer of this.peers.values()) {
      const member = this.snap.members.find((m) => m.sessionId === peer.sessionId)
      const v = Math.max(0, Math.min(1, this.snap.settings.volumes[member?.userId ?? ''] ?? 1))
      for (const a of peer.audio.values()) {
        a.el.volume = v
        a.el.muted = this.snap.deafened
      }
    }
  }

  // ---------- quem está falando ----------
  private level(an: AnalyserNode) {
    const data = new Uint8Array(an.fftSize)
    an.getByteTimeDomainData(data)
    let sum = 0
    for (const v of data) sum += ((v - 128) / 128) ** 2
    return Math.sqrt(sum / data.length)
  }

  private measureSpeaking() {
    const speaking: Record<string, boolean> = {}
    if (this.micAnalyser) speaking[this.snap.sessionId] = this.transmitting() && this.level(this.micAnalyser) > 0.02
    for (const peer of this.peers.values()) {
      const member = this.snap.members.find((m) => m.sessionId === peer.sessionId)
      let lv = 0
      for (const a of peer.audio.values()) lv = Math.max(lv, this.level(a.analyser))
      speaking[peer.sessionId] = !member?.muted && lv > 0.02
    }
    const changed = Object.keys(speaking).some((k) => speaking[k] !== this.snap.speaking[k])
    if (changed) this.set({ speaking })
  }

  // ---------- controles ----------
  toggleMute() {
    const muted = !this.snap.muted
    if (!muted && this.snap.deafened) {
      this.set({ deafened: false, muted: false })
      this.applyVolumes()
    } else this.set({ muted })
    this.applyMicState()
    ;(muted ? playMute : playUnmute)()
    void this.publishState()
  }

  toggleDeafen() {
    const deafened = !this.snap.deafened
    this.set({ deafened })
    this.applyMicState()
    this.applyVolumes()
    ;(deafened ? playMute : playUnmute)()
    void this.publishState()
  }

  setPtt(active: boolean) {
    if (this.snap.settings.inputMode !== 'ptt' || this.snap.pttActive === active) return
    this.set({ pttActive: active })
    this.applyMicState()
  }

  private onKey = (e: KeyboardEvent) => {
    if (this.snap.status !== 'connected' || this.snap.settings.inputMode !== 'ptt') return
    if (e.code !== this.snap.settings.pttKey || e.repeat) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    this.setPtt(e.type === 'keydown')
  }

  async toggleCamera() {
    if (this.snap.camera) {
      this.removeStream(this.snap.camera)
      this.set({ camera: null })
    } else {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        })
        this.addStream(cam)
        this.set({ camera: cam })
      } catch {
        this.set({ error: t('Não deu para abrir a câmera. Verifique a permissão.') })
        return
      }
    }
    void this.publishState()
  }

  async startScreen(quality: ScreenQuality) {
    if (!canShareScreen()) {
      this.set({ error: t('Este aparelho não permite compartilhar a tela pelo navegador. Use um computador.') })
      return
    }
    const preset = SCREEN_PRESETS[quality]
    // do pedido mais completo ao mais simples: cada navegador aceita opções diferentes
    const attempts: DisplayMediaStreamOptions[] = [
      {
        video: { height: { ideal: preset.height }, frameRate: { ideal: preset.fps, max: preset.fps } },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        // opções do Chrome/Edge: incluir o som do computador e não mostrar a própria aba
        ...({ systemAudio: 'include', selfBrowserSurface: 'exclude', surfaceSwitching: 'include' } as object),
      },
      { video: { frameRate: { ideal: preset.fps } }, audio: true },
      { video: true },
    ]
    let screen: MediaStream | null = null
    for (const opts of attempts) {
      try {
        screen = await navigator.mediaDevices.getDisplayMedia(opts)
        break
      } catch (err) {
        const e = err as DOMException
        if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') {
          // "by system" = o computador bloqueou (no Mac: Ajustes > Privacidade > Gravação de Tela)
          if (/system/i.test(e.message)) {
            this.set({ error: t('O computador bloqueou a gravação de tela. Libere o navegador nas configurações de privacidade do sistema.') })
          }
          return // a pessoa cancelou
        }
        // opção não suportada por este navegador: tenta a próxima
      }
    }
    if (!screen) {
      this.set({ error: t('Não deu para compartilhar a tela neste navegador. Tente pelo Chrome ou Edge no computador.') })
      return
    }
    if (this.snap.screen) this.stopScreen()
    const video = screen.getVideoTracks()[0]
    video.contentHint = quality === '1080p60' ? 'motion' : 'detail'
    video.onended = () => this.stopScreen()
    if (!screen.getAudioTracks().length) {
      this.set({ error: t('Tela compartilhada sem som. Para enviar o som, marque "Compartilhar áudio" na janela do navegador.') })
    }
    this.set({ screen, screenQuality: quality })
    this.updateSettings({ screenQuality: quality })
    this.addStream(screen)
    void this.publishState()
    window.setTimeout(() => this.peers.forEach((p) => this.tuneSenders(p)), 1500)
  }

  stopScreen() {
    if (!this.snap.screen) return
    this.removeStream(this.snap.screen)
    this.set({ screen: null })
    void this.publishState()
  }

  private addStream(stream: MediaStream) {
    for (const peer of this.peers.values()) {
      stream.getTracks().forEach((t) => peer.senders.set(t.id, peer.pc.addTrack(t, stream)))
    }
  }

  private removeStream(stream: MediaStream) {
    stream.getTracks().forEach((t) => {
      for (const peer of this.peers.values()) {
        const sender = peer.senders.get(t.id)
        if (sender) {
          peer.pc.removeTrack(sender)
          peer.senders.delete(t.id)
        }
      }
      t.stop()
    })
  }

  // ---------- configurações ----------
  updateSettings(patch: Partial<VoiceSettings>) {
    const prev = this.snap.settings
    const settings = { ...prev, ...patch }
    saveVoiceSettings(settings)
    setSoundVolume(settings.soundVolume)
    this.set({ settings, pttActive: settings.inputMode === 'ptt' ? this.snap.pttActive : false })
    this.applyMicState()
    this.applyVolumes()
    if (
      this.mic &&
      (patch.inputDeviceId !== undefined && patch.inputDeviceId !== prev.inputDeviceId ||
        patch.noiseSuppression !== undefined && patch.noiseSuppression !== prev.noiseSuppression)
    ) {
      void this.restartMic().catch(() => this.set({ error: t('Não deu para trocar o microfone.') }))
    }
  }

  setUserVolume(userId: string, volume: number) {
    this.updateSettings({ volumes: { ...this.snap.settings.volumes, [userId]: volume } })
  }

  clearError() {
    this.set({ error: null })
  }
}

export const voice = new VoiceEngine()
