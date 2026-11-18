// Descarga — exclui uma conta de verdade: login e e-mail somem (o e-mail pode ser usado de novo num cadastro novo),
// o perfil vira "Usuário excluído" e os arquivos da pessoa são apagados. As mensagens ficam.
// Quem pode: o administrador (qualquer conta que não seja a dele) ou a própria pessoa (a sua).
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
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(token)
  const caller = auth?.user
  if (!caller) return json({ error: 'faça login' }, 401)

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const target = typeof body.userId === 'string' && body.userId ? body.userId : caller.id
  if (!/^[0-9a-f-]{36}$/.test(target)) return json({ error: 'conta inválida' }, 400)

  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', caller.id).single()
  const isAdmin = !!me?.is_admin
  if (target !== caller.id && !isAdmin) return json({ error: 'sem permissão' }, 403)
  const { data: tgt } = await admin.from('profiles').select('is_admin, deleted_at').eq('id', target).single()
  if (!tgt) return json({ error: 'conta não encontrada' }, 404)
  if (tgt.deleted_at) return json({ ok: true, jaExcluida: true })
  if (tgt.is_admin) return json({ error: 'a conta do administrador não pode ser excluída' }, 403)

  // 1) lista os arquivos antes de apagar o perfil
  const { data: files } = await admin.rpc('account_files', { target })
  // 2) perfil vira "Usuário excluído" e sai de servidores, amizades e conversas
  const t = await admin.rpc('account_tombstone', { target })
  if (t.error) return json({ error: t.error.message }, 500)
  // 3) apaga os arquivos
  const byBucket: Record<string, string[]> = {}
  for (const f of (files ?? []) as { bucket: string; path: string }[]) (byBucket[f.bucket] ??= []).push(f.path)
  for (const [bucket, paths] of Object.entries(byBucket)) {
    for (let i = 0; i < paths.length; i += 100) await admin.storage.from(bucket).remove(paths.slice(i, i + 100))
  }
  // 4) apaga o login (libera o e-mail)
  const d = await admin.auth.admin.deleteUser(target)
  if (d.error) return json({ error: d.error.message }, 500)
  return json({ ok: true })
})
