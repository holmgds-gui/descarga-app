import { t } from './i18n'

export const MAX_VOICE_SECONDS = 10 * 60
const BARS = 48

function pickType() {
  const options = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']
  return options.find((x) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(x)) ?? ''
}

export const canRecordVoice = () =>
  typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

export interface VoiceClip {
  blob: Blob
  type: string
  ext: string
  duration: number
  waveform: number[]
}

/** Grava uma mensagem de voz e guarda a forma da onda para desenhar no chat. */
export class VoiceRecorder {
  private chunks: Blob[] = []
  private levels: number[] = []
  private timer: number | undefined
  private started = performance.now()
  private ctx: AudioContext | null = null
  private done: Promise<void>
  private stream: MediaStream
  private rec: MediaRecorder

  private constructor(stream: MediaStream, rec: MediaRecorder, onLevel: (v: number) => void) {
    this.stream = stream
    this.rec = rec
    this.done = new Promise((resolve) => (rec.onstop = () => resolve()))
    rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data)
    rec.start(250)
    try {
      this.ctx = new AudioContext()
      const src = this.ctx.createMediaStreamSource(stream)
      const an = this.ctx.createAnalyser()
      an.fftSize = 1024
      src.connect(an)
      const buf = new Float32Array(an.fftSize)
      this.timer = window.setInterval(() => {
        an.getFloatTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += v * v
        const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4)
        this.levels.push(rms)
        onLevel(rms)
      }, 100)
    } catch {
      // sem analisador: grava do mesmo jeito, só sem a onda
    }
  }

  static async start(onLevel: (v: number) => void) {
    if (!canRecordVoice()) throw new Error(t('Este navegador não grava áudio.'))
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch {
      throw new Error(t('Permita o uso do microfone para gravar.'))
    }
    const type = pickType()
    const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined)
    return new VoiceRecorder(stream, rec, onLevel)
  }

  get seconds() {
    return (performance.now() - this.started) / 1000
  }

  private cleanup() {
    window.clearInterval(this.timer)
    this.stream.getTracks().forEach((tr) => tr.stop())
    void this.ctx?.close().catch(() => undefined)
  }

  async stop(): Promise<VoiceClip> {
    const duration = this.seconds
    if (this.rec.state !== 'inactive') this.rec.stop()
    await this.done
    this.cleanup()
    const type = (this.rec.mimeType || 'audio/webm').split(';')[0]
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
    return { blob: new Blob(this.chunks, { type }), type, ext, duration, waveform: shape(this.levels) }
  }

  cancel() {
    if (this.rec.state !== 'inactive') this.rec.stop()
    this.cleanup()
  }
}

/** reduz os níveis gravados para BARS barras entre 0 e 1 */
function shape(levels: number[]) {
  if (!levels.length) return Array.from({ length: BARS }, () => 0.2)
  const out: number[] = []
  for (let i = 0; i < BARS; i++) {
    const a = Math.floor((i / BARS) * levels.length)
    const b = Math.max(a + 1, Math.floor(((i + 1) / BARS) * levels.length))
    let m = 0
    for (let j = a; j < b && j < levels.length; j++) m = Math.max(m, levels[j])
    out.push(m)
  }
  const peak = Math.max(...out, 0.05)
  return out.map((v) => Math.round(Math.max(0.08, v / peak) * 100) / 100)
}
