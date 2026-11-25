import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Minus, Plus } from 'lucide-react'
import { t } from '../lib/i18n'

export type CropKind = 'avatar' | 'banner' | 'server'

/** Proporção do recorte e tamanho final (px) de cada tipo de imagem. */
const SPEC: Record<CropKind, { ratio: number; out: [number, number]; round: boolean }> = {
  avatar: { ratio: 1, out: [512, 512], round: true },
  server: { ratio: 1, out: [512, 512], round: true },
  banner: { ratio: 8 / 3, out: [1200, 450], round: false },
}

type Pt = { x: number; y: number }

export function ImageCropper({
  file,
  kind,
  onDone,
  onCancel,
}: {
  file: File
  kind: CropKind
  onDone: (cropped: File) => void
  onCancel: () => void
}) {
  const spec = SPEC[kind]
  const fw = useMemo(() => Math.round(Math.min(spec.ratio > 1 ? 380 : 280, window.innerWidth - 72)), [spec.ratio])
  const fh = Math.round(fw / spec.ratio)

  const [src, setSrc] = useState<string | null>(null)
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [off, setOff] = useState<Pt>({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Escape fecha só o editor (não a janela que está por baixo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  const bounds = useMemo(() => {
    if (!dim) return null
    const cover = Math.max(fw / dim.w, fh / dim.h)
    const contain = Math.min(fw / dim.w, fh / dim.h)
    // foto de perfil e ícone de servidor (redondos) não podem ficar com área vazia: o zoom mínimo é o "preencher"
    return { cover, contain, min: spec.round ? cover : contain, max: cover * 4 }
  }, [dim, fw, fh])

  const clamp = useCallback(
    (o: Pt, s: number): Pt => {
      if (!dim) return o
      const mx = Math.abs(dim.w * s - fw) / 2
      const my = Math.abs(dim.h * s - fh) / 2
      return { x: Math.max(-mx, Math.min(mx, o.x)), y: Math.max(-my, Math.min(my, o.y)) }
    },
    [dim, fw, fh],
  )

  const applyScale = useCallback(
    (next: number) => {
      if (!bounds) return
      const s = Math.max(bounds.min, Math.min(bounds.max, next))
      setScale(s)
      setOff((o) => clamp(o, s))
    },
    [bounds, clamp],
  )

  const onLoad = () => {
    const el = imgRef.current
    if (!el) return
    const d = { w: el.naturalWidth, h: el.naturalHeight }
    setDim(d)
    setScale(Math.max(fw / d.w, fh / d.h))
    setOff({ x: 0, y: 0 })
  }

  // ---- arrastar / pinça ----
  const pts = useRef(new Map<number, Pt>())
  const pinch = useRef<{ dist: number; scale: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    frameRef.current?.setPointerCapture(e.pointerId)
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale }
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pts.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    pts.current.set(e.pointerId, cur)
    if (pts.current.size >= 2 && pinch.current) {
      const [a, b] = [...pts.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current.dist > 0) applyScale(pinch.current.scale * (d / pinch.current.dist))
      return
    }
    const dx = cur.x - prev.x
    const dy = cur.y - prev.y
    setOff((o) => clamp({ x: o.x + dx, y: o.y + dy }, scale))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId)
    if (pts.current.size < 2) pinch.current = null
  }

  // roda do mouse = zoom (precisa de listener não passivo)
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  const applyRef = useRef(applyScale)
  applyRef.current = applyScale
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      applyRef.current(scaleRef.current * (e.deltaY < 0 ? 1.08 : 1 / 1.08))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const confirm = async () => {
    const el = imgRef.current
    if (!el || !dim) return
    setBusy(true)
    setError(null)
    try {
      const [ow, oh] = spec.out
      const k = ow / fw
      const canvas = document.createElement('canvas')
      canvas.width = ow
      canvas.height = oh
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      const dw = dim.w * scale * k
      const dh = dim.h * scale * k
      ctx.drawImage(el, ow / 2 + off.x * k - dw / 2, oh / 2 + off.y * k - dh / 2, dw, dh)
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error(t('Não deu para ler a imagem.')))), 'image/webp', 0.92),
      )
      onDone(new File([blob], `${kind}.webp`, { type: 'image/webp' }))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const sliderVal = bounds ? Math.round(((scale - bounds.min) / (bounds.max - bounds.min)) * 1000) : 0

  return createPortal(
    <div className="crop-backdrop" role="dialog" aria-modal="true" aria-label={t('Ajustar imagem')}>
      <div className="crop-box">
        <h2>{t('Ajustar imagem')}</h2>
        <p className="muted small">{t('Arraste a imagem para posicionar. Use o zoom (ou a roda do mouse) para aproximar.')}</p>
        <div
          ref={frameRef}
          className={`crop-frame ${spec.round ? 'round' : ''}`}
          style={{ width: fw, height: fh }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {src && (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={onLoad}
              onError={() => setError(t('Não deu para ler a imagem.'))}
              style={
                dim
                  ? { width: dim.w, height: dim.h, transform: `translate(-50%, -50%) translate(${off.x}px, ${off.y}px) scale(${scale})` }
                  : { visibility: 'hidden' }
              }
            />
          )}
        </div>
        <div className="crop-zoom">
          <button type="button" className="icon-btn" aria-label={t('Menos zoom')} onClick={() => applyScale(scale / 1.15)}><Minus size={18} /></button>
          <input
            type="range"
            min={0}
            max={1000}
            value={sliderVal}
            aria-label={t('Zoom')}
            onChange={(e) => bounds && applyScale(bounds.min + (Number(e.target.value) / 1000) * (bounds.max - bounds.min))}
          />
          <button type="button" className="icon-btn" aria-label={t('Mais zoom')} onClick={() => applyScale(scale * 1.15)}><Plus size={18} /></button>
        </div>
        <div className="row-gap crop-presets">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (bounds) { setScale(bounds.cover); setOff({ x: 0, y: 0 }) } }}>{t('Preencher')}</button>
          {!spec.round && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (bounds) { setScale(bounds.contain); setOff({ x: 0, y: 0 }) } }}>{t('Mostrar inteira')}</button>}
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('Cancelar')}</button>
          <button type="button" className="btn btn-primary" disabled={busy || !dim} onClick={() => void confirm()}>{t('Usar imagem')}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Abre o editor de posição antes de enviar a imagem.
 * GIFs animados seguem direto (recortar tiraria a animação).
 */
export function useCropPick(onFile: (file: File, kind: CropKind) => void | Promise<void>): {
  open: (file: File | undefined, kind: CropKind) => void
  node: ReactNode
} {
  const [job, setJob] = useState<{ file: File; kind: CropKind } | null>(null)
  const open = (file: File | undefined, kind: CropKind) => {
    if (!file) return
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      void onFile(file, kind)
      return
    }
    setJob({ file, kind })
  }
  const node = job ? (
    <ImageCropper
      file={job.file}
      kind={job.kind}
      onCancel={() => setJob(null)}
      onDone={(f) => {
        const k = job.kind
        setJob(null)
        void onFile(f, k)
      }}
    />
  ) : null
  return { open, node }
}
