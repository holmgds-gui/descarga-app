// Descarga — fotos e vídeos de visualização única (só em conversas diretas e grupos).
// Os arquivos ficam numa pasta que ninguém baixa direto: só esta função entrega um link temporário,
// uma vez por pessoa. Quando todos abrem, o arquivo é apagado e a mensagem passa a mostrar "aberta".
//   { action: 'open', messageId }  -> { files: [{ path, url, name, type, kind }] }  ou  { already: true }
//   { action: 'done', messageId }  -> { ok: true }  (apaga os arquivos se todos já abriram)
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Att = { path: string; name: string; type: string; kind: string; once?: boolean; gone?: boolean }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(token)
  const me = auth?.user
  if (!me) return json({ error: 'faça login' }, 401)

  let body: { action?: string; messageId?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const messageId = body.messageId ?? ''
  if (!/^[0-9a-f-]{36}$/.test(messageId)) return json({ error: 'mensagem inválida' }, 400)

  const { data: msg } = await admin.from('messages').select('id, channel_id, author_id, attachments').eq('id', messageId).maybeSingle()
  if (!msg) return json({ error: 'mensagem não encontrada' }, 404)
  const atts = (msg.attachments ?? []) as Att[]
  const onceAtts = atts.filter((a) => a.once)
  if (!onceAtts.length) return json({ error: 'esta mensagem não é de visualização única' }, 400)

  // só quem participa da conversa (e não é quem enviou) abre
  const { data: members } = await admin.from('channel_members').select('user_id').eq('channel_id', msg.channel_id)
  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id)
  if (!ids.includes(me.id) || me.id === msg.author_id) return json({ error: 'sem permissão' }, 403)
  const recipients = ids.filter((id: string) => id !== msg.author_id)

  // quando todos abriram: apaga os arquivos e marca a mensagem
  const cleanupIfAllOpened = async () => {
    const { data: views } = await admin.from('once_views').select('user_id').eq('message_id', messageId)
    const opened = new Set((views ?? []).map((v: { user_id: string }) => v.user_id))
    if (!recipients.every((id: string) => opened.has(id))) return false
    const live = onceAtts.filter((a) => !a.gone)
    if (!live.length) return true
    await admin.storage.from('anexos').remove(live.map((a) => a.path))
    const next = atts.map((a) => (a.once ? { ...a, gone: true } : a))
    await admin.from('messages').update({ attachments: next }).eq('id', messageId)
    return true
  }

  if (body.action === 'done') {
    const { data: mine } = await admin.from('once_views').select('user_id').eq('message_id', messageId).eq('user_id', me.id).maybeSingle()
    if (!mine) return json({ error: 'abra primeiro' }, 400)
    await cleanupIfAllOpened()
    return json({ ok: true })
  }

  if (body.action !== 'open') return json({ error: 'ação inválida' }, 400)
  if (onceAtts.every((a) => a.gone)) return json({ already: true })

  // registra a abertura: se já tinha aberto, não entrega de novo
  const ins = await admin.from('once_views').insert({ message_id: messageId, user_id: me.id })
  if (ins.error) {
    await cleanupIfAllOpened()
    return json({ already: true })
  }
  const files: { path: string; url: string; name: string; type: string; kind: string }[] = []
  for (const a of onceAtts.filter((x) => !x.gone)) {
    const s = await admin.storage.from('anexos').createSignedUrl(a.path, 300)
    if (s.data?.signedUrl) files.push({ path: a.path, url: s.data.signedUrl, name: a.name, type: a.type, kind: a.kind })
  }
  return json({ files })
})
