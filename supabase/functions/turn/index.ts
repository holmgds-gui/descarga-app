// Descarga — entrega o servidor de apoio (TURN) para as calls, só para quem está logado.
// A conexão direta continua sendo a primeira opção; o TURN só é usado quando ela falha.
// Configuração:
//   app_secrets.turn_urls      → endereços, separados por vírgula (ex.: relay1.expressturn.com:3478)
//   app_secrets.turn_username  → usuário do painel do provedor
//   segredo TURN_PASSWORD      → senha do painel (segredo da função, ninguém do app lê direto)
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(token)
  if (!auth?.user) return json({ error: 'faça login' }, 401)
  // o servidor de apoio é só para contas aprovadas
  const { data: prof } = await admin.from('profiles').select('approval').eq('id', auth.user.id).single()
  if (prof?.approval !== 'approved') return json({ iceServers: [], configured: false })

  const { data: rows } = await admin.from('app_secrets').select('name, value').in('name', ['turn_urls', 'turn_username'])
  const cfg = Object.fromEntries((rows ?? []).map((r) => [r.name, r.value]))
  const password = Deno.env.get('TURN_PASSWORD')
  if (!cfg.turn_urls || !cfg.turn_username || !password) return json({ iceServers: [], configured: false })

  // cada endereço vira as variações UDP, TCP e (se houver porta 443/5349) TLS
  const urls: string[] = []
  for (const raw of String(cfg.turn_urls).split(',').map((s) => s.trim()).filter(Boolean)) {
    const host = raw.replace(/^turns?:/, '').replace(/\?.*$/, '')
    const port = host.includes(':') ? host.split(':').pop() : '3478'
    const base = host.includes(':') ? host : `${host}:3478`
    if (port === '443' || port === '5349') urls.push(`turns:${base}?transport=tcp`)
    else urls.push(`turn:${base}?transport=udp`, `turn:${base}?transport=tcp`)
  }
  return json({ iceServers: [{ urls, username: cfg.turn_username, credential: password }], configured: true })
})
