import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Download, ExternalLink, FileText, Pause, Play, X } from 'lucide-react'
import { formatBytes, formatDuration, useAttachmentUrl } from '../lib/files'
import type { Attachment } from '../lib/types'
import { t } from '../lib/i18n'

/** Arquivos de uma mensagem: imagens em grade, vídeos, mensagens de voz e arquivos comuns. */
export function Attachments({ list }: { list: Attachment[] }) {
  const [viewing, setViewing] = useState<Attachment | null>(null)
  if (!list.length) return null
  const images = list.filter((a) => a.kind === 'image')
  const others = list.filter((a) => a.kind !== 'image')
  return (
    <div className="attachments">
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
