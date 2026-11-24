/**
 * Modo demonstração: tudo fica salvo no próprio navegador (localStorage).
 * Serve para ver e testar o Descarga antes de configurar o Supabase.
 * Abra duas abas, entre com contas diferentes e converse entre elas.
 */
import type {
  AdminUser, Report, Attachment, Backend, Channel, DmChannel, Friendship, Message, OnceFile, Pin, PresenceEntry, Profile, Reaction, RealtimeRoom, Server, ServerEmoji, Ban, RoleDef, ServerPrefs, Permission, RolePatch,
} from './types'
import { blobToDataUrl, compressImage } from './image'
import { local, session } from './storage'
import { t } from './i18n'
import { cleanUsername } from './username'

interface DemoUser { id: string; email: string; password: string }
interface Member { server_id: string; user_id: string; joined_at: string; role_ids?: string[] }
interface DmMember { channel_id: string; user_id: string; joined_at: string; last_read_at: string | null }
type DemoChannel = Channel & Partial<Pick<DmChannel, 'is_group' | 'title' | 'owner_id' | 'last_message_at'>>
interface DB {
  users: DemoUser[]
  profiles: Profile[]
  servers: Server[]
  members: Member[]
  channels: DemoChannel[]
  messages: Message[]
  friendships: Friendship[]
  dmMembers: DmMember[]
  reactions: Reaction[]
  emojis: ServerEmoji[]
  pins: Pin[]
  receiptOff: { owner: string; peer: string }[]
  onceViews: { message_id: string; user_id: string; opened_at: string }[]
  roles: RoleDef[]
  bans: Ban[]
  notice?: { body: string; updated_at: string } | null
  reports?: Report[]
  notes?: { owner: string; target: string; note: string; nickname: string }[]
  prefs?: { user: string; server: string; level: ServerPrefs['level']; muted_until: string | null; position?: number | null }[]
}
const FILE_PREFIX = 'descarga-demo-arquivo-'
const DEMO_MAX_FILE = 1024 * 1024

const KEY = 'descarga-demo-db'
const SESSION = 'descarga-demo-session'
const BOT_ID = '00000000-0000-0000-0000-000000000b07'
const WELCOME_ID = '00000000-0000-0000-0000-0000000000a1'

type Event =
  | { type: 'msg-insert' | 'msg-update'; payload: Message }
  | { type: 'msg-delete'; payload: string }
  | { type: 'servers' | 'channels' | 'auth' }
  | { type: 'profile'; payload: Profile }
  | { type: 'friends' | 'dms' | 'emojis' | 'users' | 'receipts' | 'once' }
  | { type: 'pin-add' | 'pin-remove'; payload: Pin }
  | { type: 'reaction-add' | 'reaction-remove'; payload: Reaction }

// no modo demonstração a conta do administrador é a deste e-mail; a aprovação só é exigida quando
// o navegador tem a chave "descarga-demo-aprovacao" = "1" (usada nos testes)
const ADMIN_EMAIL = 'holmgds@gmail.com'
const needsApproval = () => local.get('descarga-demo-aprovacao') === '1'

const now = () => new Date().toISOString()
const id = () => crypto.randomUUID()
const code = () => Math.random().toString(36).slice(2, 10)

function blankProfile(uid: string, username: string): Profile {
  return {
    id: uid, username, display_name: username, avatar_url: null, banner_url: null,
    accent_color: '#7B3FE4', bio: '', pronouns: '', birthday: null, city: '', links: [],
    status: 'online', custom_status: '', read_receipts: true, created_at: now(),
  }
}

function seed(): DB {
  const t = Date.now()
  const at = (minAgo: number) => new Date(t - minAgo * 60000).toISOString()
  const bot: Profile = {
    ...blankProfile(BOT_ID, 'descarga'),
    display_name: 'Descarga',
    avatar_url: import.meta.env.BASE_URL + 'icon-192.png',
    bio: 'Mascote oficial. Dou descarga nos problemas.',
    custom_status: 'Pronto pra descarga 🚽',
  }
  const server: Server = {
    id: WELCOME_ID, name: 'Bem-vindo ao Descarga', icon_url: import.meta.env.BASE_URL + 'icon-192.png', banner_url: null, description: '',
    owner_id: BOT_ID, invite_code: 'descarga', created_at: at(60),
  }
  const ch = (name: string, type: 'text' | 'voice', category: string, position: number, topic = ''): Channel => ({
    id: id(), server_id: WELCOME_ID, name, type, category, topic, position, created_at: at(60),
  })
  const geral = ch('geral', 'text', 'Canais de texto', 0, 'Conversa livre — sejam bem-vindos!')
  const novidades = ch('novidades', 'text', 'Canais de texto', 1, 'O que está chegando no Descarga')
  const msg = (channel: Channel, content: string, minAgo: number): Message => ({
    id: id(), channel_id: channel.id, author_id: BOT_ID, content, reply_to: null, edited_at: null, created_at: at(minAgo), attachments: [],
  })
  return {
    users: [],
    profiles: [bot],
    servers: [server],
    members: [{ server_id: WELCOME_ID, user_id: BOT_ID, joined_at: at(60) }],
    channels: [geral, novidades, ch('memes', 'text', 'Canais de texto', 2), ch('Geral', 'voice', 'Canais de voz', 0), ch('Jogando', 'voice', 'Canais de voz', 1)],
    messages: [
      msg(geral, 'Olá! Este é o **modo demonstração** do Descarga. Tudo fica salvo só neste navegador.', 30),
      msg(geral, 'Dica: abra outra aba, crie outra conta e converse com você mesmo para testar o tempo real.', 29),
      msg(geral, 'Clique no seu avatar lá embaixo ⚙️ para personalizar o perfil: cor, foto, banner, bio, links…', 28),
      msg(novidades, 'Etapa 1 ✅ servidores, canais, chat e perfil\nEtapa 2 ✅ voz, vídeo, tela com som e notificações\nEtapa 3 🔜 amigos, DMs, reações, arquivos, cargos e extras', 20),
    ],
    friendships: [],
    dmMembers: [],
    reactions: [],
    emojis: [],
    pins: [],
    receiptOff: [],
    onceViews: [],
    roles: [],
    bans: [],
  }
}

export function createDemoBackend(): Backend {
  const bus = new BroadcastChannel('descarga-demo')
  const localBus = new EventTarget()

  const load = (): DB => {
    const raw = local.get(KEY)
    if (raw) {
      const db = JSON.parse(raw) as DB
      // bancos de demonstração antigos não tinham estas listas
      db.friendships ??= []
      db.dmMembers ??= []
      db.reactions ??= []
      db.emojis ??= []
      db.pins ??= []
      db.receiptOff ??= []
      db.onceViews ??= []
      db.roles ??= []
      db.bans ??= []
      for (const m of db.messages) m.attachments ??= []
      for (const p of db.profiles) p.read_receipts ??= true
      return db
    }
    const db = seed()
    local.set(KEY, JSON.stringify(db))
    return db
  }
  const save = (db: DB) => {
    try {
      local.set(KEY, JSON.stringify(db))
    } catch {
      throw new Error(t('O armazenamento do modo demonstração encheu. Use imagens menores.'))
    }
  }
  const emit = (e: Event) => {
    bus.postMessage(e)
    localBus.dispatchEvent(new CustomEvent('e', { detail: e }))
  }
  const listen = (fn: (e: Event) => void) => {
    // a mensagem de outra aba pode chegar antes de o localStorage dela aparecer aqui:
    // espera o aviso de "storage" (ou um instante) antes de reler os dados
    const a = (m: MessageEvent) => {
      let done = false
      const run = () => {
        if (done) return
        done = true
        window.removeEventListener('storage', onStorage)
        fn(m.data as Event)
      }
      const onStorage = (s: StorageEvent) => s.key === KEY && run()
      window.addEventListener('storage', onStorage)
      window.setTimeout(run, 150)
    }
    const b = (m: globalThis.Event) => fn((m as CustomEvent).detail as Event)
    bus.addEventListener('message', a)
    localBus.addEventListener('e', b)
    return () => {
      bus.removeEventListener('message', a)
      localBus.removeEventListener('e', b)
    }
  }

  const getSession = () => session.get(SESSION) ?? local.get(SESSION)
  const setSession = (uid: string | null) => {
    if (uid) {
      session.set(SESSION, uid)
      local.set(SESSION, uid)
    } else {
      session.remove(SESSION)
      local.remove(SESSION)
    }
    localBus.dispatchEvent(new CustomEvent('e', { detail: { type: 'auth' } }))
  }
  const me = () => {
    const uid = getSession()
    if (!uid) throw new Error(t('Você não está conectado.'))
    return uid
  }
  const isMember = (db: DB, serverId: string, uid: string) =>
    db.members.some((m) => m.server_id === serverId && m.user_id === uid)
  const isOwner = (db: DB, serverId: string, uid: string) => db.servers.find((x) => x.id === serverId)?.owner_id === uid
  /** o dono pode tudo; os outros, o que o cargo deles permite */
  const has = (db: DB, serverId: string, uid: string, perm: Permission) => {
    if (isOwner(db, serverId, uid)) return true
    return permsOf(db, serverId, uid).includes(perm)
  }
  const permsOf = (db: DB, serverId: string, uid: string): Permission[] => {
    const ids = db.members.find((m) => m.server_id === serverId && m.user_id === uid)?.role_ids ?? []
    return [...new Set(db.roles.filter((r) => ids.includes(r.id)).flatMap((r) => r.permissions))]
  }
  /** quem não é dono só mexe em cargos com permissões que ele mesmo tem */
  const canTouchRole = (db: DB, serverId: string, uid: string, perms: Permission[]) => {
    if (isOwner(db, serverId, uid)) return true
    const mine = permsOf(db, serverId, uid)
    return has(db, serverId, uid, 'manage_roles') && perms.every((p) => mine.includes(p))
  }
  /** pode agir (expulsar/banir) sobre alguém: nunca no dono nem em si; só o dono age sobre quem tem poderes */
  const canActOn = (db: DB, serverId: string, uid: string, target: string) => {
    if (target === uid || isOwner(db, serverId, target)) return false
    if (isOwner(db, serverId, uid)) return true
    return permsOf(db, serverId, target).length === 0
  }

  const createAccount = (db: DB, email: string, password: string, username: string) => {
    const clean = cleanUsername(username).slice(0, 26) || 'usuario'
    let candidate = clean
    let n = 0
    while (db.profiles.some((p) => p.username.toLowerCase() === candidate.toLowerCase())) candidate = clean + ++n
    const uid = id()
    db.users.push({ id: uid, email: email.toLowerCase(), password })
    const profile = blankProfile(uid, candidate)
    profile.is_admin = email.toLowerCase() === ADMIN_EMAIL
    profile.approval = needsApproval() && !profile.is_admin ? 'pending' : 'approved'
    db.profiles.push(profile)
    db.members.push({ server_id: WELCOME_ID, user_id: uid, joined_at: now() })
    return uid
  }

  return {
    mode: 'demo',

    async currentUserId() {
      const uid = getSession()
      return uid && load().users.some((u) => u.id === uid) ? uid : null
    },

    onAuthChange(cb) {
      return listen((e) => {
        if (e.type === 'auth') void this.currentUserId().then(cb)
      })
    },

    async signUp(email, password, username) {
      const db = load()
      if (db.users.some((u) => u.email === email.toLowerCase())) throw new Error(t('Esse e-mail já tem conta. Tente entrar.'))
      if (password.length < 6) throw new Error(t('A senha precisa ter pelo menos 6 caracteres.'))
      const uid = createAccount(db, email, password, username)
      save(db)
      setSession(uid)
      emit({ type: 'channels' })
      emit({ type: 'users' })
      return { needsConfirmation: false }
    },

    async signIn(email, password) {
      const u = load().users.find((x) => x.email === email.toLowerCase() && x.password === password)
      if (!u) throw new Error(t('E-mail ou senha incorretos.'))
      setSession(u.id)
    },

    async signInWithGoogle() {
      // no modo demonstração, simula uma conta Google
      const db = load()
      const n = db.users.filter((u) => u.email.endsWith('@google.demo')).length + 1
      const uid = createAccount(db, `conta${n}@google.demo`, code(), `google${n}`)
      save(db)
      setSession(uid)
      emit({ type: 'channels' })
      emit({ type: 'users' })
    },

    async signOut() {
      setSession(null)
    },

    async getProfiles(ids) {
      const set = new Set(ids)
      return load().profiles.filter((p) => set.has(p.id))
    },

    async updateProfile(patch) {
      const db = load()
      const uid = me()
      if (patch.username && db.profiles.some((p) => p.username.toLowerCase() === patch.username!.toLowerCase() && p.id !== uid))
        throw new Error(t('Esse nome de usuário já está em uso.'))
      const i = db.profiles.findIndex((p) => p.id === uid)
      db.profiles[i] = { ...db.profiles[i], ...patch }
      save(db)
      emit({ type: 'profile', payload: db.profiles[i] })
      return db.profiles[i]
    },

    async uploadImage(file, kind) {
      return blobToDataUrl(await compressImage(file, kind))
    },

    onProfileChange(cb) {
      return listen((e) => {
        if (e.type === 'profile') cb(e.payload)
      })
    },

    // ---------- administração ----------
    async adminListUsers() {
      const db = load()
      const mine = db.profiles.find((p) => p.id === me())
      if (!mine?.is_admin) throw new Error(t('Só o administrador pode fazer isso.'))
      const order = { pending: 0, approved: 1, blocked: 2 } as const
      return db.profiles
        .filter((p) => p.id !== BOT_ID && !p.deleted_at)
        .map((p): AdminUser => ({
          id: p.id, email: db.users.find((u) => u.id === p.id)?.email ?? '', username: p.username,
          display_name: p.display_name, avatar_url: p.avatar_url, approval: p.approval ?? 'approved',
          is_admin: !!p.is_admin, created_at: p.created_at, last_sign_in_at: p.created_at,
        }))
        .sort((a, b) => order[a.approval] - order[b.approval] || b.created_at.localeCompare(a.created_at))
    },
    async acceptTerms(version) {
      const db = load()
      const i = db.profiles.findIndex((p) => p.id === me())
      if (i < 0) return
      db.profiles[i] = { ...db.profiles[i], terms_version: version }
      save(db)
      emit({ type: 'profile', payload: db.profiles[i] })
    },

    async adminSetApproval(userId, status) {
      const db = load()
      if (!db.profiles.find((p) => p.id === me())?.is_admin) throw new Error(t('Só o administrador pode fazer isso.'))
      const i = db.profiles.findIndex((p) => p.id === userId)
      if (i < 0) return
      if (db.profiles[i].is_admin) throw new Error(t('A conta do administrador não pode ser alterada.'))
      db.profiles[i] = { ...db.profiles[i], approval: status }
      save(db)
      emit({ type: 'profile', payload: db.profiles[i] })
      emit({ type: 'users' })
    },
    async deleteAccount(userId) {
      const db = load()
      const self = me()
      const target = userId ?? self
      const mine = db.profiles.find((p) => p.id === self)
      if (!target) return
      if (target !== self && !mine?.is_admin) throw new Error(t('Só o administrador pode fazer isso.'))
      const i = db.profiles.findIndex((p) => p.id === target)
      if (i < 0) return
      if (db.profiles[i].is_admin) throw new Error(t('A conta do administrador não pode ser excluída.'))
      db.users = db.users.filter((u) => u.id !== target)
      db.members = db.members.filter((m) => m.user_id !== target)
      db.dmMembers = db.dmMembers.filter((m) => m.user_id !== target)
      db.friendships = db.friendships.filter((f) => f.requester !== target && f.addressee !== target)
      db.reactions = db.reactions.filter((r) => r.user_id !== target)
      db.profiles[i] = {
        ...db.profiles[i], username: 'excluido-' + target.replace(/-/g, '').slice(0, 12), display_name: 'Usuário excluído',
        avatar_url: null, banner_url: null, bio: '', pronouns: '', city: '', links: [], custom_status: '', status: 'invisible',
        approval: 'blocked', deleted_at: now(),
      }
      save(db)
      emit({ type: 'profile', payload: db.profiles[i] })
      emit({ type: 'users' })
      if (target === self) setSession(null)
    },
    async reportUser(reportedId, reason, details) {
      const db = load()
      const mine = (db.reports ?? []).filter((r) => r.reporter_id === me() && Date.now() - new Date(r.created_at).getTime() < 864e5)
      if (mine.length >= 5) throw new Error(t('Você já enviou o máximo de denúncias de hoje. Tente de novo amanhã.'))
      db.reports = [...(db.reports ?? []), { id: crypto.randomUUID(), reporter_id: me(), reported_id: reportedId, reason, details: details.trim().slice(0, 1000), status: 'open', created_at: new Date().toISOString() }]
      save(db)
    },
    async adminListReports() {
      const db = load()
      if (!db.profiles.find((p) => p.id === me())?.is_admin) throw new Error(t('Só o administrador pode fazer isso.'))
      return [...(db.reports ?? [])].sort((a, b) => (a.status === b.status ? b.created_at.localeCompare(a.created_at) : a.status === 'open' ? -1 : 1))
    },
    async adminResolveReport(id, resolved) {
      const db = load()
      if (!db.profiles.find((p) => p.id === me())?.is_admin) throw new Error(t('Só o administrador pode fazer isso.'))
      db.reports = (db.reports ?? []).map((r) => (r.id === id ? { ...r, status: resolved ? 'resolved' : 'open' } : r))
      save(db)
    },

    onAdminUsersChange(cb) {
      return listen((e) => (e.type === 'users' || e.type === 'profile' || e.type === 'auth') && cb())
    },

    async listServers() {
      const db = load()
      const uid = me()
      return db.members
        .filter((m) => m.user_id === uid)
        .map((m) => db.servers.find((s) => s.id === m.server_id))
        .filter((s): s is Server => !!s)
    },

    async createServer(name, iconUrl) {
      const db = load()
      const uid = me()
      const s: Server = { id: id(), name, icon_url: iconUrl, banner_url: null, description: '', owner_id: uid, invite_code: code(), created_at: now() }
      db.servers.push(s)
      db.members.push({ server_id: s.id, user_id: uid, joined_at: now() })
      const mk = (name: string, type: 'text' | 'voice', category: string, position: number): Channel => ({
        id: id(), server_id: s.id, name, type, category, topic: '', position, created_at: now(),
      })
      db.channels.push(
        mk('geral', 'text', 'Canais de texto', 0),
        mk('Geral', 'voice', 'Canais de voz', 0),
      )
      save(db)
      emit({ type: 'servers' })
      return s
    },

    async joinServer(c) {
      const db = load()
      const uid = me()
      const clean = c.trim().split('/').pop() ?? ''
      const s = db.servers.find((x) => x.invite_code === clean)
      if (!s) throw new Error(t('Convite inválido ou expirado.'))
      if (db.bans.some((b) => b.server_id === s.id && b.user_id === uid)) throw new Error(t('Você foi banido deste servidor.'))
      if (!isMember(db, s.id, uid)) db.members.push({ server_id: s.id, user_id: uid, joined_at: now() })
      save(db)
      emit({ type: 'servers' })
      emit({ type: 'channels' })
      return s
    },

    async leaveServer(serverId) {
      const db = load()
      const uid = me()
      db.members = db.members.filter((m) => !(m.server_id === serverId && m.user_id === uid))
      save(db)
      emit({ type: 'servers' })
      emit({ type: 'channels' })
    },

    async updateServer(serverId, patch) {
      const db = load()
      const s = db.servers.find((x) => x.id === serverId)
      if (!s || !has(db, serverId, me(), 'manage_server')) throw new Error(t('Você não tem permissão para mudar este servidor.'))
      if (patch.name !== undefined) s.name = patch.name
      if (patch.icon_url !== undefined) s.icon_url = patch.icon_url
      if (patch.banner_url !== undefined) s.banner_url = patch.banner_url
      if (patch.description !== undefined) s.description = patch.description
      save(db)
      emit({ type: 'servers' })
      return { ...s }
    },

    async listRoles(serverId) {
      return load().roles.filter((r) => r.server_id === serverId)
    },
    async createRole(serverId, role) {
      const db = load()
      if (!canTouchRole(db, serverId, me(), role.permissions)) throw new Error(t('Só o dono do servidor pode mexer nos cargos.'))
      const r: RoleDef = { id: id(), server_id: serverId, name: role.name, color: role.color, permissions: role.permissions, hoist: role.hoist }
      db.roles.push(r)
      save(db)
      emit({ type: 'servers' })
      return r
    },
    async updateRole(roleId, patch: RolePatch) {
      const db = load()
      const r = db.roles.find((x) => x.id === roleId)
      if (!r || !canTouchRole(db, r.server_id, me(), r.permissions) || !canTouchRole(db, r.server_id, me(), patch.permissions ?? r.permissions)) throw new Error(t('Só o dono do servidor pode mexer nos cargos.'))
      Object.assign(r, patch)
      save(db)
      emit({ type: 'servers' })
      return { ...r }
    },
    async deleteRole(roleId) {
      const db = load()
      const r = db.roles.find((x) => x.id === roleId)
      if (!r || !canTouchRole(db, r.server_id, me(), r.permissions)) throw new Error(t('Só o dono do servidor pode mexer nos cargos.'))
      db.roles = db.roles.filter((x) => x.id !== roleId)
      for (const m of db.members) m.role_ids = (m.role_ids ?? []).filter((x) => x !== roleId)
      save(db)
      emit({ type: 'servers' })
    },
    async listMemberRoles(serverId) {
      const db = load()
      return Object.fromEntries(db.members.filter((m) => m.server_id === serverId).map((m) => [m.user_id, m.role_ids ?? []]))
    },
    async setMemberRole(serverId, userId, roleId, on) {
      const db = load()
      const role = db.roles.find((r) => r.id === roleId && r.server_id === serverId)
      const denied = new Error(t('Você não pode mexer nos cargos dessa pessoa.'))
      const selfOk = userId === me() && isOwner(db, serverId, me()) // o dono pode se dar cargos (só enfeite)
      if (!role || !has(db, serverId, me(), 'manage_roles') || (!selfOk && (userId === me() || isOwner(db, serverId, userId)))) throw denied
      if (!isOwner(db, serverId, me())) {
        const mine = permsOf(db, serverId, me())
        if (!role.permissions.every((p) => mine.includes(p)) || !permsOf(db, serverId, userId).every((p) => mine.includes(p))) throw denied
      }
      const m = db.members.find((x) => x.server_id === serverId && x.user_id === userId)
      if (!m) throw denied
      const set = new Set(m.role_ids ?? [])
      if (on) set.add(roleId)
      else set.delete(roleId)
      m.role_ids = [...set]
      save(db)
      emit({ type: 'servers' })
    },
    async listServerPrefs() {
      const db = load()
      return Object.fromEntries((db.prefs ?? []).filter((p) => p.user === me()).map((p) => [p.server, { level: p.level, muted_until: p.muted_until, position: p.position ?? null }]))
    },
    async setServerPrefs(serverId, p) {
      const db = load()
      const old = (db.prefs ?? []).find((x) => x.user === me() && x.server === serverId)
      db.prefs = (db.prefs ?? []).filter((x) => !(x.user === me() && x.server === serverId))
      db.prefs.push({ user: me(), server: serverId, level: p.level, muted_until: p.muted_until, position: old?.position ?? null })
      save(db)
    },
    async setServerOrder(orderedIds) {
      const db = load()
      const prefs = db.prefs ?? []
      orderedIds.forEach((id, i) => {
        const row = prefs.find((x) => x.user === me() && x.server === id)
        if (row) row.position = i
        else prefs.push({ user: me(), server: id, level: 'all', muted_until: null, position: i })
      })
      db.prefs = prefs
      save(db)
    },
    async getNotice() {
      return load().notice ?? null
    },
    async setNotice(body) {
      const db = load()
      if (!db.profiles.find((p) => p.id === me())?.is_admin) throw new Error(t('Só o administrador pode fazer isso.'))
      const text = body.trim().slice(0, 500)
      db.notice = text ? { body: text, updated_at: new Date().toISOString() } : null
      save(db)
    },
    async listUserNotes() {
      const db = load()
      return Object.fromEntries((db.notes ?? []).filter((n) => n.owner === me()).map((n) => [n.target, { note: n.note, nickname: n.nickname }]))
    },
    async setUserNote(targetId, n) {
      const db = load()
      db.notes = (db.notes ?? []).filter((x) => !(x.owner === me() && x.target === targetId))
      if (n.note.trim() || n.nickname.trim()) db.notes.push({ owner: me(), target: targetId, note: n.note.trim(), nickname: n.nickname.trim() })
      save(db)
    },
    async kickMember(serverId, userId) {
      const db = load()
      if (!has(db, serverId, me(), 'kick') || !canActOn(db, serverId, me(), userId)) throw new Error(t('Você não pode expulsar essa pessoa.'))
      db.members = db.members.filter((m) => !(m.server_id === serverId && m.user_id === userId))
      save(db)
      emit({ type: 'servers' })
      emit({ type: 'channels' })
    },
    async banMember(serverId, userId, reason) {
      const db = load()
      if (!has(db, serverId, me(), 'ban') || !canActOn(db, serverId, me(), userId)) throw new Error(t('Você não pode banir essa pessoa.'))
      const p = db.profiles.find((x) => x.id === userId)
      db.bans = db.bans.filter((b) => !(b.server_id === serverId && b.user_id === userId))
      db.bans.push({ server_id: serverId, user_id: userId, username: p?.username ?? '', display_name: p?.display_name ?? '', reason: reason.slice(0, 200), banned_at: now() })
      db.members = db.members.filter((m) => !(m.server_id === serverId && m.user_id === userId))
      save(db)
      emit({ type: 'servers' })
      emit({ type: 'channels' })
    },
    async unbanMember(serverId, userId) {
      const db = load()
      if (!has(db, serverId, me(), 'ban')) throw new Error(t('Você não pode desbanir pessoas aqui.'))
      db.bans = db.bans.filter((b) => !(b.server_id === serverId && b.user_id === userId))
      save(db)
      emit({ type: 'servers' })
    },
    async listBans(serverId) {
      const db = load()
      if (!has(db, serverId, me(), 'ban')) return []
      return db.bans.filter((b) => b.server_id === serverId)
    },
    async deleteServer(serverId) {
      const db = load()
      if (!isOwner(db, serverId, me())) throw new Error(t('Só o dono do servidor pode apagá-lo.'))
      const chIds = new Set(db.channels.filter((c) => c.server_id === serverId).map((c) => c.id))
      db.servers = db.servers.filter((x) => x.id !== serverId)
      db.members = db.members.filter((m) => m.server_id !== serverId)
      db.channels = db.channels.filter((c) => c.server_id !== serverId)
      db.messages = db.messages.filter((m) => !chIds.has(m.channel_id))
      db.roles = db.roles.filter((r) => r.server_id !== serverId)
      db.bans = db.bans.filter((b) => b.server_id !== serverId)
      save(db)
      emit({ type: 'servers' })
      emit({ type: 'channels' })
    },

    onServersChange(cb) {
      return listen((e) => {
        if (e.type === 'servers') cb()
      })
    },

    async listChannels(serverId) {
      return load()
        .channels.filter((c) => c.server_id === serverId)
        .sort((a, b) => a.position - b.position)
    },

    async createChannel(serverId, name, type, category) {
      const db = load()
      const uid = me()
      if (!has(db, serverId, uid, 'manage_channels')) throw new Error(t('Só o dono e os moderadores podem criar canais.'))
      const c: Channel = {
        id: id(), server_id: serverId, name, type, category, topic: '',
        position: db.channels.filter((x) => x.server_id === serverId).length, created_at: now(),
      }
      db.channels.push(c)
      save(db)
      emit({ type: 'channels' })
      return c
    },

    async renameChannel(channelId, name) {
      const db = load()
      const c = db.channels.find((x) => x.id === channelId)
      if (!c?.server_id || !has(db, c.server_id, me(), 'manage_channels')) throw new Error(t('Você não tem permissão para mudar este canal.'))
      c.name = name
      save(db)
      emit({ type: 'channels' })
    },

    async deleteChannel(channelId) {
      const db = load()
      const c = db.channels.find((x) => x.id === channelId)
      if (!c?.server_id || !has(db, c.server_id, me(), 'manage_channels')) throw new Error(t('Você não tem permissão para apagar este canal.'))
      db.channels = db.channels.filter((x) => x.id !== channelId)
      db.messages = db.messages.filter((m) => m.channel_id !== channelId)
      save(db)
      emit({ type: 'channels' })
    },

    async reorderChannels(serverId, orderedIds) {
      const db = load()
      if (!has(db, serverId, me(), 'manage_channels')) throw new Error(t('Você não tem permissão para mudar este canal.'))
      orderedIds.forEach((id, position) => {
        const c = db.channels.find((x) => x.id === id && x.server_id === serverId)
        if (c) c.position = position
      })
      save(db)
      emit({ type: 'channels' })
    },

    onChannelsChange(_serverId, cb) {
      return listen((e) => {
        if (e.type === 'channels' || e.type === 'servers') cb()
      })
    },

    async listMemberIds(serverId) {
      const db = load()
      // quem ainda não foi aprovado (ou foi bloqueado) não aparece nas listas
      const ok = new Set(db.profiles.filter((p) => (p.approval ?? 'approved') === 'approved').map((p) => p.id))
      return db.members.filter((m) => m.server_id === serverId && ok.has(m.user_id)).map((m) => m.user_id)
    },

    async listMessages(channelId, before) {
      const all = load()
        .messages.filter((m) => m.channel_id === channelId && (!before || m.created_at < before))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
      return all.slice(-50)
    },

    async sendMessage(channelId, content, replyTo, attachments = []) {
      const db = load()
      const m: Message = {
        id: id(), channel_id: channelId, author_id: me(), content, reply_to: replyTo, edited_at: null, created_at: now(), attachments,
      }
      db.messages.push(m)
      const ch = db.channels.find((c) => c.id === channelId)
      if (ch?.type === 'dm') ch.last_message_at = m.created_at
      save(db)
      emit({ type: 'msg-insert', payload: m })
      if (ch?.type === 'dm') emit({ type: 'dms' })
      return m
    },

    async editMessage(mid, content) {
      const db = load()
      const m = db.messages.find((x) => x.id === mid && x.author_id === me())
      if (!m) return
      m.content = content
      m.edited_at = now()
      save(db)
      emit({ type: 'msg-update', payload: m })
    },

    async deleteMessage(mid) {
      const db = load()
      const uid = me()
      const target = db.messages.find((x) => x.id === mid)
      const ch = target && db.channels.find((c) => c.id === target.channel_id)
      const modOk = !!target && !!ch?.server_id && has(db, ch.server_id, uid, 'manage_messages') && canActOn(db, ch.server_id, uid, target.author_id)
      db.messages = db.messages.filter((x) => !(x.id === mid && (x.author_id === uid || modOk)))
      save(db)
      emit({ type: 'msg-delete', payload: mid })
    },

    subscribeMessages(channelId, h) {
      return listen((e) => {
        if (e.type === 'msg-insert' && e.payload.channel_id === channelId) h.onInsert(e.payload)
        else if (e.type === 'msg-update' && e.payload.channel_id === channelId) h.onUpdate(e.payload)
        else if (e.type === 'msg-delete') h.onDelete(e.payload)
      })
    },

    openRoom(topic) {
      return createDemoRoom(topic)
    },

    // ---------- amigos ----------
    async listFriendships() {
      const uid = me()
      return load().friendships.filter((f) => f.requester === uid || f.addressee === uid)
    },
    async sendFriendRequest(username) {
      const db = load()
      const uid = me()
      const other = db.profiles.find((p) => p.username.toLowerCase() === username.trim().replace(/^@/, '').toLowerCase())
      if (!other) throw new Error(t('Não achamos ninguém com esse nome de usuário.'))
      if (other.id === uid) throw new Error(t('Você não pode adicionar a si mesmo.'))
      const f = db.friendships.find((x) => (x.requester === uid && x.addressee === other.id) || (x.addressee === uid && x.requester === other.id))
      if (f?.status === 'accepted') throw new Error(t('Vocês já são amigos.'))
      if (f && f.requester === uid) throw new Error(t('Você já mandou um pedido para essa pessoa.'))
      if (f) f.status = 'accepted'
      else db.friendships.push({ id: id(), requester: uid, addressee: other.id, status: 'pending', created_at: now() })
      save(db)
      emit({ type: 'friends' })
    },
    async acceptFriend(fid) {
      const db = load()
      const f = db.friendships.find((x) => x.id === fid && x.addressee === me())
      if (f) f.status = 'accepted'
      save(db)
      emit({ type: 'friends' })
    },
    async removeFriendship(fid) {
      const db = load()
      const uid = me()
      db.friendships = db.friendships.filter((x) => !(x.id === fid && (x.requester === uid || x.addressee === uid)))
      save(db)
      emit({ type: 'friends' })
    },
    onFriendshipsChange(cb) {
      return listen((e) => e.type === 'friends' && cb())
    },

    // ---------- mensagens diretas ----------
    async listDms() {
      const db = load()
      const uid = me()
      const mine = new Set(db.dmMembers.filter((m) => m.user_id === uid).map((m) => m.channel_id))
      return db.channels
        .filter((c) => c.type === 'dm' && mine.has(c.id))
        .map((c) => {
          const list = db.dmMembers.filter((m) => m.channel_id === c.id)
          return {
            ...c, type: 'dm', is_group: !!c.is_group, title: c.title ?? null, owner_id: c.owner_id ?? null,
            last_message_at: c.last_message_at ?? null, member_ids: list.map((m) => m.user_id),
            reads: Object.fromEntries(list.map((m) => [m.user_id, m.last_read_at])),
          } as DmChannel
        })
        .sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at))
    },
    async openDm(userIds, groupTitle = null) {
      const db = load()
      const uid = me()
      const others = [...new Set(userIds)].filter((x) => x !== uid)
      if (!others.length) throw new Error(t('Escolha pelo menos uma pessoa.'))
      if (others.length > 9) throw new Error(t('Um grupo pode ter no máximo 10 pessoas.'))
      if (others.length === 1 && groupTitle == null) {
        const existing = db.channels.find((c) => c.type === 'dm' && !c.is_group &&
          db.dmMembers.some((m) => m.channel_id === c.id && m.user_id === uid) &&
          db.dmMembers.some((m) => m.channel_id === c.id && m.user_id === others[0]))
        if (existing) return existing.id
      }
      const isGroup = !(others.length === 1 && groupTitle == null)
      const c: DemoChannel = {
        id: id(), server_id: null, name: isGroup ? 'grupo' : 'dm', type: 'dm', category: '', topic: '', position: 0,
        created_at: now(), is_group: isGroup, title: groupTitle?.trim() || null, owner_id: uid, last_message_at: null,
      }
      db.channels.push(c)
      for (const u of [uid, ...others]) db.dmMembers.push({ channel_id: c.id, user_id: u, joined_at: now(), last_read_at: null })
      save(db)
      emit({ type: 'dms' })
      return c.id
    },
    async addToGroup(channelId, userIds) {
      const db = load()
      const count = db.dmMembers.filter((m) => m.channel_id === channelId).length
      if (count + userIds.length > 10) throw new Error(t('Um grupo pode ter no máximo 10 pessoas.'))
      for (const u of userIds)
        if (!db.dmMembers.some((m) => m.channel_id === channelId && m.user_id === u))
          db.dmMembers.push({ channel_id: channelId, user_id: u, joined_at: now(), last_read_at: null })
      save(db)
      emit({ type: 'dms' })
    },
    async renameGroup(channelId, title) {
      const db = load()
      const c = db.channels.find((x) => x.id === channelId)
      if (c) c.title = title.trim() || null
      save(db)
      emit({ type: 'dms' })
    },
    async leaveDm(channelId) {
      const db = load()
      const uid = me()
      db.dmMembers = db.dmMembers.filter((m) => !(m.channel_id === channelId && m.user_id === uid))
      save(db)
      emit({ type: 'dms' })
    },
    async markRead(channelId) {
      const db = load()
      const uid = me()
      if (!db.profiles.find((p) => p.id === uid)?.read_receipts) return
      const m = db.dmMembers.find((x) => x.channel_id === channelId && x.user_id === uid)
      if (!m) return
      m.last_read_at = now()
      save(db)
      emit({ type: 'dms' })
    },
    onDmsChange(cb) {
      return listen((e) => e.type === 'dms' && cb())
    },

    // ---------- encaminhar, fixar, leitura por pessoa e visualização única ----------
    async forwardMessage(messageId, targetChannelIds) {
      const db = load()
      const src = db.messages.find((x) => x.id === messageId)
      if (!src) throw new Error(t('Mensagem não encontrada.'))
      const uid = me()
      for (const target of targetChannelIds) {
        const atts: Attachment[] = []
        for (const a of src.attachments) {
          if (a.once || a.gone) continue
          const path = `${target}/${uid}/${id()}-${a.name}`
          const data = local.get(FILE_PREFIX + a.path)
          if (data) local.set(FILE_PREFIX + path, data)
          atts.push({ ...a, path })
        }
        if (!src.content && !atts.length) continue
        const m: Message = {
          id: id(), channel_id: target, author_id: uid, content: src.content, reply_to: null, edited_at: null,
          created_at: now(), attachments: atts, forwarded: true,
        }
        db.messages.push(m)
        const ch = db.channels.find((c) => c.id === target)
        if (ch?.type === 'dm') ch.last_message_at = m.created_at
        save(db)
        emit({ type: 'msg-insert', payload: m })
        if (ch?.type === 'dm') emit({ type: 'dms' })
      }
    },
    async getMessages(ids) {
      const set = new Set(ids)
      return load().messages.filter((m) => set.has(m.id))
    },
    async listPins(channelId) {
      return load().pins.filter((p) => p.channel_id === channelId)
    },
    async pinMessage(messageId, channelId) {
      const db = load()
      if (db.pins.some((p) => p.message_id === messageId)) return
      const p: Pin = { message_id: messageId, channel_id: channelId, pinned_by: me(), pinned_at: now() }
      db.pins.push(p)
      save(db)
      emit({ type: 'pin-add', payload: p })
    },
    async unpinMessage(messageId) {
      const db = load()
      const p = db.pins.find((x) => x.message_id === messageId)
      if (!p) return
      db.pins = db.pins.filter((x) => x !== p)
      save(db)
      emit({ type: 'pin-remove', payload: p })
    },
    subscribePins(channelId, h) {
      return listen((e) => {
        if (e.type === 'pin-add' && e.payload.channel_id === channelId) h.onAdd(e.payload)
        if (e.type === 'pin-remove' && e.payload.channel_id === channelId) h.onRemove(e.payload)
      })
    },
    async listReceiptOff() {
      const uid = me()
      const rows = load().receiptOff
      return { mine: rows.filter((r) => r.owner === uid).map((r) => r.peer), theirs: rows.filter((r) => r.peer === uid).map((r) => r.owner) }
    },
    async setReceiptOff(peerId, off) {
      const db = load()
      const uid = me()
      db.receiptOff = db.receiptOff.filter((r) => !(r.owner === uid && r.peer === peerId))
      if (off) db.receiptOff.push({ owner: uid, peer: peerId })
      save(db)
      emit({ type: 'receipts' })
    },
    onReceiptOffChange(cb) {
      return listen((e) => e.type === 'receipts' && cb())
    },
    async openOnce(messageId) {
      const db = load()
      const uid = me()
      const m = db.messages.find((x) => x.id === messageId)
      if (!m || m.author_id === uid) return null
      if (!m.attachments.some((a) => a.once && !a.gone)) return null
      if (db.onceViews.some((v) => v.message_id === messageId && v.user_id === uid)) return null
      db.onceViews.push({ message_id: messageId, user_id: uid, opened_at: now() })
      save(db)
      emit({ type: 'once' })
      const files: OnceFile[] = []
      for (const a of m.attachments) {
        if (!a.once || a.gone) continue
        const url = local.get(FILE_PREFIX + a.path)
        if (url) files.push({ path: a.path, url, name: a.name, type: a.type, kind: a.kind })
      }
      return files
    },
    async finishOnce(messageId) {
      const db = load()
      const uid = me()
      const m = db.messages.find((x) => x.id === messageId)
      if (!m || !db.onceViews.some((v) => v.message_id === messageId && v.user_id === uid)) return
      const recipients = db.dmMembers.filter((d) => d.channel_id === m.channel_id && d.user_id !== m.author_id).map((d) => d.user_id)
      const opened = new Set(db.onceViews.filter((v) => v.message_id === messageId).map((v) => v.user_id))
      if (!recipients.every((r) => opened.has(r))) return
      for (const a of m.attachments) {
        if (a.once) {
          local.remove(FILE_PREFIX + a.path)
          a.gone = true
        }
      }
      save(db)
      emit({ type: 'msg-update', payload: m })
    },
    async listOnceViews(messageIds) {
      const uid = me()
      const db = load()
      const out: Record<string, string[]> = {}
      for (const mid of messageIds) {
        const m = db.messages.find((x) => x.id === mid)
        if (!m) continue
        const views = db.onceViews.filter((v) => v.message_id === mid && (m.author_id === uid || v.user_id === uid))
        if (views.length) out[mid] = views.map((v) => v.user_id)
      }
      return out
    },
    onOnceViewsChange(cb) {
      return listen((e) => e.type === 'once' && cb())
    },

    // ---------- reações e emojis ----------
    async listReactions(channelId, messageIds) {
      const ids = new Set(messageIds)
      return load().reactions.filter((r) => r.channel_id === channelId && ids.has(r.message_id))
    },
    async addReaction(messageId, channelId, emoji) {
      const db = load()
      const r: Reaction = { message_id: messageId, channel_id: channelId, emoji, user_id: me() }
      if (db.reactions.some((x) => x.message_id === messageId && x.user_id === r.user_id && x.emoji === emoji)) return
      db.reactions.push(r)
      save(db)
      emit({ type: 'reaction-add', payload: r })
    },
    async removeReaction(messageId, emoji) {
      const db = load()
      const uid = me()
      const r = db.reactions.find((x) => x.message_id === messageId && x.user_id === uid && x.emoji === emoji)
      if (!r) return
      db.reactions = db.reactions.filter((x) => x !== r)
      save(db)
      emit({ type: 'reaction-remove', payload: r })
    },
    subscribeReactions(channelId, h) {
      return listen((e) => {
        if (e.type === 'reaction-add' && e.payload.channel_id === channelId) h.onAdd(e.payload)
        if (e.type === 'reaction-remove' && e.payload.channel_id === channelId) h.onRemove(e.payload)
      })
    },
    async listServerEmojis(serverIds) {
      const ids = new Set(serverIds)
      return load().emojis.filter((e) => ids.has(e.server_id))
    },
    async addServerEmoji(serverId, name, file) {
      const db = load()
      if (!has(db, serverId, me(), 'manage_emojis')) throw new Error(t('Você não tem permissão para isso.'))
      if (db.emojis.some((e) => e.server_id === serverId && e.name === name)) throw new Error(t('Já existe um emoji com esse nome neste servidor.'))
      const url = await blobToDataUrl(await compressImage(file, 'emoji'))
      const e: ServerEmoji = { id: id(), server_id: serverId, name, url }
      db.emojis.push(e)
      save(db)
      emit({ type: 'emojis' })
      return e
    },
    async deleteServerEmoji(eid) {
      const db = load()
      const em = db.emojis.find((e) => e.id === eid)
      if (em && !has(db, em.server_id, me(), 'manage_emojis')) throw new Error(t('Você não tem permissão para isso.'))
      db.emojis = db.emojis.filter((e) => e.id !== eid)
      save(db)
      emit({ type: 'emojis' })
    },
    onEmojisChange(cb) {
      return listen((e) => e.type === 'emojis' && cb())
    },

    // ---------- arquivos (no modo demonstração, até 1 MB e só neste navegador) ----------
    maxUploadBytes: DEMO_MAX_FILE,
    async uploadAttachment(channelId, file, meta) {
      if (file.size > DEMO_MAX_FILE) throw new Error(t('No modo demonstração, os arquivos podem ter até 1 MB.'))
      const path = `${channelId}/${me()}/${id()}-${meta.name}`
      const type = meta.type || file.type || 'application/octet-stream'
      try {
        local.set(FILE_PREFIX + path, await blobToDataUrl(file))
      } catch {
        throw new Error(t('O armazenamento do modo demonstração encheu. Use imagens menores.'))
      }
      return { ...meta, path, size: file.size, type } as Attachment
    },
    async attachmentUrls(paths) {
      const out: Record<string, string> = {}
      for (const p of paths) {
        const v = local.get(FILE_PREFIX + p)
        if (v) out[p] = v
      }
      return out
    },

    async authOptions() {
      return { google: true }
    },
    async resetPassword() {
      throw new Error(t('No modo demonstração não há e-mail. Crie outra conta.'))
    },
    async updatePassword(password) {
      const db = load()
      const u = db.users.find((x) => x.id === me())
      if (u) u.password = password
      save(db)
    },
    onPasswordRecovery() {
      return () => undefined
    },
    async getIceServers() {
      return [{ urls: ['stun:stun.l.google.com:19302'] }]
    },

    pushSupported: false,
    async savePushSubscription() {},
    async removePushSubscription() {},
    async notify() {},
  }
}

/** Sala de tempo real entre abas do mesmo navegador (para testar calls no modo demonstração). */
function createDemoRoom(topic: string): RealtimeRoom {
  const key = crypto.randomUUID()
  const bc = new BroadcastChannel(`descarga-sala-${topic}`)
  const bcast = new Set<(e: string, p: Record<string, unknown>) => void>()
  const pres = new Set<(entries: PresenceEntry[]) => void>()
  const others = new Map<string, { state: Record<string, unknown>; seen: number }>()
  let mine: Record<string, unknown> | null = null
  type Wire =
    | { kind: 'bc'; event: string; payload: Record<string, unknown> }
    | { kind: 'presence'; key: string; state: Record<string, unknown> | null }
    | { kind: 'hello' }

  const entries = (): PresenceEntry[] => [
    ...(mine ? [{ ...mine, key }] : []),
    ...[...others.entries()].map(([k, v]) => ({ ...v.state, key: k })),
  ]
  const emitPresence = () => {
    const list = entries()
    for (const cb of pres) cb(list)
  }
  const announce = () => mine && bc.postMessage({ kind: 'presence', key, state: mine } satisfies Wire)

  bc.onmessage = (m) => {
    const w = m.data as Wire
    if (w.kind === 'bc') for (const cb of bcast) cb(w.event, w.payload)
    else if (w.kind === 'hello') announce()
    else if (w.kind === 'presence') {
      if (w.state) {
        const prev = others.get(w.key)
        others.set(w.key, { state: w.state, seen: Date.now() })
        if (!prev || JSON.stringify(prev.state) !== JSON.stringify(w.state)) emitPresence()
      } else if (others.delete(w.key)) emitPresence()
    }
  }
  const beat = window.setInterval(() => {
    announce()
    let changed = false
    for (const [k, v] of others) if (Date.now() - v.seen > 6000) { others.delete(k); changed = true }
    if (changed) emitPresence()
  }, 2000)
  bc.postMessage({ kind: 'hello' } satisfies Wire)

  return {
    ready: Promise.resolve(),
    send(event, payload) {
      bc.postMessage({ kind: 'bc', event, payload } satisfies Wire)
    },
    onBroadcast(cb) {
      bcast.add(cb)
      return () => bcast.delete(cb)
    },
    async track(state) {
      mine = state
      announce()
      emitPresence()
    },
    async untrack() {
      mine = null
      bc.postMessage({ kind: 'presence', key, state: null } satisfies Wire)
      emitPresence()
    },
    onPresence(cb) {
      pres.add(cb)
      cb(entries())
      return () => pres.delete(cb)
    },
    leave() {
      if (mine) bc.postMessage({ kind: 'presence', key, state: null } satisfies Wire)
      window.clearInterval(beat)
      bc.close()
      bcast.clear()
      pres.clear()
    },
  }
}
