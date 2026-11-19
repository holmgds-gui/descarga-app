import { useEffect, useState, useSyncExternalStore } from 'react'
import { voice, type CallMember } from './engine'
import { acquireRoom } from './rooms'

export function useVoice() {
  return useSyncExternalStore(voice.subscribe, voice.getSnapshot)
}

/** Quem está em cada canal de voz de um servidor (para mostrar na barra lateral). */
export function useVoicePresence(serverId: string | null) {
  const [members, setMembers] = useState<CallMember[]>([])
  useEffect(() => {
    if (!serverId) {
      setMembers([])
      return
    }
    const { room, release } = acquireRoom(`voz:${serverId}`)
    const off = room.onPresence((list) =>
      setMembers(list.filter((e) => typeof e.sessionId === 'string' && e.channelId) as unknown as CallMember[]),
    )
    return () => {
      off()
      release()
    }
  }, [serverId])
  return members
}

/** Quem está em call em vários lugares ao mesmo tempo (para o "Ativo agora" do Início): uma sala de presença por servidor/conversa. */
export function useActiveCalls(roomIds: string[]) {
  const [byRoom, setByRoom] = useState<Record<string, CallMember[]>>({})
  const key = roomIds.slice(0, 30).join(',')
  useEffect(() => {
    const ids = key ? key.split(',') : []
    const offs = ids.map((id) => {
      const { room, release } = acquireRoom(`voz:${id}`)
      const off = room.onPresence((list) => {
        const members = list.filter((e) => typeof e.sessionId === 'string' && e.channelId) as unknown as CallMember[]
        setByRoom((cur) => ({ ...cur, [id]: members }))
      })
      return () => {
        off()
        release()
      }
    })
    return () => {
      offs.forEach((f) => f())
      setByRoom({})
    }
  }, [key])
  return byRoom
}
