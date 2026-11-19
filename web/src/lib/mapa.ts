import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useApp } from '../state'
import { local } from './storage'
import { acquireRoom } from './voice/rooms'
import { useVoice } from './voice/hooks'
import { WORLD_H, WORLD_SCALE, WORLD_TX, WORLD_TY } from './worldMeta'

/** Projeção Natural Earth 1 (a mesma do desenho dos países): latitude/longitude → ponto no mapa. */
export function projectPoint(lat: number, lng: number): [number, number] {
  const l = (lng * Math.PI) / 180
  const p = (lat * Math.PI) / 180
  const p2 = p * p
  const p4 = p2 * p2
  const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
  const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
  return [WORLD_TX + WORLD_SCALE * x, WORLD_TY - WORLD_SCALE * y]
}
export { WORLD_H }

const KEY = 'descarga-mapa'
/** A posição é arredondada a ~11 km (1 casa decimal): no mapa-múndi não muda nada e protege a casa de cada pessoa. */
const round = (n: number) => Math.round(n * 10) / 10

export type ShareStatus = 'off' | 'asking' | 'on' | 'denied' | 'unavailable'
interface ShareState { sharing: boolean; status: ShareStatus; pos: { lat: number; lng: number } | null }

let state: ShareState = { sharing: local.get(KEY) === '1', status: local.get(KEY) === '1' ? 'asking' : 'off', pos: null }
const listeners = new Set<() => void>()
const set = (patch: Partial<ShareState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
let asked = false

function locate() {
  if (!('geolocation' in navigator)) {
    set({ status: 'unavailable' })
    return
  }
  set({ status: 'asking' })
  navigator.geolocation.getCurrentPosition(
    (p) => set({ status: 'on', pos: { lat: round(p.coords.latitude), lng: round(p.coords.longitude) } }),
    (err) => set({ status: err.code === 1 ? 'denied' : 'unavailable', pos: null }),
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60 * 1000 },
  )
}

export const mapaShare = {
  subscribe(cb: () => void) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  get: () => state,
  /** Quem já ligou antes volta a aparecer ao abrir o app. */
  resume() {
    if (state.sharing && !asked) {
      asked = true
      locate()
    }
  },
  enable() {
    local.set(KEY, '1')
    asked = true
    set({ sharing: true })
    locate()
  },
  disable() {
    local.remove(KEY)
    asked = false
    set({ sharing: false, status: 'off', pos: null })
  },
}

export const useMapaShare = () => useSyncExternalStore(mapaShare.subscribe, mapaShare.get)

/** Fica no app inteiro: enquanto a pessoa quiser aparecer, publica a posição (e em qual call está) na sala "mapa". */
export function useMapaPublisher() {
  const { userId } = useApp()
  const { sharing, pos } = useMapaShare()
  const call = useVoice()
  const callId = call.status !== 'idle' ? call.channelId : null
  const roomRef = useRef<ReturnType<typeof acquireRoom>['room'] | null>(null)

  useEffect(() => {
    if (userId) mapaShare.resume()
  }, [userId])

  useEffect(() => {
    if (!userId || !sharing || !pos) return
    const { room, release } = acquireRoom('mapa')
    roomRef.current = room
    return () => {
      roomRef.current = null
      void room.untrack().catch(() => undefined)
      release()
    }
  }, [userId, sharing, pos])

  useEffect(() => {
    if (!userId || !sharing || !pos) return
    void roomRef.current?.track({ userId, lat: pos.lat, lng: pos.lng, callId }).catch(() => undefined)
  }, [userId, sharing, pos, callId])
}

export interface MapPerson { userId: string; lat: number; lng: number; callId: string | null }

/** Quem está no mapa agora (só aparece quem ligou a opção e está com o app aberto). */
export function useMapPeople(): MapPerson[] {
  const [people, setPeople] = useState<MapPerson[]>([])
  useEffect(() => {
    const { room, release } = acquireRoom('mapa')
    const off = room.onPresence((list) => {
      const byUser = new Map<string, MapPerson>()
      for (const e of list) {
        if (typeof e.userId !== 'string' || typeof e.lat !== 'number' || typeof e.lng !== 'number') continue
        const callId = typeof e.callId === 'string' ? e.callId : null
        const prev = byUser.get(e.userId)
        if (!prev || (callId && !prev.callId)) byUser.set(e.userId, { userId: e.userId, lat: e.lat, lng: e.lng, callId })
      }
      setPeople([...byUser.values()])
    })
    return () => {
      off()
      release()
    }
  }, [])
  return people
}
