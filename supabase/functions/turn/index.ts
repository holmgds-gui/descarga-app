// Descarga — entrega servidores de apoio (TURN da Cloudflare) para as calls.
// A conexão direta continua sendo a primeira opção; o TURN só é usado quando ela falha.
// Segredos: CF_TURN_API_TOKEN (segredo da função). O ID da chave fica em CF_TURN_KEY_ID ou na tabela app_secrets.
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

  const apiToken = Deno.env.get('CF_TURN_API_TOKEN')
  let keyId = Deno.env.get('CF_TURN_KEY_ID')
  if (!keyId) {
    const { data } = await admin.from('app_secrets').select('value').eq('name', 'cf_turn_key_id').maybeSingle()
    keyId = data?.value
  }
  if (!apiToken || !keyId) return json({ iceServers: [], configured: false })

  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 6 * 60 * 60 }),
  })
  if (!res.ok) return json({ iceServers: [], configured: true, error: `cloudflare ${res.status}` })

  const body = await res.json()
  const raw = Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers]
  // navegadores costumam bloquear a porta 53; tira essas opções para não atrasar a conexão
  const iceServers = raw
    .filter(Boolean)
    .map((s: { urls: string | string[]; username?: string; credential?: string }) => ({
      ...s,
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)),
    }))
    .filter((s: { urls: string[] }) => s.urls.length)
  return json({ iceServers, configured: true })
})
