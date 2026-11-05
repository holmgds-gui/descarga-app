// Descarga — envia notificações (menções, respostas e calls) para os aparelhos inscritos.
// O app chama esta função depois de mandar uma mensagem com @ ou resposta (ou qualquer mensagem numa conversa
// direta), quando alguém entra numa call e quando alguém novo pede para entrar (aviso para o administrador).
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const CALL_COOLDOWN_MS = 3 * 60 * 1000
const MENTION = /@([a-z0-9_.]{2,32})/g

type Payload = { title: string; body: string; tag: string; url: string; icon?: string }
type Lang = 'pt' | 'en'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(token)
  const user = auth?.user
  if (!user) return json({ error: 'faça login' }, 401)

  let body: { type?: string; messageId?: string; channelId?: string; appUrl?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'corpo inválido' }, 400)
  }
  const appUrl = typeof body.appUrl === 'string' && /^https:\/\//.test(body.appUrl) ? body.appUrl : ''

  const { data: me } = await admin.from('profiles').select('username, display_name, avatar_url, approval').eq('id', user.id).single()
  const myName = me?.display_name || me?.username || 'Descarga'
  // só contas aprovadas mandam avisos (o pedido de entrada é a única exceção: vem de quem ainda está pendente)
  if (body.type !== 'signup' && me?.approval !== 'approved') return json({ error: 'conta não aprovada' }, 403)

  let recipients: string[] = []
  let payloadFor: (lang: Lang) => Payload

  if (body.type === 'message' && body.messageId) {
    const { data: msg } = await admin
      .from('messages')
      .select('id, content, author_id, reply_to, channel_id, attachments, channels(name, type, title, is_group, server_id)')
      .eq('id', body.messageId)
      .single()
    if (!msg || msg.author_id !== user.id) return json({ error: 'mensagem não encontrada' }, 404)
    // deno-lint-ignore no-explicit-any
    const ch = msg.channels as any
    const serverId: string | null = ch.server_id
    // deno-lint-ignore no-explicit-any
    const files = (msg.attachments ?? []) as any[]
    const preview = (lang: Lang) => {
      if (msg.content) return msg.content.length > 140 ? msg.content.slice(0, 137) + '…' : msg.content
      if (files.some((f) => f.voice)) return lang === 'en' ? '🎤 Voice message' : '🎤 Mensagem de voz'
      if (files.some((f) => f.kind === 'image')) return lang === 'en' ? '🖼️ Image' : '🖼️ Imagem'
      return lang === 'en' ? '📎 File' : '📎 Arquivo'
    }

    if (ch.type === 'dm') {
      // conversa direta: avisa todo mundo da conversa
      const { data: members } = await admin.from('channel_members').select('user_id').eq('channel_id', msg.channel_id)
      const ids = (members ?? []).map((m) => m.user_id as string)
      if (!ids.includes(user.id)) return json({ error: 'sem acesso' }, 403)
      recipients = ids
      const group = ch.is_group ? (ch.title || null) : null
      payloadFor = (lang) => ({
        title: ch.is_group ? `${myName} • ${group ?? (lang === 'en' ? 'Group' : 'Grupo')}` : myName,
        body: preview(lang),
        tag: `msg-${msg.channel_id}`,
        url: `${appUrl}?dm=${msg.channel_id}`,
        icon: me?.avatar_url ?? undefined,
      })
    } else {

    const { data: members } = await admin.from('server_members').select('user_id').eq('server_id', serverId)
    const memberIds = new Set((members ?? []).map((m) => m.user_id as string))

    const names = [...new Set([...msg.content.matchAll(MENTION)].map((m) => m[1]))]
    if (names.length) {
      const { data: mentioned } = await admin.from('profiles').select('id').in('username', names)
      for (const p of mentioned ?? []) if (memberIds.has(p.id)) recipients.push(p.id)
    }
    if (msg.reply_to) {
      const { data: parent } = await admin.from('messages').select('author_id').eq('id', msg.reply_to).single()
      if (parent && memberIds.has(parent.author_id)) recipients.push(parent.author_id)
    }
    payloadFor = (lang) => ({
      title: lang === 'en' ? `${myName} in #${ch.name}` : `${myName} em #${ch.name}`,
      body: preview(lang),
      tag: `msg-${msg.channel_id}`,
      url: `${appUrl}?servidor=${serverId}&canal=${msg.channel_id}`,
      icon: me?.avatar_url ?? undefined,
    })
    }
  } else if (body.type === 'call' && body.channelId) {
    const { data: ch } = await admin
      .from('channels')
      .select('id, name, type, server_id, is_group, title, servers(name)')
      .eq('id', body.channelId)
      .single()
    if (!ch || (ch.type !== 'voice' && ch.type !== 'dm')) return json({ error: 'canal não encontrado' }, 404)
    const isDm = ch.type === 'dm'
    let ids: string[]
    if (isDm) {
      const { data: members } = await admin.from('channel_members').select('user_id').eq('channel_id', ch.id)
      ids = (members ?? []).map((m) => m.user_id as string)
    } else {
      const { data: members } = await admin.from('server_members').select('user_id').eq('server_id', ch.server_id)
      ids = (members ?? []).map((m) => m.user_id as string)
    }
    if (!ids.includes(user.id)) return json({ error: 'sem acesso' }, 403)

    const { data: last } = await admin.from('call_notify_log').select('last_at').eq('channel_id', ch.id).maybeSingle()
    if (last && Date.now() - new Date(last.last_at).getTime() < CALL_COOLDOWN_MS) return json({ sent: 0, skipped: 'recente' })
    await admin.from('call_notify_log').upsert({ channel_id: ch.id, last_at: new Date().toISOString() })

    recipients = ids
    // deno-lint-ignore no-explicit-any
    const serverName = (ch.servers as any)?.name ?? ''
    payloadFor = (lang) => isDm ? ({
      title: lang === 'en' ? `${myName} is calling you 📞` : `${myName} está te ligando 📞`,
      body: ch.is_group ? (ch.title || (lang === 'en' ? 'Group call' : 'Call em grupo')) : (lang === 'en' ? 'Tap to join' : 'Toque para entrar'),
      tag: `call-${ch.id}`,
      url: `${appUrl}?dm=${ch.id}`,
      icon: me?.avatar_url ?? undefined,
    }) : ({
      title: lang === 'en' ? `${myName} joined the call 🔊` : `${myName} entrou na call 🔊`,
      body: `${ch.name} • ${serverName}`,
      tag: `call-${ch.id}`,
      url: `${appUrl}?servidor=${ch.server_id}&canal=${ch.id}`,
      icon: me?.avatar_url ?? undefined,
    })
  } else if (body.type === 'signup') {
    // quem acabou de se cadastrar avisa o administrador (uma vez só por conta)
    const { data: self } = await admin.from('profiles').select('approval, admin_notified, username, display_name').eq('id', user.id).single()
    if (!self || self.approval !== 'pending') return json({ sent: 0, skipped: 'nao_pendente' })
    if (self.admin_notified) return json({ sent: 0, skipped: 'ja_avisado' })
    await admin.from('profiles').update({ admin_notified: true }).eq('id', user.id)
    const { data: admins } = await admin.from('profiles').select('id').eq('is_admin', true)
    recipients = (admins ?? []).map((a) => a.id as string)
    const who = self.display_name || self.username
    payloadFor = (lang) => ({
      title: lang === 'en' ? 'New request to join' : 'Novo pedido para entrar',
      body: lang === 'en' ? `${who} (@${self.username}) wants to join Descarga` : `${who} (@${self.username}) quer entrar no Descarga`,
      tag: `signup-${user.id}`,
      url: `${appUrl}?admin=1`,
      icon: me?.avatar_url ?? undefined,
    })
  } else {
    return json({ error: 'tipo inválido' }, 400)
  }

  recipients = [...new Set(recipients)].filter((id) => id !== user.id)
  if (recipients.length) {
    // contas pendentes ou bloqueadas não recebem avisos
    const { data: ok } = await admin.from('profiles').select('id').in('id', recipients).eq('approval', 'approved')
    recipients = (ok ?? []).map((r) => r.id as string)
  }
  if (!recipients.length) return json({ sent: 0 })

  const { data: secrets } = await admin.from('app_secrets').select('name, value')
  const s = Object.fromEntries((secrets ?? []).map((r) => [r.name, r.value]))
  webpush.setVapidDetails(s.vapid_subject, s.vapid_public, s.vapid_private)

  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth, lang').in('user_id', recipients)
  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payloadFor(sub.lang === 'en' ? 'en' : 'pt')),
          { TTL: 60 * 60, urgency: 'high' },
        )
        sent++
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }),
  )
  return json({ sent })
})
