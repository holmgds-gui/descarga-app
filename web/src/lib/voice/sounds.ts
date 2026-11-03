/**
 * Sons do Descarga, criados na hora com Web Audio (sem arquivos, sem direitos autorais):
 * - entrar na call: gotas de água caindo
 * - sair da call: descarga
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
function drop(c: AudioContext, dest: AudioNode, at: number, base: number, level: number) {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(base, at)
  osc.frequency.exponentialRampToValueAtTime(base * 2.6, at + 0.07)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(level, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
  osc.connect(g).connect(dest)
  osc.start(at)
  osc.stop(at + 0.2)

  const splash = c.createBufferSource()
  splash.buffer = noiseBuffer(c, 0.12)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 3200
  bp.Q.value = 1.2
  const sg = c.createGain()
  sg.gain.setValueAtTime(level * 0.12, at + 0.02)
  sg.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)
  splash.connect(bp).connect(sg).connect(dest)
  splash.start(at + 0.02)
}

export function playJoin() {
  const c = soundContext()
  const dest = out(c)
  const t = c.currentTime + 0.02
  drop(c, dest, t, 520, 0.5)
  drop(c, dest, t + 0.13, 700, 0.35)
  drop(c, dest, t + 0.22, 880, 0.22)
}

export function playLeave() {
  const c = soundContext()
  const dest = out(c)
  const t = c.currentTime + 0.02
  const dur = 1.7

  // água rodando: ruído com filtro que desce, balançando (o "redemoinho")
  const water = c.createBufferSource()
  water.buffer = noiseBuffer(c, dur)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 2.5
  bp.frequency.setValueAtTime(2200, t)
  bp.frequency.exponentialRampToValueAtTime(380, t + dur)
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.frequency.setValueAtTime(5, t)
  lfo.frequency.linearRampToValueAtTime(9, t + dur)
  lfoGain.gain.value = 260
  lfo.connect(lfoGain).connect(bp.frequency)
  const wg = c.createGain()
  wg.gain.setValueAtTime(0.0001, t)
  wg.gain.exponentialRampToValueAtTime(0.55, t + 0.12)
  wg.gain.setValueAtTime(0.55, t + 0.7)
  wg.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  water.connect(bp).connect(wg).connect(dest)

  // ronco grave do cano
  const rumble = c.createBufferSource()
  rumble.buffer = noiseBuffer(c, dur)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 220
  const rg = c.createGain()
  rg.gain.setValueAtTime(0.0001, t)
  rg.gain.exponentialRampToValueAtTime(0.7, t + 0.2)
  rg.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  rumble.connect(lp).connect(rg).connect(dest)

  // "glub" final
  const gulp = c.createOscillator()
  const gg = c.createGain()
  gulp.type = 'sine'
  gulp.frequency.setValueAtTime(320, t + dur - 0.35)
  gulp.frequency.exponentialRampToValueAtTime(70, t + dur - 0.05)
  gg.gain.setValueAtTime(0.0001, t + dur - 0.35)
  gg.gain.exponentialRampToValueAtTime(0.35, t + dur - 0.3)
  gg.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  gulp.connect(gg).connect(dest)

  water.start(t)
  rumble.start(t)
  lfo.start(t)
  gulp.start(t + dur - 0.35)
  water.stop(t + dur)
  rumble.stop(t + dur)
  lfo.stop(t + dur)
  gulp.stop(t + dur)
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
