import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend, Channel, ChannelType, Message, Profile, ProfilePatch, Server } from './types'
import { compressImage } from './image'

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
        email,
        password,
        options: { data: { username, display_name: username }, emailRedirectTo: location.origin },
      })
      if (r.error) throw new Error(traduzErro(r.error.message))
      return { needsConfirmation: !r.data.session }
    },

    async signIn(email, password) {
      const r = await sb.auth.signInWithPassword({ email, password })
      if (r.error) throw new Error(traduzErro(r.error.message))
    },

    async signInWithGoogle() {
      const r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })
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
      if (r.error?.code === '23505') throw new Error('Esse nome de usuário já está em uso.')
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
        .channel('profiles-all')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) =>
          cb(p.new as Profile),
        )
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
      if (r.error) throw new Error('Convite inválido ou expirado.')
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

    async sendMessage(channelId, content, replyTo) {
      const me = await uid()
      return must(
        await sb
          .from('messages')
          .insert({ channel_id: channelId, author_id: me, content, reply_to: replyTo })
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
  }
}

function traduzErro(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.'
  if (m.includes('already registered')) return 'Esse e-mail já tem conta. Tente entrar.'
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).'
  if (m.includes('provider is not enabled')) return 'O login com Google ainda não foi ativado no Supabase.'
  return msg
}
