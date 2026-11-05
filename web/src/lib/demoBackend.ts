/**
 * Modo demonstração: tudo fica salvo no próprio navegador (localStorage).
 * Serve para ver e testar o Descarga antes de configurar o Supabase.
 * Abra duas abas, entre com contas diferentes e converse entre elas.
 */
import type {
  AdminUser, Attachment, Backend, Channel, DmChannel, Friendship, Message, PresenceEntry, Profile, Reaction, RealtimeRoom, Server, ServerEmoji,
} from './types'
import { blobToDataUrl, compressImage } from './image'
import { local, session } from './storage'
import { t } from './i18n'

interface DemoUser { id: string; email: string; password: string }
interface Member { server_id: string; user_id: string; joined_at: string }
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
  | { type: 'friends' | 'dms' | 'emojis' | 'users' }
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
    id: WELCOME_ID, name: 'Bem-vindo ao Descarga', icon_url: import.meta.env.BASE_URL + 'icon-192.png',
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

  const createAccount = (db: DB, email: string, password: string, username: string) => {
    const clean = username.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 26) || 'usuario'
    let candidate = clean
    let n = 0
    while (db.profiles.some((p) => p.username === candidate)) candidate = clean + ++n
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
      if (patch.username && db.profiles.some((p) => p.username === patch.username && p.id !== uid))
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
        .filter((p) => p.id !== BOT_ID)
        .map((p): AdminUser => ({
          id: p.id, email: db.users.find((u) => u.id === p.id)?.email ?? '', username: p.username,
          display_name: p.display_name, avatar_url: p.avatar_url, approval: p.approval ?? 'approved',
          is_admin: !!p.is_admin, created_at: p.created_at, last_sign_in_at: p.created_at,
        }))
        .sort((a, b) => order[a.approval] - order[b.approval] || b.created_at.localeCompare(a.created_at))
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
      const s: Server = { id: id(), name, icon_url: iconUrl, owner_id: uid, invite_code: code(), created_at: now() }
      db.servers.push(s)
      db.members.push({ server_id: s.id, user_id: uid, joined_at: now() })
      const mk = (name: string, type: 'text' | 'voice', category: string, position: number): Channel => ({
        id: id(), server_id: s.id, name, type, category, topic: '', position, created_at: now(),
      })
      db.channels.push(
        mk('geral', 'text', 'Canais de texto', 0),
        mk('memes', 'text', 'Canais de texto', 1),
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
      const s = db.servers.find((x) => x.id === serverId)
      if (s?.owner_id !== uid) throw new Error(t('Só o dono do servidor pode criar canais (por enquanto).'))
      const c: Channel = {
        id: id(), server_id: serverId, name, type, category, topic: '',
        position: db.channels.filter((x) => x.server_id === serverId).length, created_at: now(),
      }
      db.channels.push(c)
      save(db)
      emit({ type: 'channels' })
      return c
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
      db.messages = db.messages.filter((x) => !(x.id === mid && x.author_id === uid))
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
      const other = db.profiles.find((p) => p.username === username.trim().toLowerCase().replace(/^@/, ''))
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
