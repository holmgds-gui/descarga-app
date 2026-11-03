/**
 * Modo demonstração: tudo fica salvo no próprio navegador (localStorage).
 * Serve para ver e testar o Descarga antes de configurar o Supabase.
 * Abra duas abas, entre com contas diferentes e converse entre elas.
 */
import type { Backend, Channel, Message, Profile, Server } from './types'
import { blobToDataUrl, compressImage } from './image'

interface DemoUser { id: string; email: string; password: string }
interface Member { server_id: string; user_id: string; joined_at: string }
interface DB {
  users: DemoUser[]
  profiles: Profile[]
  servers: Server[]
  members: Member[]
  channels: Channel[]
  messages: Message[]
}

const KEY = 'descarga-demo-db'
const SESSION = 'descarga-demo-session'
const BOT_ID = '00000000-0000-0000-0000-000000000b07'
const WELCOME_ID = '00000000-0000-0000-0000-0000000000a1'

type Event =
  | { type: 'msg-insert' | 'msg-update'; payload: Message }
  | { type: 'msg-delete'; payload: string }
  | { type: 'servers' | 'channels' | 'auth' }
  | { type: 'profile'; payload: Profile }

const now = () => new Date().toISOString()
const id = () => crypto.randomUUID()
const code = () => Math.random().toString(36).slice(2, 10)

function blankProfile(uid: string, username: string): Profile {
  return {
    id: uid, username, display_name: username, avatar_url: null, banner_url: null,
    accent_color: '#7B3FE4', bio: '', pronouns: '', birthday: null, city: '', links: [],
    status: 'online', custom_status: '', created_at: now(),
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
    id: id(), channel_id: channel.id, author_id: BOT_ID, content, reply_to: null, edited_at: null, created_at: at(minAgo),
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
      msg(novidades, 'Etapa 1 ✅ servidores, canais, chat e perfil\nEtapa 2 🔜 voz, vídeo, tela com som e notificações\nEtapa 3 🔜 cargos, fóruns, eventos, DMs e extras', 20),
    ],
  }
}

export function createDemoBackend(): Backend {
  const bus = new BroadcastChannel('descarga-demo')
  const local = new EventTarget()

  const load = (): DB => {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DB
    const db = seed()
    localStorage.setItem(KEY, JSON.stringify(db))
    return db
  }
  const save = (db: DB) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      throw new Error('O armazenamento do modo demonstração encheu. Use imagens menores.')
    }
  }
  const emit = (e: Event) => {
    bus.postMessage(e)
    local.dispatchEvent(new CustomEvent('e', { detail: e }))
  }
  const listen = (fn: (e: Event) => void) => {
    const a = (m: MessageEvent) => fn(m.data as Event)
    const b = (m: globalThis.Event) => fn((m as CustomEvent).detail as Event)
    bus.addEventListener('message', a)
    local.addEventListener('e', b)
    return () => {
      bus.removeEventListener('message', a)
      local.removeEventListener('e', b)
    }
  }

  const getSession = () => sessionStorage.getItem(SESSION) ?? localStorage.getItem(SESSION)
  const setSession = (uid: string | null) => {
    if (uid) {
      sessionStorage.setItem(SESSION, uid)
      localStorage.setItem(SESSION, uid)
    } else {
      sessionStorage.removeItem(SESSION)
      localStorage.removeItem(SESSION)
    }
    local.dispatchEvent(new CustomEvent('e', { detail: { type: 'auth' } }))
  }
  const me = () => {
    const uid = getSession()
    if (!uid) throw new Error('Você não está conectado.')
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
    db.profiles.push(blankProfile(uid, candidate))
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
      if (db.users.some((u) => u.email === email.toLowerCase())) throw new Error('Esse e-mail já tem conta. Tente entrar.')
      if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
      const uid = createAccount(db, email, password, username)
      save(db)
      setSession(uid)
      emit({ type: 'channels' })
      return { needsConfirmation: false }
    },

    async signIn(email, password) {
      const u = load().users.find((x) => x.email === email.toLowerCase() && x.password === password)
      if (!u) throw new Error('E-mail ou senha incorretos.')
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
        throw new Error('Esse nome de usuário já está em uso.')
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
      if (!s) throw new Error('Convite inválido ou expirado.')
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
      if (s?.owner_id !== uid) throw new Error('Só o dono do servidor pode criar canais (por enquanto).')
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
      return load()
        .members.filter((m) => m.server_id === serverId)
        .map((m) => m.user_id)
    },

    async listMessages(channelId, before) {
      const all = load()
        .messages.filter((m) => m.channel_id === channelId && (!before || m.created_at < before))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
      return all.slice(-50)
    },

    async sendMessage(channelId, content, replyTo) {
      const db = load()
      const m: Message = {
        id: id(), channel_id: channelId, author_id: me(), content, reply_to: replyTo, edited_at: null, created_at: now(),
      }
      db.messages.push(m)
      save(db)
      emit({ type: 'msg-insert', payload: m })
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
  }
}
