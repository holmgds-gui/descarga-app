import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { backend } from './lib/backend'
import type { Channel, DmChannel, Friendship, Profile, Server, ServerEmoji } from './lib/types'
import { local, session } from './lib/storage'
import { t } from './lib/i18n'
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
  // ---- amigos e conversas diretas ----
  friendships: Friendship[]
  refreshFriends: () => Promise<void>
  dms: DmChannel[]
  refreshDms: () => Promise<void>
  /** conversa direta aberta no Início (null = página de amigos) */
  activeDmId: string | null
  setActiveDmId: (id: string | null) => void
  /** abre (ou cria) a conversa com essas pessoas e mostra na tela */
  openDmWith: (userIds: string[], groupTitle?: string | null) => Promise<void>
  unreadDms: Set<string>
  hideDm: (id: string) => void
  hiddenDms: Record<string, string>
  // ---- emojis dos servidores ----
  emojis: ServerEmoji[]
  emojiById: Map<string, ServerEmoji>
  appearance: Appearance
  setAppearance: (a: Partial<Appearance>) => void
  openProfile: (userId: string, anchor?: DOMRect) => void
  profileView: { userId: string; anchor?: DOMRect } | null
  closeProfile: () => void
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
  /** aba das configurações pedida de fora (ex.: o aviso de novo cadastro abre a Administração) */
  requestedTab: string | null
  clearRequestedTab: () => void
  openAdminPanel: () => void
  /** quantas contas estão esperando aprovação (só o administrador vê) */
  adminPending: number
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
export const SERVER_KEY = 'descarga-ultimo-servidor'
export const DM_KEY = 'descarga-ultima-dm'
/** vem do aviso "novo pedido para entrar": abre o painel de administração */
export const ADMIN_KEY = 'descarga-abrir-admin'
/** valor guardado quando a pessoa está no Início */
export const HOME = '@inicio'
const SEEN_KEY = 'descarga-dm-visto'
const HIDDEN_KEY = 'descarga-dm-escondidas'

function readJson<T>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(local.get(key) ?? '{}') }
  } catch {
    return fallback
  }
}

export function AppProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [servers, setServers] = useState<Server[]>([])
  const [activeServerId, setActiveServerIdRaw] = useState<string | null>(() => {
    const v = local.get(SERVER_KEY)
    return v === HOME ? null : v
  })
  // na primeira vez (nada guardado) abre o primeiro servidor, se tiver
  const firstLoad = useRef(local.get(SERVER_KEY) === null)
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [dms, setDms] = useState<DmChannel[]>([])
  const [dmsLoaded, setDmsLoaded] = useState(false)
  const [activeDmId, setActiveDmIdRaw] = useState<string | null>(() => local.get(DM_KEY))
  const [seen, setSeen] = useState<Record<string, string>>(() => readJson(SEEN_KEY, {}))
  const [hiddenDms, setHidden] = useState<Record<string, string>>(() => readJson(HIDDEN_KEY, {}))
  const [emojis, setEmojis] = useState<ServerEmoji[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannelId, setActiveChannelIdRaw] = useState<string | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [appearance, setAppearanceRaw] = useState<Appearance>(loadAppearance)
  const [profileView, setProfileView] = useState<{ userId: string; anchor?: DOMRect } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [requestedTab, setRequestedTab] = useState<string | null>(null)
  const [adminPending, setAdminPending] = useState(0)
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
    setActiveServerIdRaw((cur) => {
      if (cur === null) {
        const pick = firstLoad.current ? (list[0]?.id ?? null) : null
        firstLoad.current = false
        return pick
      }
      firstLoad.current = false
      // saiu do servidor (ou ele foi apagado): volta para o Início
      return list.some((s) => s.id === cur) ? cur : null
    })
  }, [])

  useEffect(() => {
    void refreshServers()
    return backend.onServersChange(() => void refreshServers())
  }, [refreshServers])

  const setActiveServerId = useCallback((id: string | null) => {
    setActiveServerIdRaw(id)
    firstLoad.current = false
    local.set(SERVER_KEY, id ?? HOME)
  }, [])

  // ---- amigos ----
  const refreshFriends = useCallback(async () => {
    setFriendships(await backend.listFriendships())
  }, [])
  useEffect(() => {
    void refreshFriends()
    return backend.onFriendshipsChange(() => void refreshFriends())
  }, [refreshFriends])

  // ---- conversas diretas ----
  const refreshDms = useCallback(async () => {
    try {
      setDms(await backend.listDms())
    } finally {
      setDmsLoaded(true)
    }
  }, [])
  useEffect(() => {
    void refreshDms()
    return backend.onDmsChange(() => void refreshDms())
  }, [refreshDms])

  const setActiveDmId = useCallback((id: string | null) => {
    setActiveDmIdRaw(id)
    if (id) local.set(DM_KEY, id)
    else local.remove(DM_KEY)
    setActiveServerIdRaw(null)
    firstLoad.current = false
    local.set(SERVER_KEY, HOME)
    setMobilePane('chat')
    if (id)
      setHidden((h) => {
        if (!h[id]) return h
        const next = { ...h }
        delete next[id]
        local.set(HIDDEN_KEY, JSON.stringify(next))
        return next
      })
  }, [])

  // a conversa aberta some (saiu do grupo): volta para os amigos
  useEffect(() => {
    if (dmsLoaded && activeDmId && !dms.some((d) => d.id === activeDmId)) {
      setActiveDmIdRaw(null)
      local.remove(DM_KEY)
    }
  }, [dms, dmsLoaded, activeDmId])

  // a conversa aberta conta como lida
  const viewingDm = activeServerId === null ? activeDmId : null
  useEffect(() => {
    if (!viewingDm) return
    const d = dms.find((x) => x.id === viewingDm)
    const at = d?.last_message_at ?? d?.created_at
    if (!at) return
    setSeen((prev) => {
      if (prev[viewingDm] && prev[viewingDm] >= at) return prev
      const next = { ...prev, [viewingDm]: at }
      local.set(SEEN_KEY, JSON.stringify(next))
      return next
    })
  }, [viewingDm, dms])

  const unreadDms = useMemo(() => {
    const out = new Set<string>()
    for (const d of dms) {
      if (d.id === viewingDm || !d.last_message_at) continue
      const mark = seen[d.id] ?? d.reads[userId] ?? null
      if (!mark || d.last_message_at > mark) out.add(d.id)
    }
    return out
  }, [dms, seen, viewingDm, userId])

  const hideDm = useCallback((id: string) => {
    setHidden((h) => {
      const next = { ...h, [id]: new Date().toISOString() }
      local.set(HIDDEN_KEY, JSON.stringify(next))
      return next
    })
    setActiveDmIdRaw((cur) => (cur === id ? null : cur))
  }, [])

  const openDmWith = useCallback(
    async (userIds: string[], groupTitle?: string | null) => {
      const id = await backend.openDm(userIds, groupTitle)
      await refreshDms()
      setActiveDmId(id)
    },
    [refreshDms, setActiveDmId],
  )

  // perfis de amigos e de quem está nas conversas
  useEffect(() => {
    const ids = [
      ...friendships.flatMap((f) => [f.requester, f.addressee]),
      ...dms.flatMap((d) => d.member_ids),
    ]
    if (ids.length) ensureProfiles(ids)
  }, [friendships, dms, ensureProfiles])

  // ---- emojis próprios dos servidores ----
  useEffect(() => {
    if (!servers.length) {
      setEmojis([])
      return
    }
    const ids = servers.map((s) => s.id)
    const load = () => void backend.listServerEmojis(ids).then(setEmojis).catch(() => undefined)
    load()
    return backend.onEmojisChange(load)
  }, [servers])
  const emojiById = useMemo(() => new Map(emojis.map((e) => [e.id, e])), [emojis])

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

  // ---- administrador: contas esperando aprovação ----
  const isAdmin = !!profiles[userId]?.is_admin
  useEffect(() => {
    if (!isAdmin) {
      setAdminPending(0)
      return
    }
    let first = true
    let prev = 0
    let timer: number | undefined
    const load = () =>
      void backend.adminListUsers().then((list) => {
        const n = list.filter((u) => u.approval === 'pending').length
        if (!first && n > prev) toast(t('Novo pedido para entrar no Descarga'))
        first = false
        prev = n
        setAdminPending(n)
      }).catch(() => undefined)
    const later = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(load, 400)
    }
    load()
    const off = backend.onAdminUsersChange(later)
    return () => {
      window.clearTimeout(timer)
      off()
    }
  }, [isAdmin, toast])

  const openAdminPanel = useCallback(() => {
    setRequestedTab('admin')
    setSettingsOpen(true)
  }, [])
  useEffect(() => {
    if (isAdmin && session.get(ADMIN_KEY)) {
      session.remove(ADMIN_KEY)
      openAdminPanel()
    }
  }, [isAdmin, openAdminPanel])

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
      friendships,
      refreshFriends,
      dms,
      refreshDms,
      activeDmId,
      setActiveDmId,
      openDmWith,
      unreadDms,
      hideDm,
      hiddenDms,
      emojis,
      emojiById,
      appearance,
      setAppearance,
      openProfile: (uid, anchor) => setProfileView({ userId: uid, anchor }),
      profileView,
      closeProfile: () => setProfileView(null),
      settingsOpen,
      setSettingsOpen,
      requestedTab,
      clearRequestedTab: () => setRequestedTab(null),
      openAdminPanel,
      adminPending,
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
      activeChannelId, setActiveChannelId, memberIds, friendships, refreshFriends, dms, refreshDms, activeDmId,
      setActiveDmId, openDmWith, unreadDms, hideDm, hiddenDms, emojis, emojiById, appearance, setAppearance, profileView, settingsOpen,
      requestedTab, openAdminPanel, adminPending, mobilePane, toast, toastMsg, question],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
