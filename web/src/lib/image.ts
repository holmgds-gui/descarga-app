const MAX: Record<string, number> = { avatar: 512, banner: 1200, server: 256 }

/** Reduz a imagem para economizar espaço. GIFs ficam como estão (para manter a animação). */
export async function compressImage(file: File, kind: string): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
  if (file.type === 'image/gif') {
    if (file.size > 8 * 1024 * 1024) throw new Error('O GIF precisa ter no máximo 8 MB.')
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
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não deu para ler a imagem.'))), 'image/webp', 0.85),
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
