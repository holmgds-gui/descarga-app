-- Extras do chat: mensagens encaminhadas, mensagens fixadas, leitura por pessoa e visualização única.

-- ---------- encaminhadas ----------
alter table public.messages add column if not exists forwarded boolean not null default false;

-- ---------- fixadas ----------
-- DM: qualquer participante fixa. Canal de servidor: dono e moderadores.
create or replace function public.can_pin(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved() and exists (
    select 1 from public.channels ch
     where ch.id = c
       and ((ch.type = 'dm' and public.can_read_channel(c))
         or (ch.server_id is not null and public.is_server_mod(ch.server_id)))
  );
$$;
revoke execute on function public.can_pin(uuid) from public, anon;
grant  execute on function public.can_pin(uuid) to authenticated;

create table if not exists public.message_pins (
  message_id uuid primary key references public.messages(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  pinned_by  uuid references auth.users(id) on delete set null,
  pinned_at  timestamptz not null default now()
);
create index if not exists message_pins_channel on public.message_pins(channel_id, pinned_at desc);
alter table public.message_pins enable row level security;
create policy "ver fixadas" on public.message_pins for select using (public.can_read_channel(channel_id));
create policy "fixar mensagem" on public.message_pins for insert
  with check (pinned_by = auth.uid() and public.can_pin(channel_id)
    and exists (select 1 from public.messages m where m.id = message_id and m.channel_id = channel_id));
create policy "desafixar mensagem" on public.message_pins for delete using (public.can_pin(channel_id));
revoke update on public.message_pins from anon, authenticated;

-- ---------- confirmação de leitura por pessoa ----------
-- uma linha = "owner desligou a confirmação de leitura para peer" (vale nos dois sentidos, como no WhatsApp)
create table if not exists public.read_receipt_off (
  owner uuid not null references auth.users(id) on delete cascade,
  peer  uuid not null references auth.users(id) on delete cascade,
  primary key (owner, peer)
);
alter table public.read_receipt_off enable row level security;
create policy "ver minhas preferências de leitura" on public.read_receipt_off for select
  using (owner = auth.uid() or peer = auth.uid());
create policy "desligar leitura para alguém" on public.read_receipt_off for insert
  with check (owner = auth.uid() and peer <> auth.uid());
create policy "religar leitura para alguém" on public.read_receipt_off for delete using (owner = auth.uid());
revoke update on public.read_receipt_off from anon, authenticated;

-- ---------- visualização única ----------
-- quem abriu cada mensagem de visualização única (só a função de servidor grava)
create table if not exists public.once_views (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  opened_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.once_views enable row level security;
create policy "ver quem abriu" on public.once_views for select
  using (user_id = auth.uid()
    or exists (select 1 from public.messages m where m.id = message_id and m.author_id = auth.uid()));
revoke insert, update, delete on public.once_views from anon, authenticated;

-- os arquivos de visualização única ficam na pasta "once": ninguém lista nem baixa direto,
-- só a função de servidor entrega um link temporário, uma vez por pessoa
drop policy if exists "ler anexos das minhas conversas" on storage.objects;
create policy "ler anexos das minhas conversas" on storage.objects for select
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and coalesce((storage.foldername(name))[3], '') <> 'once'
    and public.can_read_channel(((storage.foldername(name))[1])::uuid));

-- ---------- tempo real ----------
do $$ begin alter publication supabase_realtime add table public.message_pins;      exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.read_receipt_off;  exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.once_views;        exception when duplicate_object then null; end $$;
alter table public.message_pins replica identity full;
alter table public.read_receipt_off replica identity full;
alter table public.once_views replica identity full;
