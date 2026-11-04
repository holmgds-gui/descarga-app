import { useEffect, useReducer } from 'react'
import { backend } from './backend'
import { locale } from './i18n'
import type { Attachment, AttachmentKind } from './types'

export const MAX_FILES_PER_MESSAGE = 10

export function kindOf(type: string): AttachmentKind {
  if (/^image\/(png|jpe?g|gif|webp|avif|bmp)$/.test(type)) return 'image'
  if (/^video\/(mp4|webm|ogg|quicktime)$/.test(type)) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  return 'file'
}

export function formatBytes(n: number) {
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${new Intl.NumberFormat(locale(), { maximumFractionDigits: i ? 1 : 0 }).format(n)} ${units[i]}`
}

export function formatDuration(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const s = Math.floor(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** lê largura/altura/duração para o chat reservar o espaço certo antes de carregar */
export async function readMeta(file: File): Promise<Omit<Attachment, 'path' | 'size' | 'type'>> {
  const kind = kindOf(file.type)
  const base = { name: file.name || 'arquivo', kind }
  try {
    if (kind === 'image') {
      const bmp = await createImageBitmap(file)
      const out = { ...base, width: bmp.width, height: bmp.height }
      bmp.close()
      return out
    }
    if (kind === 'video' || kind === 'audio') {
      const url = URL.createObjectURL(file)
      try {
        const el = document.createElement(kind)
        el.preload = 'metadata'
        el.src = url
        await new Promise<void>((resolve, reject) => {
          el.onloadedmetadata = () => resolve()
          el.onerror = () => reject(new Error('meta'))
          setTimeout(resolve, 4000)
        })
        const v = el as HTMLVideoElement
        return {
          ...base,
          duration: Number.isFinite(el.duration) ? el.duration : undefined,
          ...(kind === 'video' && v.videoWidth ? { width: v.videoWidth, height: v.videoHeight } : {}),
        }
      } finally {
        URL.revokeObjectURL(url)
      }
    }
  } catch {
    // arquivo que o navegador não consegue ler vira "arquivo comum"
    return { ...base, kind: kind === 'image' ? 'file' : kind }
  }
  return base
}

// ---- links temporários dos arquivos (privados), pedidos em lote ----
const cache = new Map<string, { url: string; until: number }>()
const listeners = new Set<() => void>()
const queued = new Set<string>()
const inflight = new Set<string>()
let timer: number | undefined

function flush() {
  timer = undefined
  const paths = [...queued]
  queued.clear()
  if (!paths.length) return
  paths.forEach((p) => inflight.add(p))
  void backend
    .attachmentUrls(paths)
    .then((map) => {
      for (const [p, url] of Object.entries(map)) cache.set(p, { url, until: Date.now() + 5 * 60 * 60 * 1000 })
    })
    .catch(() => undefined)
    .finally(() => {
      paths.forEach((p) => inflight.delete(p))
      listeners.forEach((l) => l())
    })
}

function want(path: string) {
  const c = cache.get(path)
  if ((c && c.until > Date.now()) || inflight.has(path)) return
  queued.add(path)
  if (timer === undefined) timer = window.setTimeout(flush, 0)
}

export function useAttachmentUrl(path: string): string | null {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    listeners.add(force)
    want(path)
    return () => void listeners.delete(force)
  }, [path])
  return cache.get(path)?.url ?? null
}

/** pré-carrega o link de um arquivo que acabou de ser enviado (mostra na hora) */
export function seedAttachmentUrl(path: string, url: string) {
  cache.set(path, { url, until: Date.now() + 60 * 60 * 1000 })
}
