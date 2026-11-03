// Descarga — envia notificações (menções, respostas e calls) para os aparelhos inscritos.
// O app chama esta função depois de mandar uma mensagem com @ ou resposta, e quando alguém entra numa call.
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

  const { data: me } = await admin.from('profiles').select('username, display_name, avatar_url').eq('id', user.id).single()
  const myName = me?.display_name || me?.username || 'Alguém'

  let recipients: string[] = []
  let payload: Payload

  if (body.type === 'message' && body.messageId) {
    const { data: msg } = await admin
      .from('messages')
      .select('id, content, author_id, reply_to, channel_id, channels(name, server_id, servers(name))')
      .eq('id', body.messageId)
      .single()
    if (!msg || msg.author_id !== user.id) return json({ error: 'mensagem não encontrada' }, 404)
    // deno-lint-ignore no-explicit-any
    const ch = msg.channels as any
    const serverId: string = ch.server_id

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
    const text = msg.content.length > 140 ? msg.content.slice(0, 137) + '…' : msg.content
    payload = {
      title: `${myName} em #${ch.name}`,
      body: text,
      tag: `msg-${msg.channel_id}`,
      url: `${appUrl}?servidor=${serverId}&canal=${msg.channel_id}`,
      icon: me?.avatar_url ?? undefined,
    }
  } else if (body.type === 'call' && body.channelId) {
    const { data: ch } = await admin
      .from('channels')
      .select('id, name, type, server_id, servers(name)')
      .eq('id', body.channelId)
      .single()
    if (!ch || ch.type !== 'voice') return json({ error: 'canal não encontrado' }, 404)
    const { data: isMember } = await admin
      .from('server_members').select('user_id').eq('server_id', ch.server_id).eq('user_id', user.id).maybeSingle()
    if (!isMember) return json({ error: 'sem acesso' }, 403)

    const { data: last } = await admin.from('call_notify_log').select('last_at').eq('channel_id', ch.id).maybeSingle()
    if (last && Date.now() - new Date(last.last_at).getTime() < CALL_COOLDOWN_MS) return json({ sent: 0, skipped: 'recente' })
    await admin.from('call_notify_log').upsert({ channel_id: ch.id, last_at: new Date().toISOString() })

    const { data: members } = await admin.from('server_members').select('user_id').eq('server_id', ch.server_id)
    recipients = (members ?? []).map((m) => m.user_id as string)
    // deno-lint-ignore no-explicit-any
    const serverName = (ch.servers as any)?.name ?? ''
    payload = {
      title: `${myName} entrou na call 🔊`,
      body: `${ch.name} • ${serverName}`,
      tag: `call-${ch.id}`,
      url: `${appUrl}?servidor=${ch.server_id}&canal=${ch.id}`,
      icon: me?.avatar_url ?? undefined,
    }
  } else {
    return json({ error: 'tipo inválido' }, 400)
  }

  recipients = [...new Set(recipients)].filter((id) => id !== user.id)
  if (!recipients.length) return json({ sent: 0 })

  const { data: secrets } = await admin.from('app_secrets').select('name, value')
  const s = Object.fromEntries((secrets ?? []).map((r) => [r.name, r.value]))
  webpush.setVapidDetails(s.vapid_subject, s.vapid_public, s.vapid_private)

  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', recipients)
  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
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
