/**
 * Sons do Descarga, criados na hora com Web Audio (sem arquivos, sem direitos autorais):
 * - entrar na call: gotas de água caindo
 * - sair da call: gotas descendo de tom
 * - mutar / desmutar: cliques curtos
 */
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
