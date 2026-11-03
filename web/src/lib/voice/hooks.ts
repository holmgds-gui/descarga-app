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
