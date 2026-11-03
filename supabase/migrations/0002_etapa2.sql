-- =========================================================
-- Descarga — Etapa 2: calls direto entre aparelhos e notificações
-- =========================================================

-- ---------- CANAIS PRIVADOS DO TEMPO REAL (calls) ----------
-- tópicos usados pelo app:
--   voz:<id do servidor>  → quem está em qual call (presença)
--   call:<id do canal>    → sinalização da call (conectar os aparelhos)
create or replace function public.can_use_topic(t text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  rest text;
begin
  if t like 'voz:%' then
    rest := substr(t, 5);
    if rest !~ '^[0-9a-f-]{36}$' then return false; end if;
    return public.is_member(rest::uuid);
  elsif t like 'call:%' then
    rest := substr(t, 6);
    if rest !~ '^[0-9a-f-]{36}$' then return false; end if;
    return exists (
      select 1 from public.channels c
      where c.id = rest::uuid and c.type = 'voice' and public.is_member(c.server_id)
    );
  end if;
  return false;
end $$;

revoke execute on function public.can_use_topic(text) from public, anon;
grant  execute on function public.can_use_topic(text) to authenticated;

create policy "membros ouvem calls e presença de voz" on realtime.messages
  for select to authenticated
  using (public.can_use_topic(realtime.topic()));

create policy "membros falam em calls e presença de voz" on realtime.messages
  for insert to authenticated
  with check (public.can_use_topic(realtime.topic()));

-- ---------- NOTIFICAÇÕES ----------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "ver as minhas inscrições" on public.push_subscriptions for select
  using (user_id = auth.uid());
create policy "criar as minhas inscrições" on public.push_subscriptions for insert
  with check (user_id = auth.uid());
create policy "trocar as minhas inscrições" on public.push_subscriptions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "apagar as minhas inscrições" on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- evita avisar a mesma call várias vezes seguidas
create table if not exists public.call_notify_log (
  channel_id uuid primary key references public.channels(id) on delete cascade,
  last_at    timestamptz not null default now()
);
alter table public.call_notify_log enable row level security;
revoke all on public.call_notify_log from anon, authenticated;

-- segredos usados só pela função do servidor (ninguém do app consegue ler)
create table if not exists public.app_secrets (
  name  text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
