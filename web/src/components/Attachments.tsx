import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, Download, ExternalLink, EyeOff, FileText, Flame, Pause, Play, X } from 'lucide-react'
import { backend } from '../lib/backend'
import { formatBytes, formatDuration, useAttachmentUrl } from '../lib/files'
import type { Attachment, OnceFile } from '../lib/types'
import { useApp } from '../state'
import { t } from '../lib/i18n'

/** Dados da mensagem, só para os arquivos de visualização única. */
export interface OnceContext {
  messageId: string
  mine: boolean
  /** quem já abriu (para quem enviou: todos; para os outros: só eu) */
  views: string[]
  onOpened: () => void
}

/** Arquivos de uma mensagem: imagens em grade, vídeos, mensagens de voz e arquivos comuns. */
export function Attachments({ list, once }: { list: Attachment[]; once?: OnceContext }) {
  const [viewing, setViewing] = useState<Attachment | null>(null)
  if (!list.length) return null
  // visualização única nunca passa pelo carregador normal: o arquivo só sai pela função do servidor
  const onceList = list.filter((a) => a.once)
  const normal = list.filter((a) => !a.once)
  const images = normal.filter((a) => a.kind === 'image')
  const others = normal.filter((a) => a.kind !== 'image')
  return (
    <div className="attachments">
      {onceList.length > 0 && once && <OnceCard list={onceList} ctx={once} />}
      {images.length > 0 && (
        <div className={`att-images n${Math.min(images.length, 4)}`}>
          {images.map((a) => <ImageThumb key={a.path} a={a} single={images.length === 1} onOpen={() => setViewing(a)} />)}
        </div>
      )}
      {others.map((a) =>
        a.kind === 'video' ? <VideoAtt key={a.path} a={a} />
          : a.kind === 'audio' && a.voice ? <VoicePlayer key={a.path} a={a} />
            : <FileAtt key={a.path} a={a} />,
      )}
      {viewing && <Lightbox a={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function fit(a: Attachment, maxW: number, maxH: number) {
  if (!a.width || !a.height) return { width: undefined, aspectRatio: undefined }
  const scale = Math.min(1, maxW / a.width, maxH / a.height)
  return { width: Math.round(a.width * scale), aspectRatio: `${a.width} / ${a.height}` }
}

function ImageThumb({ a, single, onOpen }: { a: Attachment; single: boolean; onOpen: () => void }) {
  const url = useAttachmentUrl(a.path)
  const size = single ? fit(a, 400, 320) : { width: undefined, aspectRatio: undefined }
  return (
    <button type="button" className={`att-image ${single ? 'single' : ''}`} onClick={onOpen} aria-label={t('Abrir imagem {nome}', { nome: a.name })}
      style={single ? { width: Math.max(size.width ?? 320, 64), aspectRatio: size.aspectRatio } : undefined}>
      {url ? <img src={url} alt={a.name} loading="lazy" draggable={false} /> : <span className="att-loading" />}
    </button>
  )
}

function VideoAtt({ a }: { a: Attachment }) {
  const url = useAttachmentUrl(a.path)
  const size = fit(a, 480, 320)
  return (
    <div className="att-video" style={{ width: size.width ?? 400, aspectRatio: size.aspectRatio ?? '16 / 9' }}>
      {url ? <video src={url} controls preload="metadata" playsInline /> : <span className="att-loading" />}
    </div>
  )
}

function FileAtt({ a }: { a: Attachment }) {
  const url = useAttachmentUrl(a.path)
  return (
    <div className="att-file">
      <div className="att-file-row">
        <FileText size={30} className="att-file-icon" />
        <div className="att-file-text">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="truncate" download={a.name}>{a.name}</a>
          ) : (
            <span className="truncate">{a.name}</span>
          )}
          <span className="muted small">{formatBytes(a.size)}</span>
        </div>
        {url && (
          <a className="icon-btn" href={url} download={a.name} target="_blank" rel="noopener noreferrer" aria-label={t('Baixar {nome}', { nome: a.name })} data-tip={t('Baixar')}>
            <Download size={20} />
          </a>
        )}
      </div>
      {a.kind === 'audio' && url && <audio src={url} controls preload="metadata" />}
    </div>
  )
}

const SPEEDS = [1, 1.5, 2]

/** Mensagem de voz: botão de tocar, forma da onda e tempo. */
export function VoicePlayer({ a }: { a: Attachment }) {
  const url = useAttachmentUrl(a.path)
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [speed, setSpeed] = useState(1)
  const duration = a.duration ?? 0
  const bars = a.waveform?.length ? a.waveform : Array.from({ length: 40 }, () => 0.3)
  const progress = duration ? Math.min(1, time / duration) : 0

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed
  }, [speed])

  const toggle = () => {
    const el = ref.current
    if (!el) return
    if (el.paused) {
      // só uma mensagem de voz toca por vez
      document.querySelectorAll('audio.voice-audio').forEach((x) => x !== el && (x as HTMLAudioElement).pause())
      void el.play().catch(() => undefined)
    } else el.pause()
  }

  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || !duration) return
    const r = e.currentTarget.getBoundingClientRect()
    el.currentTime = Math.max(0, Math.min(duration, ((e.clientX - r.left) / r.width) * duration))
    setTime(el.currentTime)
  }

  return (
    <div className={`voice-msg ${playing ? 'playing' : ''}`}>
      <button type="button" className="voice-play" disabled={!url} onClick={toggle} aria-label={playing ? t('Pausar') : t('Ouvir mensagem de voz')}>
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>
      <div className="voice-wave" onClick={seek} role="slider" aria-label={t('Posição')} aria-valuemin={0}
        aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(time)} tabIndex={0}
        onKeyDown={(e) => {
          const el = ref.current
          if (!el) return
          if (e.key === 'ArrowRight') el.currentTime = Math.min(duration, el.currentTime + 5)
          if (e.key === 'ArrowLeft') el.currentTime = Math.max(0, el.currentTime - 5)
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle() }
        }}>
        {bars.map((v, i) => (
          <span key={i} className={i / bars.length < progress ? 'on' : ''} style={{ height: `${Math.max(12, Math.round(v * 100))}%` }} />
        ))}
      </div>
      <span className="voice-time">{formatDuration(playing || time ? time : duration)}</span>
      <button type="button" className="voice-speed" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
        aria-label={t('Velocidade')}>{speed}×</button>
      {url && (
        <audio ref={ref} className="voice-audio" src={url} preload="metadata"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setTime(0) }}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} />
      )}
    </div>
  )
}

function Lightbox({ a, onClose }: { a: Attachment; onClose: () => void }) {
  const url = useAttachmentUrl(a.path)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose())
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return createPortal(
    <div className="lightbox" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-label={a.name}>
      <button className="icon-btn lightbox-close" onClick={onClose} aria-label={t('Fechar')}><X size={24} /></button>
      {url && <img src={url} alt={a.name} />}
      {url && (
        <a className="lightbox-open" href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} /> {t('Abrir no navegador')}
        </a>
      )}
    </div>,
    document.body,
  )
}


/** Foto ou vídeo de visualização única: cada pessoa abre uma vez, depois o arquivo some. */
function OnceCard({ list, ctx }: { list: Attachment[]; ctx: OnceContext }) {
  const { userId, toast } = useApp()
  const [files, setFiles] = useState<OnceFile[] | null>(null)
  const [busy, setBusy] = useState(false)
  const gone = list.every((a) => a.gone)
  const iOpened = ctx.views.includes(userId)
  const video = list.every((a) => a.kind === 'video')
  const what = list.length > 1 ? t('Fotos e vídeos') : video ? t('Vídeo') : t('Foto')

  const open = async () => {
    setBusy(true)
    try {
      const got = await backend.openOnce(ctx.messageId)
      ctx.onOpened()
      if (!got || !got.length) toast(t('Esta mídia já foi aberta.'))
      else setFiles(got)
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    setFiles(null)
    void backend.finishOnce(ctx.messageId).catch(() => undefined)
  }

  // se a pessoa fechar a aba com a mídia aberta, avisa mesmo assim
  useEffect(() => {
    if (!files) return
    const end = () => void backend.finishOnce(ctx.messageId).catch(() => undefined)
    window.addEventListener('pagehide', end)
    return () => window.removeEventListener('pagehide', end)
  }, [files, ctx.messageId])

  let label: string
  let state: 'open' | 'done' | 'wait' = 'wait'
  if (ctx.mine) {
    const n = ctx.views.length
    label = gone || n ? (n > 1 ? t('{what} de visualização única · aberta por {n}', { what, n }) : t('{what} de visualização única · aberta', { what })) : t('{what} de visualização única · não aberta', { what })
    state = gone || n ? 'done' : 'wait'
  } else if (gone || iOpened) {
    label = t('{what} de visualização única · aberta', { what })
    state = 'done'
  } else {
    label = t('{what} de visualização única · toque para abrir', { what })
    state = 'open'
  }

  return (
    <>
      <button type="button" className={`once-card ${state}`} disabled={state !== 'open' || busy} onClick={() => void open()} aria-label={label}>
        <span className="once-icon">{state === 'done' ? <Check size={20} /> : state === 'open' ? <Flame size={20} /> : <EyeOff size={20} />}</span>
        <span className="once-text">{label}</span>
      </button>
      {files && <OnceViewer files={files} onClose={close} />}
    </>
  )
}

function OnceViewer({ files, onClose }: { files: OnceFile[]; onClose: () => void }) {
  const [i, setI] = useState(0)
  const f = files[i]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="lightbox once-viewer" role="dialog" aria-modal="true" aria-label={t('Visualização única')} onContextMenu={(e) => e.preventDefault()}>
      <div className="lightbox-bar">
        <span className="once-note"><Flame size={16} /> {t('Visualização única: some depois que você fechar')}</span>
        {files.length > 1 && <span className="muted small">{i + 1} / {files.length}</span>}
        <button className="icon-btn" aria-label={t('Fechar')} onClick={onClose}><X size={22} /></button>
      </div>
      <div className="lightbox-stage" onClick={() => files.length > 1 && setI((i + 1) % files.length)}>
        {f.kind === 'video'
          ? <video key={f.path} src={f.url} controls autoPlay playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture />
          : <img key={f.path} src={f.url} alt="" draggable={false} />}
      </div>
    </div>,
    document.body,
  )
}
