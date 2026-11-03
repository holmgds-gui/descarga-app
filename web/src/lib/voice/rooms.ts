import { backend } from '../backend'
import type { RealtimeRoom } from '../types'

/** Compartilha uma mesma sala entre partes do app (ex.: a barra lateral e a call usam "voz:<servidor>"). */
const open = new Map<string, { room: RealtimeRoom; refs: number }>()

export function acquireRoom(topic: string) {
  let entry = open.get(topic)
  if (!entry) {
    entry = { room: backend.openRoom(topic), refs: 0 }
    open.set(topic, entry)
  }
  entry.refs++
  const e = entry
  let released = false
  return {
    room: e.room,
    release() {
      if (released) return
      released = true
      e.refs--
      if (e.refs <= 0) {
        e.room.leave()
        open.delete(topic)
      }
    },
  }
}
