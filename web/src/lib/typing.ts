import { useCallback, useEffect, useRef, useState } from 'react'
import { acquireRoom } from './voice/rooms'

const SHOW_MS = 5000
const SEND_EVERY_MS = 3000

/** "fulano está digitando…": cada pessoa avisa a sala da conversa enquanto escreve. */
export function useTyping(channelId: string, myId: string) {
  const [who, setWho] = useState<Record<string, number>>({})
  const roomRef = useRef<ReturnType<typeof acquireRoom> | null>(null)
  const lastSent = useRef(0)

  useEffect(() => {
    setWho({})
    lastSent.current = 0
    const handle = acquireRoom(`digitando:${channelId}`)
    roomRef.current = handle
    const off = handle.room.onBroadcast((event, payload) => {
      const uid = typeof payload.user === 'string' ? payload.user : null
      if (!uid || uid === myId) return
      if (event === 'typing') setWho((w) => ({ ...w, [uid]: Date.now() + SHOW_MS }))
      if (event === 'stop') setWho((w) => { const n = { ...w }; delete n[uid]; return n })
    })
    const timer = window.setInterval(() => {
      setWho((w) => {
        const now = Date.now()
        const keep = Object.entries(w).filter(([, until]) => until > now)
        return keep.length === Object.keys(w).length ? w : Object.fromEntries(keep)
      })
    }, 1000)
    return () => {
      window.clearInterval(timer)
      off()
      handle.release()
      roomRef.current = null
    }
  }, [channelId, myId])

  /** chame a cada tecla: manda o aviso no máximo a cada 3 segundos */
  const ping = useCallback(() => {
    const now = Date.now()
    if (now - lastSent.current < SEND_EVERY_MS) return
    lastSent.current = now
    roomRef.current?.room.send('typing', { user: myId })
  }, [myId])

  /** chame quando enviar ou apagar o texto */
  const stop = useCallback(() => {
    if (!lastSent.current) return
    lastSent.current = 0
    roomRef.current?.room.send('stop', { user: myId })
  }, [myId])

  /** alguém mandou mensagem: some o "digitando" dessa pessoa */
  const clear = useCallback((uid: string) => setWho((w) => {
    if (!(uid in w)) return w
    const n = { ...w }
    delete n[uid]
    return n
  }), [])

  return { typingIds: Object.keys(who), ping, stop, clear }
}
