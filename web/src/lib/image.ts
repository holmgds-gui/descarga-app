import { t } from './i18n'
import { ANIMATED_LEVEL, myPlusLevel } from './perks'
const MAX: Record<string, number> = { avatar: 512, banner: 1200, server: 256, emoji: 128 }

/** Reduz a imagem para economizar espaço. GIFs ficam como estão (para manter a animação). */
export async function compressImage(file: File, kind: string): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error(t('Escolha um arquivo de imagem.'))
  // foto e banner animados são do Super Plus; sem ele o GIF vira imagem parada (o 1º quadro)
  const keepGif = file.type === 'image/gif' && ((kind !== 'avatar' && kind !== 'banner') || myPlusLevel() >= ANIMATED_LEVEL)
  if (keepGif) {
    if (file.size > 8 * 1024 * 1024) throw new Error(t('O GIF precisa ter no máximo 8 MB.'))
    return file
  }
  const bitmap = await createImageBitmap(file)
  const max = MAX[kind] ?? 800
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t('Não deu para ler a imagem.')))), 'image/webp', 0.85),
  )
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

const CHAT_MIN_BYTES = 400 * 1024
const CHAT_MAX_SIDE = 2048

/**
 * Economiza espaço nas imagens enviadas no chat: fotos grandes (jpg/png/webp) são reduzidas para
 * no máximo 2048 px e salvas em WebP. GIF (animação), SVG e imagens pequenas ficam como estão.
 * Se o resultado não ficar menor, devolve null (usa o original).
 */
export async function shrinkChatImage(file: Blob): Promise<Blob | null> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < CHAT_MIN_BYTES) return null
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, CHAT_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.82))
    return out && out.size < file.size * 0.9 ? out : null
  } catch {
    return null
  }
}
