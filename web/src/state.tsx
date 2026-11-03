import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { backend } from './lib/backend'
import type { Channel, Profile, Server } from './lib/types'

export type ThemeName = 'dark' | 'light' | 'midnight'
export interface Appearance {
  theme: ThemeName
  accent: string
  fontScale: number
  compact: boolean
}

const DEFAULT_APPEARANCE: Appearance = { theme: 'dark', accent: '#7B3FE4', fontScale: 1, compact: false }
const APPEARANCE_KEY = 'descarga-aparencia'

interface AppState {
  userId: string
  me: Profile | null
  profiles: Record<string, Profile>
  ensureProfiles: (ids: string[]) => void
  upsertProfile: (p: Profile) => void
  servers: Server[]
  refreshServers: () => Promise<void>
  activeServerId: string | null
  setActiveServerId: (id: string | null) => void
  channels: Channel[]
  activeChannelId: string | null
  setActiveChannelId: (id: string) => void
  memberIds: string[]
  appearance: Appearance
  setAppearance: (a: Partial<Appearance>) => void
  openProfile: (userId: string, anchor?: DOMRect) => void
  profileView: { userId: string; anchor?: DOMRect } | null
  closeProfile: () => void
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
  mobilePane: 'nav' | 'chat' | 'members'
  setMobilePane: (p: 'nav' | 'chat' | 'members') => void
  toast: (msg: string) => void
  toastMsg: string | null
}

const Ctx = createContext<AppState | null>(null)

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp fora do AppProvider')
  return v
}

export function loadAppearance(): Appearance {
  try {
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}') }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function applyAppearance(a: Appearance) {
  const root = document.documentElement
  root.dataset.theme = a.theme
  root.dataset.compact = String(a.compact)
  root.style.setProperty('--accent', a.accent)
  root.style.setProperty('--font-scale', String(a.fontScale))
}

const lastChannelKey = (serverId: string) => `descarga-ultimo-canal-${serverId}`

export function AppProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [servers, setServers] = useState<Server[]>([])
  const [activeServerId, setActiveServerIdRaw] = useState<string | null>(
    () => localStorage.getItem('descarga-ultimo-servidor'),
  )
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannelId, setActiveChannelIdRaw] = useState<string | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [appearance, setAppearanceRaw] = useState<Appearance>(loadAppearance)
  const [profileView, setProfileView] = useState<{ userId: string; anchor?: DOMRect } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobilePane, setMobilePane] = useState<'nav' | 'chat' | 'members'>('chat')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const pending = useRef(new Set<string>())
  const toastTimer = useRef<number | undefined>(undefined)

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3500)
  }, [])

  // ---- perfis (cache) ----
  const ensureProfiles = useCallback(
    (ids: string[]) => {
      const missing = [...new Set(ids)].filter((i) => !profiles[i] && !pending.current.has(i))
      if (!missing.length) return
      missing.forEach((i) => pending.current.add(i))
      void backend.getProfiles(missing).then((list) => {
        setProfiles((prev) => {
          const next = { ...prev }
          for (const p of list) next[p.id] = p
          return next
        })
        missing.forEach((i) => pending.current.delete(i))
      })
    },
    [profiles],
  )

  useEffect(() => {
    void backend.getProfiles([userId]).then(([p]) => p && setProfiles((prev) => ({ ...prev, [p.id]: p })))
    return backend.onProfileChange((p) => setProfiles((prev) => (prev[p.id] ? { ...prev, [p.id]: p } : prev)))
  }, [userId])

  // ---- servidores ----
  const refreshServers = useCallback(async () => {
    const list = await backend.listServers()
    setServers(list)
    setActiveServerIdRaw((cur) => (cur && list.some((s) => s.id === cur) ? cur : (list[0]?.id ?? null)))
  }, [])

  useEffect(() => {
    void refreshServers()
    return backend.onServersChange(() => void refreshServers())
  }, [refreshServers])

  const setActiveServerId = useCallback((id: string | null) => {
    setActiveServerIdRaw(id)
    if (id) localStorage.setItem('descarga-ultimo-servidor', id)
  }, [])

  // ---- canais e membros do servidor ativo ----
  useEffect(() => {
    if (!activeServerId) {
      setChannels([])
      setMemberIds([])
      return
    }
    let alive = true
    const load = async () => {
      const [chs, mids] = await Promise.all([
        backend.listChannels(activeServerId),
        backend.listMemberIds(activeServerId),
      ])
      if (!alive) return
      setChannels(chs)
      setMemberIds(mids)
      setActiveChannelIdRaw((cur) => {
        if (cur && chs.some((c) => c.id === cur && c.type === 'text')) return cur
        const last = localStorage.getItem(lastChannelKey(activeServerId))
        if (last && chs.some((c) => c.id === last)) return last
        return chs.find((c) => c.type === 'text')?.id ?? null
      })
    }
    void load()
    const off = backend.onChannelsChange(activeServerId, () => void load())
    return () => {
      alive = false
      off()
    }
  }, [activeServerId])

  useEffect(() => {
    if (memberIds.length) ensureProfiles(memberIds)
  }, [memberIds, ensureProfiles])

  const setActiveChannelId = useCallback(
    (id: string) => {
      setActiveChannelIdRaw(id)
      if (activeServerId) localStorage.setItem(lastChannelKey(activeServerId), id)
      setMobilePane('chat')
    },
    [activeServerId],
  )

  // ---- aparência ----
  const setAppearance = useCallback((a: Partial<Appearance>) => {
    setAppearanceRaw((prev) => {
      const next = { ...prev, ...a }
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next))
      return next
    })
  }, [])
  useEffect(() => applyAppearance(appearance), [appearance])

  const value = useMemo<AppState>(
    () => ({
      userId,
      me: profiles[userId] ?? null,
      profiles,
      ensureProfiles,
      upsertProfile: (p) => setProfiles((prev) => ({ ...prev, [p.id]: p })),
      servers,
      refreshServers,
      activeServerId,
      setActiveServerId,
      channels,
      activeChannelId,
      setActiveChannelId,
      memberIds,
      appearance,
      setAppearance,
      openProfile: (uid, anchor) => setProfileView({ userId: uid, anchor }),
      profileView,
      closeProfile: () => setProfileView(null),
      settingsOpen,
      setSettingsOpen,
      mobilePane,
      setMobilePane,
      toast,
      toastMsg,
    }),
    [userId, profiles, ensureProfiles, servers, refreshServers, activeServerId, setActiveServerId, channels,
      activeChannelId, setActiveChannelId, memberIds, appearance, setAppearance, profileView, settingsOpen,
      mobilePane, toast, toastMsg],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
