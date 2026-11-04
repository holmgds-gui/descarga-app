import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { backend } from './lib/backend'
import type { Channel, Profile, Server } from './lib/types'
import { local } from './lib/storage'
import { customTheme, themeById } from './lib/themes'

export type ThemeName = string
export interface Appearance {
  theme: ThemeName
  /** cor de fundo escolhida quando o tema é "custom" */
  customBg: string
  accent: string
  fontScale: number
  compact: boolean
}

const DEFAULT_APPEARANCE: Appearance = { theme: 'dark', customBg: '#26303A', accent: '#7B3FE4', fontScale: 1, compact: false }
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
  ask: (q: ConfirmQuestion) => Promise<boolean>
  question: (ConfirmQuestion & { resolve: (v: boolean) => void }) | null
}

export interface ConfirmQuestion {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
}

const Ctx = createContext<AppState | null>(null)

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp fora do AppProvider')
  return v
}

export function loadAppearance(): Appearance {
  try {
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(local.get(APPEARANCE_KEY) ?? '{}') }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function applyAppearance(a: Appearance) {
  const root = document.documentElement
  const t = a.theme === 'custom' ? customTheme(a.customBg) : themeById(a.theme)
  root.dataset.theme = t.id
  root.dataset.tone = t.tone
  root.dataset.compact = String(a.compact)
  const c = t.colors
  const vars: Record<string, string | undefined> = {
    '--bg-rail': c.rail, '--bg-side': c.side, '--bg-chat': c.chat, '--bg-elev': c.elev,
    '--bg-input': c.input, '--bg-float': c.float, '--text': c.text, '--text-2': c.text2, '--text-3': c.text3,
  }
  for (const [k, v] of Object.entries(vars)) {
    if (v) root.style.setProperty(k, v)
    else root.style.removeProperty(k) // usa o padrão do tom (claro/escuro) no CSS
  }
  root.style.setProperty('--accent', a.accent)
  root.style.setProperty('--font-scale', String(a.fontScale))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.rail)
}

const lastChannelKey = (serverId: string) => `descarga-ultimo-canal-${serverId}`

export function AppProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [servers, setServers] = useState<Server[]>([])
  const [activeServerId, setActiveServerIdRaw] = useState<string | null>(
    () => local.get('descarga-ultimo-servidor'),
  )
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannelId, setActiveChannelIdRaw] = useState<string | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [appearance, setAppearanceRaw] = useState<Appearance>(loadAppearance)
  const [profileView, setProfileView] = useState<{ userId: string; anchor?: DOMRect } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobilePane, setMobilePane] = useState<'nav' | 'chat' | 'members'>('chat')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [question, setQuestion] = useState<(ConfirmQuestion & { resolve: (v: boolean) => void }) | null>(null)
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
    if (id) local.set('descarga-ultimo-servidor', id)
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
        const last = local.get(lastChannelKey(activeServerId))
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
      if (activeServerId) local.set(lastChannelKey(activeServerId), id)
      setMobilePane('chat')
    },
    [activeServerId],
  )

  // ---- aparência ----
  const setAppearance = useCallback((a: Partial<Appearance>) => {
    setAppearanceRaw((prev) => {
      const next = { ...prev, ...a }
      local.set(APPEARANCE_KEY, JSON.stringify(next))
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
      ask: (q) =>
        new Promise<boolean>((resolve) =>
          setQuestion({ ...q, resolve: (v) => { setQuestion(null); resolve(v) } }),
        ),
      question,
    }),
    [userId, profiles, ensureProfiles, servers, refreshServers, activeServerId, setActiveServerId, channels,
      activeChannelId, setActiveChannelId, memberIds, appearance, setAppearance, profileView, settingsOpen,
      mobilePane, toast, toastMsg, question],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
