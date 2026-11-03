export type Status = 'online' | 'idle' | 'dnd' | 'invisible'

export interface ProfileLink {
  label: string
  url: string
}

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
  created_at: string
}

export type ProfilePatch = Partial<Omit<Profile, 'id' | 'created_at'>>

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
  server_id: string
  name: string
  type: ChannelType
  category: string
  topic: string
  position: number
  created_at: string
}

export interface Message {
  id: string
  channel_id: string
  author_id: string
  content: string
  reply_to: string | null
  edited_at: string | null
  created_at: string
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
  sendMessage(channelId: string, content: string, replyTo: string | null): Promise<Message>
  editMessage(id: string, content: string): Promise<void>
  deleteMessage(id: string): Promise<void>
  subscribeMessages(channelId: string, h: MessageHandlers): () => void

  /** Sala de tempo real (presença + mensagens rápidas) usada pelas calls. */
  openRoom(topic: string): RealtimeRoom
  /** Notificações com o app fechado (só na versão online). */
  pushSupported: boolean
  savePushSubscription(sub: PushSubscriptionJSON): Promise<void>
  removePushSubscription(endpoint: string): Promise<void>
  notify(body: { type: 'message'; messageId: string } | { type: 'call'; channelId: string }): Promise<void>
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
