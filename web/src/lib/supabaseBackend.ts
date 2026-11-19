import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  AdminUser,
  Backend, Channel, ChannelType, DmChannel, Friendship, Message, PresenceEntry, Profile, ProfilePatch, Reaction, RealtimeRoom, Server,
  ServerEmoji, Ban, RoleDef, ServerPrefs, Attachment, OnceFile, Pin,
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

    async acceptTerms(version) {
      // banco ainda sem a função: o aceite fica guardado só neste aparelho (ver AccessGate)
      await sb.rpc('accept_terms', { v: version })
    },

    async adminSetApproval(userId, status) {
      const r = await sb.rpc('admin_set_approval', { target: userId, new_status: status })
      if (r.error) {
        if (/nao_pode_admin/.test(r.error.message)) throw new Error(t('A conta do administrador não pode ser alterada.'))
        if (/sem_permissao/.test(r.error.message)) throw new Error(t('Só o administrador pode fazer isso.'))
        throw new Error(r.error.message)
      }
    },

    async deleteAccount(userId) {
      const r = await sb.functions.invoke('excluir-conta', { body: userId ? { userId } : {} })
      if (r.error || (r.data as { error?: string } | null)?.error) {
        const msg = (r.data as { error?: string } | null)?.error ?? r.error?.message ?? ''
        throw new Error(/administrador/.test(msg) ? t('A conta do administrador não pode ser excluída.') : msg || t('Não deu para excluir a conta.'))
      }
      if (!userId || userId === (await sb.auth.getUser()).data.user?.id) await sb.auth.signOut().catch(() => undefined)
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
      if (r.error) throw new Error(/banido/.test(r.error.message) ? t('Você foi banido deste servidor.') : t('Convite inválido ou expirado.'))
      return r.data as Server
    },

    async leaveServer(serverId) {
      const me = await uid()
      must(await sb.from('server_members').delete().eq('server_id', serverId).eq('user_id', me!))
    },

    async updateServer(serverId, patch) {
      const r = await sb.from('servers').update(patch).eq('id', serverId).select().maybeSingle()
      if (r.error) throw new Error(r.error.message)
      if (!r.data) throw new Error(t('Você não tem permissão para mudar este servidor.'))
      return r.data as Server
    },

    async listRoles(serverId) {
      return must(await sb.from('server_roles').select('id, server_id, name, color, permissions, hoist').eq('server_id', serverId).order('created_at')) as RoleDef[]
    },

    async createRole(serverId, role) {
      const r = await sb.from('server_roles').insert({ server_id: serverId, ...role }).select('id, server_id, name, color, permissions, hoist').single()
      if (r.error) throw new Error(t('Só o dono do servidor pode mexer nos cargos.'))
      return r.data as RoleDef
    },

    async updateRole(roleId, patch) {
      const r = await sb.from('server_roles').update(patch).eq('id', roleId).select('id, server_id, name, color, permissions, hoist').maybeSingle()
      if (r.error || !r.data) throw new Error(t('Só o dono do servidor pode mexer nos cargos.'))
      return r.data as RoleDef
    },

    async deleteRole(roleId) {
      const r = await sb.from('server_roles').delete().eq('id', roleId).select('id')
      if (r.error || !r.data?.length) throw new Error(t('Só o dono do servidor pode mexer nos cargos.'))
    },

    async listMemberRoles(serverId) {
      const [mem, rel] = await Promise.all([
        sb.from('server_members').select('user_id').eq('server_id', serverId),
        sb.from('member_roles').select('user_id, role_id').eq('server_id', serverId),
      ])
      const out: Record<string, string[]> = {}
      for (const m of must(mem) as { user_id: string }[]) out[m.user_id] = []
      for (const r of must(rel) as { user_id: string; role_id: string }[]) (out[r.user_id] ??= []).push(r.role_id)
      return out
    },

    async setMemberRole(serverId, userId, roleId, on) {
      const r = await sb.rpc('toggle_member_role', { s: serverId, target: userId, rid: roleId, on_: on })
      if (r.error) throw new Error(t('Você não pode mexer nos cargos dessa pessoa.'))
    },

    async listServerPrefs() {
      const rows = must(await sb.from('server_prefs').select('server_id, level, muted_until')) as { server_id: string; level: ServerPrefs['level']; muted_until: string | null }[]
      return Object.fromEntries(rows.map((r) => [r.server_id, { level: r.level, muted_until: r.muted_until }]))
    },
    async setServerPrefs(serverId, p) {
      const me = await uid()
      must(await sb.from('server_prefs').upsert({ user_id: me, server_id: serverId, level: p.level, muted_until: p.muted_until }))
    },

    async getNotice() {
      const r = await sb.from('app_notice').select('body, updated_at').eq('id', 1).maybeSingle()
      if (r.error || !r.data || !r.data.body.trim()) return null
      return r.data as { body: string; updated_at: string }
    },
    async setNotice(body) {
      const text = body.trim().slice(0, 500)
      if (!text) {
        must(await sb.from('app_notice').delete().eq('id', 1))
        return
      }
      must(await sb.from('app_notice').upsert({ id: 1, body: text, updated_at: new Date().toISOString(), updated_by: await uid() }))
    },
    async listUserNotes() {
      const rows = must(await sb.from('user_notes').select('target_id, note, nickname')) as { target_id: string; note: string; nickname: string }[]
      return Object.fromEntries(rows.map((r) => [r.target_id, { note: r.note, nickname: r.nickname }]))
    },
    async setUserNote(targetId, n) {
      const me = await uid()
      if (!n.note.trim() && !n.nickname.trim()) {
        must(await sb.from('user_notes').delete().eq('owner_id', me).eq('target_id', targetId))
        return
      }
      must(await sb.from('user_notes').upsert({ owner_id: me, target_id: targetId, note: n.note.trim(), nickname: n.nickname.trim(), updated_at: new Date().toISOString() }))
    },

    async kickMember(serverId, userId) {
      const r = await sb.rpc('kick_member', { s: serverId, target: userId })
      if (r.error) throw new Error(t('Você não pode expulsar essa pessoa.'))
    },

    async banMember(serverId, userId, reason) {
      const r = await sb.rpc('ban_member', { s: serverId, target: userId, why: reason })
      if (r.error) throw new Error(t('Você não pode banir essa pessoa.'))
    },

    async unbanMember(serverId, userId) {
      const r = await sb.rpc('unban_member', { s: serverId, target: userId })
      if (r.error) throw new Error(t('Você não pode desbanir pessoas aqui.'))
    },

    async listBans(serverId) {
      return must(await sb.from('server_bans').select('server_id, user_id, username, display_name, reason, banned_at').eq('server_id', serverId).order('banned_at', { ascending: false })) as Ban[]
    },

    async deleteServer(serverId) {
      const r = await sb.rpc('delete_server', { s: serverId })
      if (r.error) throw new Error(t('Só o dono do servidor pode apagá-lo.'))
    },

    onServersChange(cb) {
      const ch = sb
        .channel('my-servers-' + crypto.randomUUID())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'server_members' }, () => cb())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'servers' }, () => cb())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'server_roles' }, () => cb())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'member_roles' }, () => cb())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'server_bans' }, () => cb())
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'servers' }, () => cb())
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

    async renameChannel(channelId, name) {
      const r = await sb.from('channels').update({ name }).eq('id', channelId).select('id')
      if (r.error) throw new Error(r.error.message)
      if (!r.data?.length) throw new Error(t('Você não tem permissão para mudar este canal.'))
    },

    async deleteChannel(channelId) {
      const r = await sb.from('channels').delete().eq('id', channelId).select('id')
      if (r.error) throw new Error(r.error.message)
      if (!r.data?.length) throw new Error(t('Você não tem permissão para apagar este canal.'))
    },

    async reorderChannels(_serverId, orderedIds) {
      const results = await Promise.all(
        orderedIds.map((id, position) => sb.from('channels').update({ position }).eq('id', id)),
      )
      const bad = results.find((r) => r.error)
      if (bad?.error) throw new Error(bad.error.message)
    },

    onChannelsChange(serverId, cb) {
      const ch = sb
        .channel(`channels-${serverId}-${crypto.randomUUID()}`)
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
        .channel(`messages-${channelId}-${crypto.randomUUID()}`)
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

    // ---------- encaminhar, fixar, leitura por pessoa e visualização única ----------
    async forwardMessage(messageId, targetChannelIds) {
      const me = await uid()
      const m = must(await sb.from('messages').select('content, attachments').eq('id', messageId).single()) as Pick<Message, 'content' | 'attachments'>
      const atts = (m.attachments ?? []).filter((a) => !a.once)
      for (const target of targetChannelIds) {
        // os arquivos ficam numa pasta por conversa: copia para a pasta do destino
        const copied: Attachment[] = []
        for (const a of atts) {
          const safe = a.path.split('/').pop() ?? 'arquivo'
          const path = `${target}/${me}/${crypto.randomUUID()}-${safe.replace(/^[0-9a-f-]{36}-/, '')}`
          const r = await sb.storage.from('anexos').copy(a.path, path, { destinationBucket: 'anexos' })
          if (r.error) throw new Error(t('Não deu para copiar os arquivos para a outra conversa.'))
          copied.push({ ...a, path })
        }
        must(await sb.from('messages').insert({ channel_id: target, author_id: me, content: m.content, reply_to: null, attachments: copied, forwarded: true }))
      }
    },

    async getMessages(ids) {
      if (!ids.length) return []
      return must(await sb.from('messages').select('*').in('id', ids)) as Message[]
    },

    async listPins(channelId) {
      return must(await sb.from('message_pins').select('message_id, channel_id, pinned_by, pinned_at').eq('channel_id', channelId).order('pinned_at', { ascending: false })) as Pin[]
    },

    async pinMessage(messageId, channelId) {
      const me = await uid()
      const r = await sb.from('message_pins').insert({ message_id: messageId, channel_id: channelId, pinned_by: me })
      if (r.error && r.error.code !== '23505') throw new Error(t('Você não pode fixar mensagens aqui.'))
    },

    async unpinMessage(messageId) {
      must(await sb.from('message_pins').delete().eq('message_id', messageId))
    },

    subscribePins(channelId, h) {
      const ch = sb
        .channel(`pins-${channelId}-${crypto.randomUUID()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_pins', filter: `channel_id=eq.${channelId}` }, (p) => h.onAdd(p.new as Pin))
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_pins' }, (p) => {
          const x = p.old as Pin
          if (x.channel_id === channelId) h.onRemove(x)
        })
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    async listReceiptOff() {
      const me = await uid()
      const rows = must(await sb.from('read_receipt_off').select('owner, peer')) as { owner: string; peer: string }[]
      return { mine: rows.filter((r) => r.owner === me).map((r) => r.peer), theirs: rows.filter((r) => r.peer === me).map((r) => r.owner) }
    },

    async setReceiptOff(peerId, off) {
      const me = await uid()
      if (off) {
        const r = await sb.from('read_receipt_off').insert({ owner: me, peer: peerId })
        if (r.error && r.error.code !== '23505') throw new Error(r.error.message)
      } else {
        must(await sb.from('read_receipt_off').delete().eq('owner', me).eq('peer', peerId))
      }
    },

    onReceiptOffChange(cb) {
      const ch = sb
        .channel('receipt-off-' + crypto.randomUUID())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'read_receipt_off' }, () => cb())
        .subscribe()
      return () => void sb.removeChannel(ch)
    },

    async openOnce(messageId) {
      const r = await sb.functions.invoke('unica-vez', { body: { action: 'open', messageId } })
      if (r.error) throw new Error(t('Não deu para abrir agora. Tente de novo.'))
      const d = r.data as { already?: boolean; files?: OnceFile[] }
      return d.already ? null : (d.files ?? [])
    },

    async finishOnce(messageId) {
      await sb.functions.invoke('unica-vez', { body: { action: 'done', messageId } })
    },

    async listOnceViews(messageIds) {
      if (!messageIds.length) return {}
      const rows = must(await sb.from('once_views').select('message_id, user_id').in('message_id', messageIds)) as { message_id: string; user_id: string }[]
      const out: Record<string, string[]> = {}
      for (const r of rows) (out[r.message_id] ??= []).push(r.user_id)
      return out
    },

    onOnceViewsChange(cb) {
      const ch = sb
        .channel('once-views-' + crypto.randomUUID())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'once_views' }, () => cb())
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
      // visualização única: pasta "once", que só a função de servidor consegue liberar
      const path = `${channelId}/${me}/${meta.once ? 'once/' : ''}${crypto.randomUUID()}-${safe}`
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
