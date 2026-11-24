/**
 * Sons do Descarga, criados na hora com Web Audio (sem arquivos, sem direitos autorais):
 * - entrar na call: gotas de água caindo
 * - sair da call: gotas descendo de tom
 * - mutar / desmutar: cliques curtos
 */
import { local } from '../storage'

let ctx: AudioContext | null = null
let volume = 0.6

export function soundContext() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function setSoundVolume(v: number) {
  volume = Math.max(0, Math.min(1, v))
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function out(c: AudioContext) {
  const g = c.createGain()
  g.gain.value = volume
  g.connect(c.destination)
  return g
}

/** Uma gota: tom que sobe rápido ("plip") com um respingo curtinho. */
function drop(c: AudioContext, dest: AudioNode, at: number, base: number, level: number, bend = 2.6, splash = true) {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(base, at)
  osc.frequency.exponentialRampToValueAtTime(base * bend, at + 0.07)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(level, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
  osc.connect(g).connect(dest)
  osc.start(at)
  osc.stop(at + 0.2)
  if (!splash) return

  const splashSrc = c.createBufferSource()
  splashSrc.buffer = noiseBuffer(c, 0.12)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 3200
  bp.Q.value = 1.2
  const sg = c.createGain()
  sg.gain.setValueAtTime(level * 0.12, at + 0.02)
  sg.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)
  splashSrc.connect(bp).connect(sg).connect(dest)
  splashSrc.start(at + 0.02)
}

export function playJoin() {
  const c = soundContext()
  const dest = out(c)
  const t = c.currentTime + 0.02
  drop(c, dest, t, 520, 0.5)
  drop(c, dest, t + 0.13, 700, 0.35)
  drop(c, dest, t + 0.22, 880, 0.22)
}

/** Saída: gotas descendo de tom (a entrada ao contrário). */
export function playLeave() {
  const c = soundContext()
  const dest = out(c)
  const t = c.currentTime + 0.02
  ;[880, 700, 560, 440].forEach((f, i) => drop(c, dest, t + i * 0.1, f, 0.3 - i * 0.05, 0.55, false))
}

function blip(from: number, to: number) {
  const c = soundContext()
  const dest = out(c)
  const t = c.currentTime + 0.01
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(from, t)
  osc.frequency.exponentialRampToValueAtTime(to, t + 0.08)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  osc.connect(g).connect(dest)
  osc.start(t)
  osc.stop(t + 0.14)
}

export const playMute = () => blip(700, 420)
export const playUnmute = () => blip(420, 700)

// ---- aviso de mensagem nova: "plim" grave e suave (duas gotinhas) ----
const MSG_KEY = 'descarga-som-mensagem'
export const messageSoundOn = () => local.get(MSG_KEY) !== '0'
export const setMessageSound = (on: boolean) => local.set(MSG_KEY, on ? '1' : '0')

export function playMessage() {
  try {
    const c = soundContext()
    const dest = out(c)
    const t = c.currentTime + 0.02
    drop(c, dest, t, 520, 0.4, 2.2, false)
    drop(c, dest, t + 0.17, 700, 0.24, 2, false)
  } catch {
    // sem áudio liberado ainda: segue sem som
  }
}

/** Toca o aviso só se faz sentido: a pessoa ligou o som e não está olhando para o app agora. */
export function playMessageIfAway(force = false) {
  if (!messageSoundOn()) return
  if (!force && !document.hidden && document.hasFocus()) return
  playMessage()
}

// ---- toque de chamada: gotas graves e agudas, repetindo com intervalo curto ----
const RING_KEY = 'descarga-som-toque'
export const ringtoneOn = () => local.get(RING_KEY) !== '0'
export const setRingtone = (on: boolean) => local.set(RING_KEY, on ? '1' : '0')

const RING_NOTES: Array<[number, number]> = [[374, 0], [748, 0.2], [374, 0.4], [748, 0.6], [561, 1.0], [935, 1.2]]
const RING_PERIOD_MS = 1650

function ringOnce() {
  try {
    const c = soundContext()
    const dest = out(c)
    const t = c.currentTime + 0.02
    RING_NOTES.forEach(([f, at]) => drop(c, dest, t + at, f, 0.34, 2.3, true))
  } catch {
    // sem áudio liberado ainda: segue sem som
  }
}

/** Toca o toque em loop até chamar o que esta função devolve. */
export function startRingtone(force = false) {
  if (!force && !ringtoneOn()) return () => undefined
  ringOnce()
  const id = window.setInterval(ringOnce, RING_PERIOD_MS)
  return () => window.clearInterval(id)
}
export const playRingtonePreview = () => { const stop = startRingtone(true); window.setTimeout(stop, RING_PERIOD_MS * 2 - 100) }
