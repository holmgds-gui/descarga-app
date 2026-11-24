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
  /** perfil privado: quem não é amigo vê só nome, foto, cor e status (o banco já entrega sem bio, banner, etc.) */
  profile_private?: boolean
  /** só contas aprovadas pelo administrador usam o app (versões antigas do banco não têm este campo) */
  approval?: Approval
  terms_version?: string | null
  is_admin?: boolean
  /** conta excluída: o perfil vira uma casca "Usuário excluído" que só assina as mensagens antigas */
  deleted_at?: string | null
  created_at: string
}

export type ProfilePatch = Partial<Omit<Profile, 'id' | 'created_at' | 'approval' | 'is_admin'>>

/** linha da lista de contas do painel do administrador */
export type ReportReason = 'harassment' | 'hate' | 'illegal' | 'copyright' | 'spam' | 'other'
export interface Report {
  id: string
  reporter_id: string
  reported_id: string
  reason: ReportReason
  details: string
  status: 'open' | 'resolved'
  created_at: string
}

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
  banner_url: string | null
  description: string
  owner_id: string
  invite_code: string
  created_at: string
}

/** o que um cargo permite fazer no servidor (o dono, quem tem owner_id, pode tudo) */
export type Permission = 'manage_server' | 'manage_channels' | 'manage_roles' | 'manage_messages' | 'manage_emojis' | 'pin_messages' | 'kick' | 'ban'
export const PERMISSIONS: Permission[] = ['manage_server', 'manage_channels', 'manage_roles', 'manage_messages', 'manage_emojis', 'pin_messages', 'kick', 'ban']

/** silenciar e nível de aviso de um servidor (por pessoa) */
export interface ServerPrefs {
  level: 'all' | 'mentions' | 'none'
  muted_until: string | null
  /** posição do servidor na barra lateral (só eu; vazio = ordem original) */
  position?: number | null
}

/** nota e apelido que a pessoa deu a alguém (só ela enxerga) */
export interface UserNote {
  note: string
  nickname: string
}
export interface RoleDef {
  id: string
  server_id: string
  name: string
  color: string
  permissions: Permission[]
  /** mostra os membros deste cargo como seção própria na lista de membros (padrão: sim) */
  hoist?: boolean
}
export interface RolePatch {
  name?: string
  color?: string
  permissions?: Permission[]
  hoist?: boolean
}
export interface Ban {
  server_id: string
  user_id: string
  username: string
  display_name: string
  reason: string
  banned_at: string
}
export interface ServerPatch {
  name?: string
  icon_url?: string | null
  banner_url?: string | null
  description?: string
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
  /** foto ou vídeo de visualização única (só em DMs): cada pessoa abre uma vez */
  once?: boolean
  /** visualização única já consumida: o arquivo foi apagado */
  gone?: boolean
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
  forwarded?: boolean
}

export interface Pin {
  message_id: string
  channel_id: string
  pinned_by: string | null
  pinned_at: string
}

/** quem desligou a confirmação de leitura: `mine` = pessoas para quem eu desliguei, `theirs` = pessoas que desligaram para mim */
export interface ReceiptOff {
  mine: string[]
  theirs: string[]
}

/** arquivo liberado por um link temporário na visualização única */
export interface OnceFile {
  path: string
  url: string
  name: string
  type: string
  kind: AttachmentKind
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
  updateServer(serverId: string, patch: ServerPatch): Promise<Server>
  listRoles(serverId: string): Promise<RoleDef[]>
  /** dono ou quem tem "gerenciar cargos" (só com permissões que a própria pessoa tem) */
  createRole(serverId: string, role: Required<RolePatch>): Promise<RoleDef>
  updateRole(roleId: string, patch: RolePatch): Promise<RoleDef>
  deleteRole(roleId: string): Promise<void>
  /** cargos de cada membro (lista de ids; vazia se não tem nenhum) */
  listMemberRoles(serverId: string): Promise<Record<string, string[]>>
  /** dá (on) ou tira (off) um cargo; cada pessoa pode ter quantos cargos quiser */
  setMemberRole(serverId: string, userId: string, roleId: string, on: boolean): Promise<void>
  listServerPrefs(): Promise<Record<string, ServerPrefs>>
  setServerPrefs(serverId: string, p: ServerPrefs): Promise<void>
  /** salva a ordem dos servidores na barra lateral (só para mim) */
  setServerOrder(orderedIds: string[]): Promise<void>
  /** recado fixado do administrador (null quando não há) */
  getNotice(): Promise<{ body: string; updated_at: string } | null>
  /** só o administrador; texto vazio apaga o recado */
  setNotice(body: string): Promise<void>
  listUserNotes(): Promise<Record<string, UserNote>>
  setUserNote(targetId: string, n: UserNote): Promise<void>
  kickMember(serverId: string, userId: string): Promise<void>
  banMember(serverId: string, userId: string, reason: string): Promise<void>
  unbanMember(serverId: string, userId: string): Promise<void>
  listBans(serverId: string): Promise<Ban[]>
  /** só o dono: apaga o servidor com canais e mensagens */
  deleteServer(serverId: string): Promise<void>
  onServersChange(cb: () => void): () => void

  listChannels(serverId: string): Promise<Channel[]>
  createChannel(serverId: string, name: string, type: ChannelType, category: string): Promise<Channel>
  renameChannel(channelId: string, name: string): Promise<void>
  deleteChannel(channelId: string): Promise<void>
  /** salva a ordem: o primeiro id fica na posição 0, e assim por diante */
  reorderChannels(serverId: string, orderedIds: string[]): Promise<void>
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

  // ---------- encaminhar, fixar, leitura por pessoa e visualização única ----------
  /** manda uma cópia da mensagem (com os arquivos) para várias conversas e canais */
  forwardMessage(messageId: string, targetChannelIds: string[]): Promise<void>
  /** busca mensagens pelo id (para mostrar as fixadas, mesmo as antigas) */
  getMessages(ids: string[]): Promise<Message[]>
  listPins(channelId: string): Promise<Pin[]>
  pinMessage(messageId: string, channelId: string): Promise<void>
  unpinMessage(messageId: string): Promise<void>
  subscribePins(channelId: string, h: { onAdd: (p: Pin) => void; onRemove: (p: Pin) => void }): () => void
  listReceiptOff(): Promise<ReceiptOff>
  /** desliga (ou liga) a confirmação de leitura entre mim e essa pessoa, nos dois sentidos */
  setReceiptOff(peerId: string, off: boolean): Promise<void>
  onReceiptOffChange(cb: () => void): () => void
  /** abre uma mensagem de visualização única: devolve os arquivos uma única vez (null se já foi aberta) */
  openOnce(messageId: string): Promise<OnceFile[] | null>
  /** avisa que terminou de ver (quando todos abriram, o arquivo é apagado) */
  finishOnce(messageId: string): Promise<void>
  /** quem já abriu cada mensagem: eu mesmo, ou todos se a mensagem é minha */
  listOnceViews(messageIds: string[]): Promise<Record<string, string[]>>
  onOnceViewsChange(cb: () => void): () => void

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
  /** exclui a conta (sem argumento: a própria). O e-mail fica livre para um novo cadastro; as mensagens ficam. */
  deleteAccount(userId?: string): Promise<void>
  /** Registra que a pessoa aceitou os Termos de Uso desta versão. Não falha se o banco ainda não tiver o recurso. */
  acceptTerms(version: string): Promise<void>
  onAdminUsersChange(cb: () => void): () => void
  /** denuncia uma pessoa (só o administrador vê; a pessoa denunciada não fica sabendo). Limite de 5 por dia. */
  reportUser(reportedId: string, reason: ReportReason, details: string): Promise<void>
  /** só o administrador */
  adminListReports(): Promise<Report[]>
  adminResolveReport(id: string, resolved: boolean): Promise<void>

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
