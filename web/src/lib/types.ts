export type Status = 'online' | 'idle' | 'dnd' | 'invisible'

export interface ProfileLink {
  label: string
  url: string
}

export type Approval = 'pending' | 'approved' | 'blocked'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  banner_url: string | null
  accent_color: string
  bio: string
  pronouns: string
  birthday: string | null
  city: string
  links: ProfileLink[]
  status: Status
  custom_status: string
  read_receipts: boolean
  /** só contas aprovadas pelo administrador usam o app (versões antigas do banco não têm este campo) */
  approval?: Approval
  is_admin?: boolean
  created_at: string
}

export type ProfilePatch = Partial<Omit<Profile, 'id' | 'created_at' | 'approval' | 'is_admin'>>

/** linha da lista de contas do painel do administrador */
export interface AdminUser {
  id: string
  email: string
  username: string
  display_name: string
  avatar_url: string | null
  approval: Approval
  is_admin: boolean
  created_at: string
  last_sign_in_at: string | null
}

export interface Server {
  id: string
  name: string
  icon_url: string | null
  owner_id: string
  invite_code: string
  created_at: string
}

export type ChannelType = 'text' | 'voice'

export interface Channel {
  id: string
  /** null nas conversas diretas (DM) */
  server_id: string | null
  name: string
  type: ChannelType | 'dm'
  category: string
  topic: string
  position: number
  created_at: string
}

/** Conversa direta (1:1) ou grupo. */
export interface DmChannel extends Channel {
  type: 'dm'
  is_group: boolean
  title: string | null
  owner_id: string | null
  last_message_at: string | null
  member_ids: string[]
  /** até quando cada pessoa leu (só de quem deixou a confirmação de leitura ligada) */
  reads: Record<string, string | null>
}

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file'

export interface Attachment {
  path: string
  name: string
  size: number
  type: string
  kind: AttachmentKind
  width?: number
  height?: number
  /** segundos (áudio e vídeo) */
  duration?: number
  /** mensagem de voz gravada no app: formato da onda (0 a 1) */
  waveform?: number[]
  voice?: boolean
}

export interface Message {
  id: string
  channel_id: string
  author_id: string
  content: string
  reply_to: string | null
  edited_at: string | null
  created_at: string
  attachments: Attachment[]
}

export interface Friendship {
  id: string
  requester: string
  addressee: string
  status: 'pending' | 'accepted'
  created_at: string
}

export interface Reaction {
  message_id: string
  user_id: string
  emoji: string
  channel_id: string
}

export interface ServerEmoji {
  id: string
  server_id: string
  name: string
  url: string
}

export interface MessageHandlers {
  onInsert: (m: Message) => void
  onUpdate: (m: Message) => void
  onDelete: (id: string) => void
}

export interface Backend {
  mode: 'demo' | 'supabase'
  currentUserId(): Promise<string | null>
  onAuthChange(cb: (userId: string | null) => void): () => void
  signUp(email: string, password: string, username: string): Promise<{ needsConfirmation: boolean }>
  signIn(email: string, password: string): Promise<void>
  signInWithGoogle(): Promise<void>
  signOut(): Promise<void>

  getProfiles(ids: string[]): Promise<Profile[]>
  updateProfile(patch: ProfilePatch): Promise<Profile>
  uploadImage(file: File, kind: 'avatar' | 'banner' | 'server'): Promise<string>
  onProfileChange(cb: (p: Profile) => void): () => void

  listServers(): Promise<Server[]>
  createServer(name: string, iconUrl: string | null): Promise<Server>
  joinServer(code: string): Promise<Server>
  leaveServer(serverId: string): Promise<void>
  onServersChange(cb: () => void): () => void

  listChannels(serverId: string): Promise<Channel[]>
  createChannel(serverId: string, name: string, type: ChannelType, category: string): Promise<Channel>
  onChannelsChange(serverId: string, cb: () => void): () => void
  listMemberIds(serverId: string): Promise<string[]>

  listMessages(channelId: string, before?: string): Promise<Message[]>
  sendMessage(channelId: string, content: string, replyTo: string | null, attachments?: Attachment[]): Promise<Message>
  editMessage(id: string, content: string): Promise<void>
  deleteMessage(id: string): Promise<void>
  subscribeMessages(channelId: string, h: MessageHandlers): () => void

  // ---------- amigos ----------
  listFriendships(): Promise<Friendship[]>
  sendFriendRequest(username: string): Promise<void>
  acceptFriend(id: string): Promise<void>
  removeFriendship(id: string): Promise<void>
  onFriendshipsChange(cb: () => void): () => void

  // ---------- mensagens diretas ----------
  listDms(): Promise<DmChannel[]>
  /** abre (ou cria) a conversa e devolve o id */
  openDm(userIds: string[], groupTitle?: string | null): Promise<string>
  addToGroup(channelId: string, userIds: string[]): Promise<void>
  renameGroup(channelId: string, title: string): Promise<void>
  leaveDm(channelId: string): Promise<void>
  markRead(channelId: string): Promise<void>
  onDmsChange(cb: () => void): () => void

  // ---------- reações e emojis ----------
  listReactions(channelId: string, messageIds: string[]): Promise<Reaction[]>
  addReaction(messageId: string, channelId: string, emoji: string): Promise<void>
  removeReaction(messageId: string, emoji: string): Promise<void>
  subscribeReactions(channelId: string, h: { onAdd: (r: Reaction) => void; onRemove: (r: Reaction) => void }): () => void
  listServerEmojis(serverIds: string[]): Promise<ServerEmoji[]>
  addServerEmoji(serverId: string, name: string, file: File): Promise<ServerEmoji>
  deleteServerEmoji(id: string): Promise<void>
  onEmojisChange(cb: () => void): () => void

  // ---------- arquivos ----------
  uploadAttachment(channelId: string, file: Blob, meta: Omit<Attachment, 'path' | 'size' | 'type'> & { type?: string }): Promise<Attachment>
  /** links temporários para abrir os arquivos (privados) */
  attachmentUrls(paths: string[]): Promise<Record<string, string>>
  maxUploadBytes: number

  // ---------- administração (só a conta do administrador) ----------
  adminListUsers(): Promise<AdminUser[]>
  adminSetApproval(userId: string, status: 'approved' | 'blocked'): Promise<void>
  onAdminUsersChange(cb: () => void): () => void

  /** Quais jeitos de entrar estão ligados no servidor (ex.: Google). */
  authOptions(): Promise<{ google: boolean }>
  resetPassword(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  onPasswordRecovery(cb: () => void): () => void
  /** Servidores de apoio para as calls (STUN e, se configurado, TURN). */
  getIceServers(): Promise<RTCIceServer[]>

  /** Sala de tempo real (presença + mensagens rápidas) usada pelas calls. */
  openRoom(topic: string): RealtimeRoom
  /** Notificações com o app fechado (só na versão online). */
  pushSupported: boolean
  savePushSubscription(sub: PushSubscriptionJSON): Promise<void>
  removePushSubscription(endpoint: string): Promise<void>
  notify(body: { type: 'message'; messageId: string } | { type: 'call'; channelId: string } | { type: 'signup' }): Promise<void>
}

export type PresenceEntry = Record<string, unknown> & { key: string }

export interface RealtimeRoom {
  ready: Promise<void>
  send(event: string, payload: Record<string, unknown>): void
  onBroadcast(cb: (event: string, payload: Record<string, unknown>) => void): () => void
  track(state: Record<string, unknown>): Promise<void>
  untrack(): Promise<void>
  onPresence(cb: (entries: PresenceEntry[]) => void): () => void
  leave(): void
}
