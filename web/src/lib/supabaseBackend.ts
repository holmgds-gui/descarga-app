import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  AdminUser,
  Backend, Channel, ChannelType, DmChannel, Friendship, Message, PresenceEntry, Profile, ProfilePatch, Reaction, RealtimeRoom, Server,
  ServerEmoji,
} from './types'
import { compressImage } from './image'
import { getLang, t } from './i18n'

const PAGE = 50

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })

  const uid = async () => (await sb.auth.getSession()).data.session?.user.id ?? null
  const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message)
    return r.data as T
  }

  return {
    mode: 'supabase',

    currentUserId: uid,

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user.id ?? null))
      return () => data.subscription.unsubscribe()
    },

    async signUp(email, password, username) {
      const r = await sb.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { username, display_name: username }, emailRedirectTo: appUrl() },
      })
      if (r.error) throw new Error(traduzErro(r.error.message))
      // o Supabase não avisa quando o e-mail já existe: devolve um usuário "vazio" sem identidades
      if (r.data.user && (r.data.user.identities?.length ?? 0) === 0) {
        throw new Error(t('Esse e-mail já tem conta. Use "Entrar" ou "Esqueci minha senha".'))
      }
      return { needsConfirmation: !r.data.session }
    },

    async signIn(email, password) {
      const r = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (r.error) throw new Error(traduzErro(r.error.message))
    },

    async authOptions() {
      try {
        const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } })
        const s = await res.json()
        return { google: !!s?.external?.google }
      } catch {
        return { google: false }
      }
    },

    async resetPassword(email) {
      const r = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: appUrl() })
      if (r.error) throw new Error(traduzErro(r.error.message))
    },

    async updatePassword(password) {
      const r = await sb.auth.updateUser({ password })
      if (r.error) throw new Error(traduzErro(r.error.message))
    },

    onPasswordRecovery(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') cb()
      })
      return () => data.subscription.unsubscribe()
    },

    async getIceServers() {
      const r = await sb.functions.invoke('turn', { body: {} })
      const list = (r.data?.iceServers ?? []) as RTCIceServer[]
      return list.length ? [...DEFAULT_ICE, ...list] : DEFAULT_ICE
    },

    async signInWithGoogle() {
      const r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } })
      if (r.error) throw new Error(traduzErro(r.error.message))
    },

    async signOut() {
      await sb.auth.signOut()
    },

    async getProfiles(ids) {
      if (!ids.length) return []
      return must(await sb.from('profiles').select('*').in('id', ids)) as Profile[]
    },

    async updateProfile(patch: ProfilePatch) {
      const me = await uid()
      const r = await sb.from('profiles').update(patch).eq('id', me!).select().single()
      if (r.error?.code === '23505') throw new Error(t('Esse nome de usuário já está em uso.'))
      return must(r) as Profile
    },

    async uploadImage(file, kind) {
      const me = await uid()
      const blob = await compressImage(file, kind)
      const ext = blob.type === 'image/gif' ? 'gif' : 'webp'
      const path = `${me}/${kind}-${Date.now()}.${ext}`
      must(await sb.storage.from('media').upload(path, blob, { contentType: blob.type, upsert: false }))
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl
    },

    onProfileChange(cb) {
      const ch = sb
        .channel('profiles-' + crypto.randomUUID())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) =>
          cb(p.new as Profile),
        )
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    // ---------- administração ----------
    async adminListUsers() {
      return must(await sb.rpc('admin_list_users')) as AdminUser[]
    },

    async adminSetApproval(userId, status) {
      const r = await sb.rpc('admin_set_approval', { target: userId, new_status: status })
      if (r.error) {
        if (/nao_pode_admin/.test(r.error.message)) throw new Error(t('A conta do administrador não pode ser alterada.'))
        if (/sem_permissao/.test(r.error.message)) throw new Error(t('Só o administrador pode fazer isso.'))
        throw new Error(r.error.message)
      }
    },

    onAdminUsersChange(cb) {
      const ch = sb
        .channel('admin-users-' + crypto.randomUUID())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => cb())
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    async listServers() {
      const me = await uid()
      const rows = must(
        await sb.from('server_members').select('servers(*)').eq('user_id', me!).order('joined_at'),
      ) as unknown as { servers: Server }[]
      return rows.map((r) => r.servers).filter(Boolean)
    },

    async createServer(name, iconUrl) {
      const me = await uid()
      return must(
        await sb.from('servers').insert({ name, icon_url: iconUrl, owner_id: me }).select().single(),
      ) as Server
    },

    async joinServer(code) {
      const r = await sb.rpc('join_server', { code: code.trim() })
      if (r.error) throw new Error(t('Convite inválido ou expirado.'))
      return r.data as Server
    },

    async leaveServer(serverId) {
      const me = await uid()
      must(await sb.from('server_members').delete().eq('server_id', serverId).eq('user_id', me!))
    },

    onServersChange(cb) {
      const ch = sb
        .channel('my-servers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'server_members' }, () => cb())
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    async listChannels(serverId) {
      return must(
        await sb.from('channels').select('*').eq('server_id', serverId).order('position').order('created_at'),
      ) as Channel[]
    },

    async createChannel(serverId, name, type: ChannelType, category) {
      const list = await this.listChannels(serverId)
      return must(
        await sb
          .from('channels')
          .insert({ server_id: serverId, name, type, category, position: list.length })
          .select()
          .single(),
      ) as Channel
    },

    onChannelsChange(serverId, cb) {
      const ch = sb
        .channel(`channels-${serverId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'channels', filter: `server_id=eq.${serverId}` },
          () => cb(),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'server_members', filter: `server_id=eq.${serverId}` },
          () => cb(),
        )
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    async listMemberIds(serverId) {
      const rows = must(
        await sb.from('server_members').select('user_id').eq('server_id', serverId),
      ) as { user_id: string }[]
      return rows.map((r) => r.user_id)
    },

    async listMessages(channelId, before) {
      let q = sb
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(PAGE)
      if (before) q = q.lt('created_at', before)
      const rows = must(await q) as Message[]
      return rows.reverse()
    },

    async sendMessage(channelId, content, replyTo, attachments = []) {
      const me = await uid()
      return must(
        await sb
          .from('messages')
          .insert({ channel_id: channelId, author_id: me, content, reply_to: replyTo, attachments })
          .select()
          .single(),
      ) as Message
    },

    async editMessage(id, content) {
      must(await sb.from('messages').update({ content, edited_at: new Date().toISOString() }).eq('id', id))
    },

    async deleteMessage(id) {
      must(await sb.from('messages').delete().eq('id', id))
    },

    subscribeMessages(channelId, h) {
      const ch = sb
        .channel(`messages-${channelId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
          (p) => h.onInsert(p.new as Message),
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
          (p) => h.onUpdate(p.new as Message),
        )
        .on(
          'postgres_changes',
          // o Supabase não filtra DELETE por coluna; quem recebe ignora ids que não conhece
          { event: 'DELETE', schema: 'public', table: 'messages' },
          (p) => h.onDelete((p.old as Message).id),
        )
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    // ---------- amigos ----------
    async listFriendships() {
      return must(await sb.from('friendships').select('*').order('created_at', { ascending: false })) as Friendship[]
    },

    async sendFriendRequest(username) {
      const r = await sb.rpc('send_friend_request', { uname: username.replace(/^@/, '') })
      if (r.error) throw new Error(friendError(r.error.message))
    },

    async acceptFriend(id) {
      must(await sb.from('friendships').update({ status: 'accepted' }).eq('id', id))
    },

    async removeFriendship(id) {
      must(await sb.from('friendships').delete().eq('id', id))
    },

    onFriendshipsChange(cb) {
      const ch = sb
        .channel('friendships-' + crypto.randomUUID())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => cb())
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    // ---------- mensagens diretas ----------
    async listDms() {
      const me = await uid()
      const mine = must(
        await sb.from('channel_members').select('channel_id, channels(*)').eq('user_id', me!),
      ) as unknown as { channel_id: string; channels: Channel & Partial<DmChannel> }[]
      const ids = mine.map((m) => m.channel_id)
      if (!ids.length) return []
      const members = must(
        await sb.from('channel_members').select('channel_id, user_id, last_read_at, joined_at').in('channel_id', ids),
      ) as { channel_id: string; user_id: string; last_read_at: string | null; joined_at: string }[]
      return mine
        .filter((m) => m.channels)
        .map((m) => {
          const list = members.filter((x) => x.channel_id === m.channel_id).sort((a, b) => a.joined_at.localeCompare(b.joined_at))
          return {
            ...(m.channels as DmChannel),
            member_ids: list.map((x) => x.user_id),
            reads: Object.fromEntries(list.map((x) => [x.user_id, x.last_read_at])),
          }
        })
        .sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at))
    },

    async openDm(userIds, groupTitle = null) {
      const r = await sb.rpc('open_dm', { user_ids: userIds, group_title: groupTitle })
      if (r.error) throw new Error(friendError(r.error.message))
      return (r.data as Channel).id
    },

    async addToGroup(channelId, userIds) {
      const r = await sb.rpc('add_to_group', { c: channelId, user_ids: userIds })
      if (r.error) throw new Error(friendError(r.error.message))
    },

    async renameGroup(channelId, title) {
      must(await sb.from('channels').update({ title: title.trim() || null }).eq('id', channelId))
    },

    async leaveDm(channelId) {
      const me = await uid()
      must(await sb.from('channel_members').delete().eq('channel_id', channelId).eq('user_id', me!))
    },

    async markRead(channelId) {
      await sb.rpc('mark_read', { c: channelId })
    },

    onDmsChange(cb) {
      const ch = sb
        .channel('dms-' + crypto.randomUUID())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_members' }, () => cb())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'channels', filter: 'type=eq.dm' }, () => cb())
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    // ---------- reações e emojis ----------
    async listReactions(channelId, messageIds) {
      if (!messageIds.length) return []
      return must(
        await sb.from('message_reactions').select('message_id, user_id, emoji, channel_id').eq('channel_id', channelId).in('message_id', messageIds),
      ) as Reaction[]
    },

    async addReaction(messageId, channelId, emoji) {
      const me = await uid()
      const r = await sb.from('message_reactions').insert({ message_id: messageId, channel_id: channelId, emoji, user_id: me })
      if (r.error && r.error.code !== '23505') throw new Error(r.error.message)
    },

    async removeReaction(messageId, emoji) {
      const me = await uid()
      must(await sb.from('message_reactions').delete().eq('message_id', messageId).eq('emoji', emoji).eq('user_id', me!))
    },

    subscribeReactions(channelId, h) {
      const ch = sb
        .channel(`reactions-${channelId}-${crypto.randomUUID()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions', filter: `channel_id=eq.${channelId}` },
          (p) => h.onAdd(p.new as Reaction))
        // o Supabase não filtra DELETE por coluna; quem recebe confere o canal
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (p) => {
          const r = p.old as Reaction
          if (r.channel_id === channelId) h.onRemove(r)
        })
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    async listServerEmojis(serverIds) {
      if (!serverIds.length) return []
      return must(await sb.from('server_emojis').select('id, server_id, name, url').in('server_id', serverIds).order('name')) as ServerEmoji[]
    },

    async addServerEmoji(serverId, name, file) {
      const me = await uid()
      const blob = await compressImage(file, 'emoji')
      const ext = blob.type === 'image/gif' ? 'gif' : 'webp'
      const path = `${me}/emoji-${Date.now()}.${ext}`
      must(await sb.storage.from('media').upload(path, blob, { contentType: blob.type, upsert: false }))
      const url = sb.storage.from('media').getPublicUrl(path).data.publicUrl
      const r = await sb.from('server_emojis').insert({ server_id: serverId, name, url, created_by: me }).select('id, server_id, name, url').single()
      if (r.error?.code === '23505') throw new Error(t('Já existe um emoji com esse nome neste servidor.'))
      return must(r) as ServerEmoji
    },

    async deleteServerEmoji(id) {
      must(await sb.from('server_emojis').delete().eq('id', id))
    },

    onEmojisChange(cb) {
      const ch = sb
        .channel('emojis-' + crypto.randomUUID())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'server_emojis' }, () => cb())
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    // ---------- arquivos ----------
    maxUploadBytes: 50 * 1024 * 1024,

    async uploadAttachment(channelId, file, meta) {
      const me = await uid()
      if (file.size > 50 * 1024 * 1024) throw new Error(t('O arquivo passa de 50 MB.'))
      const safe = (meta.name || 'arquivo').normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80)
      const path = `${channelId}/${me}/${crypto.randomUUID()}-${safe}`
      const type = meta.type || file.type || 'application/octet-stream'
      const r = await sb.storage.from('anexos').upload(path, file, { contentType: type, upsert: false })
      if (r.error) throw new Error(/exceeded|too large|payload/i.test(r.error.message) ? t('O arquivo passa de 50 MB.') : r.error.message)
      return { ...meta, path, size: file.size, type }
    },

    async attachmentUrls(paths) {
      if (!paths.length) return {}
      const r = await sb.storage.from('anexos').createSignedUrls(paths, 60 * 60 * 6)
      const out: Record<string, string> = {}
      for (const x of r.data ?? []) if (x.signedUrl && x.path) out[x.path] = x.signedUrl
      return out
    },

    openRoom(topic) {
      return createSupabaseRoom(sb, topic)
    },

    pushSupported: true,

    async savePushSubscription(sub) {
      const me = await uid()
      if (!me || !sub.endpoint || !sub.keys) return
      must(
        await sb.from('push_subscriptions').upsert(
          { user_id: me, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: navigator.userAgent.slice(0, 200), lang: getLang() },
          { onConflict: 'endpoint' },
        ),
      )
    },

    async removePushSubscription(endpoint) {
      await sb.from('push_subscriptions').delete().eq('endpoint', endpoint)
    },

    async notify(body) {
      // aviso extra: se falhar, o app continua normalmente
      await sb.functions.invoke('notificar', { body: { ...body, appUrl: appUrl() } }).catch(() => undefined)
    },
  }
}

function createSupabaseRoom(sb: SupabaseClient, topic: string): RealtimeRoom {
  const key = crypto.randomUUID()
  const bcast = new Set<(e: string, p: Record<string, unknown>) => void>()
  const pres = new Set<(entries: PresenceEntry[]) => void>()
  let last: PresenceEntry[] = []
  let subscribed = false
  const queue: [string, Record<string, unknown>][] = []

  const ch = sb.channel(topic, {
    config: { private: true, broadcast: { self: false }, presence: { key } },
  })
  ch.on('broadcast', { event: '*' }, (msg) => {
    for (const cb of bcast) cb(msg.event, (msg.payload ?? {}) as Record<string, unknown>)
  })
  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState() as Record<string, Record<string, unknown>[]>
    last = Object.entries(state).flatMap(([k, list]) => list.map((v) => ({ ...v, key: k }) as PresenceEntry))
    for (const cb of pres) cb(last)
  })

  const ready = (async () => {
    await sb.realtime.setAuth()
    await new Promise<void>((resolve, reject) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribed = true
          for (const [e, p] of queue.splice(0)) void ch.send({ type: 'broadcast', event: e, payload: p })
          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(t('Não foi possível conectar à call. Verifique sua internet.')))
        }
      })
    })
  })()
  ready.catch(() => undefined)

  return {
    ready,
    send(event, payload) {
      if (!subscribed) queue.push([event, payload])
      else void ch.send({ type: 'broadcast', event, payload })
    },
    onBroadcast(cb) {
      bcast.add(cb)
      return () => bcast.delete(cb)
    },
    async track(state) {
      await ready
      await ch.track(state)
    },
    async untrack() {
      if (subscribed) await ch.untrack()
    },
    onPresence(cb) {
      pres.add(cb)
      if (last.length) cb(last)
      return () => pres.delete(cb)
    },
    leave() {
      bcast.clear()
      pres.clear()
      void sb.removeChannel(ch)
    },
  }
}

function friendError(msg: string) {
  if (msg.includes('nao_encontrado')) return t('Não achamos ninguém com esse nome de usuário.')
  if (msg.includes('voce_mesmo')) return t('Você não pode adicionar a si mesmo.')
  if (msg.includes('ja_amigos')) return t('Vocês já são amigos.')
  if (msg.includes('ja_enviado')) return t('Você já mandou um pedido para essa pessoa.')
  if (msg.includes('grupo_grande')) return t('Um grupo pode ter no máximo 10 pessoas.')
  if (msg.includes('sem_permissao')) return t('Você só pode conversar com amigos ou pessoas dos seus servidores.')
  if (msg.includes('sem_pessoas')) return t('Escolha pelo menos uma pessoa.')
  return traduzErro(msg)
}

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
]

function traduzErro(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return t('E-mail ou senha incorretos. Se esqueceu a senha, use "Esqueci minha senha".')
  if (m.includes('already registered')) return t('Esse e-mail já tem conta. Use "Entrar".')
  if (m.includes('password should be') || m.includes('weak')) return t('A senha precisa ter pelo menos 6 caracteres.')
  if (m.includes('same password') || m.includes('should be different')) return t('A nova senha precisa ser diferente da antiga.')
  if (m.includes('email not confirmed')) return t('Esse e-mail ainda não foi confirmado. Peça para o dono do Descarga liberar sua conta.')
  if (m.includes('provider is not enabled')) return t('O login com Google ainda não está disponível. Use e-mail e senha.')
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes'))
    return t('Muitas tentativas seguidas. Espere alguns minutos e tente de novo.')
  if (m.includes('invalid') && m.includes('email')) return t('Esse e-mail não parece válido. Confira se digitou certo.')
  if (m.includes('signups not allowed')) return t('Os cadastros estão fechados no momento.')
  if (m.includes('failed to fetch') || m.includes('network')) return t('Sem conexão com o servidor. Verifique sua internet.')
  return msg
}

/** Endereço do app, incluindo a pasta (ex.: holmgds-gui.github.io/descarga-app/). */
function appUrl() {
  return location.origin + location.pathname
}
