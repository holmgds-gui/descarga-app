-- =========================================================
-- Descarga — Etapa 3, bloco Social
-- Amigos, mensagens diretas (DM) e grupos, reações, emojis do servidor,
-- anexos (arquivos e áudios), confirmação de leitura e calls em DM.
-- =========================================================

-- ---------- DMs usam a mesma tabela de canais, sem servidor ----------
alter table public.channels alter column server_id drop not null;
alter table public.channels drop constraint if exists channels_type_check;
alter table public.channels add constraint channels_type_check check (type in ('text', 'voice', 'dm'));
alter table public.channels add constraint channels_dm_shape check ((type = 'dm') = (server_id is null));
alter table public.channels add column if not exists is_group boolean not null default false;
alter table public.channels add column if not exists title text check (title is null or char_length(title) <= 60);
alter table public.channels add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.channels add column if not exists last_message_at timestamptz;

create table if not exists public.channel_members (
  channel_id   uuid references public.channels(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (channel_id, user_id)
);
create index if not exists channel_members_user on public.channel_members(user_id);

-- ---------- amigos ----------
create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null references public.profiles(id) on delete cascade,
  addressee  uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

-- ---------- reações ----------
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 80),
  channel_id uuid not null references public.channels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists message_reactions_channel on public.message_reactions(channel_id);

-- ---------- emojis próprios do servidor ----------
create table if not exists public.server_emojis (
  id         uuid primary key default gen_random_uuid(),
  server_id  uuid not null references public.servers(id) on delete cascade,
  name       text not null check (name ~ '^[a-z0-9_]{2,32}$'),
  url        text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (server_id, name)
);

-- ---------- anexos nas mensagens ----------
alter table public.messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check
  check (char_length(content) <= 4000 and (char_length(content) >= 1 or jsonb_array_length(attachments) > 0));

-- ---------- privacidade: confirmação de leitura ----------
alter table public.profiles add column if not exists read_receipts boolean not null default true;
grant update (read_receipts) on public.profiles to authenticated;

-- ---------- funções de acesso ----------
create or replace function public.is_dm_member(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.channel_members where channel_id = c and user_id = auth.uid());
$$;

create or replace function public.can_read_channel(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.channels ch
    where ch.id = c
      and ((ch.server_id is not null and public.is_member(ch.server_id))
        or (ch.type = 'dm' and public.is_dm_member(ch.id)))
  );
$$;

create or replace function public.are_friends(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = auth.uid() and f.addressee = other) or (f.addressee = auth.uid() and f.requester = other))
  );
$$;

create or replace function public.can_see_profile(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select other = auth.uid()
    or public.shares_server(other)
    or exists (select 1 from public.friendships f
               where (f.requester = auth.uid() and f.addressee = other) or (f.addressee = auth.uid() and f.requester = other))
    or exists (select 1 from public.channel_members a join public.channel_members b on a.channel_id = b.channel_id
               where a.user_id = auth.uid() and b.user_id = other);
$$;

-- presença e sinalização das calls também valem para DMs
create or replace function public.can_use_topic(t text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  rest text;
begin
  if t like 'voz:%' then
    rest := substr(t, 5);
    if rest !~ '^[0-9a-f-]{36}$' then return false; end if;
    return public.is_member(rest::uuid) or public.is_dm_member(rest::uuid);
  elsif t like 'call:%' then
    rest := substr(t, 6);
    if rest !~ '^[0-9a-f-]{36}$' then return false; end if;
    return exists (
      select 1 from public.channels c
      where c.id = rest::uuid
        and ((c.type = 'voice' and public.is_member(c.server_id)) or (c.type = 'dm' and public.is_dm_member(c.id)))
    );
  end if;
  return false;
end $$;

-- ---------- ações (RPC) ----------
-- procurar alguém pelo nome de usuário para adicionar como amigo
create or replace function public.find_profile(uname text)
returns table (id uuid, username text, display_name text, avatar_url text, accent_color text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.accent_color
  from public.profiles p where p.username = lower(trim(uname)) and auth.uid() is not null;
$$;

create or replace function public.send_friend_request(uname text)
returns public.friendships language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  f public.friendships;
begin
  if me is null then raise exception 'login'; end if;
  select id into other from public.profiles where username = lower(trim(uname));
  if other is null then raise exception 'nao_encontrado'; end if;
  if other = me then raise exception 'voce_mesmo'; end if;
  select * into f from public.friendships
   where least(requester, addressee) = least(me, other) and greatest(requester, addressee) = greatest(me, other);
  if f.id is not null then
    if f.status = 'accepted' then raise exception 'ja_amigos'; end if;
    if f.addressee = me then
      update public.friendships set status = 'accepted' where id = f.id returning * into f;
      return f;
    end if;
    raise exception 'ja_enviado';
  end if;
  insert into public.friendships (requester, addressee) values (me, other) returning * into f;
  return f;
end $$;

-- abrir (ou criar) uma conversa direta ou um grupo
create or replace function public.open_dm(user_ids uuid[], group_title text default null)
returns public.channels language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  others uuid[];
  ch public.channels;
  u uuid;
begin
  if me is null then raise exception 'login'; end if;
  select array_agg(distinct x) into others from unnest(user_ids) x where x <> me;
  if others is null or array_length(others, 1) = 0 then raise exception 'sem_pessoas'; end if;
  if array_length(others, 1) > 9 then raise exception 'grupo_grande'; end if;
  foreach u in array others loop
    if not (public.are_friends(u) or public.shares_server(u)) then raise exception 'sem_permissao'; end if;
  end loop;

  if array_length(others, 1) = 1 and group_title is null then
    -- conversa 1:1: reaproveita se já existir
    select c.* into ch from public.channels c
     where c.type = 'dm' and not c.is_group
       and exists (select 1 from public.channel_members m where m.channel_id = c.id and m.user_id = me)
       and exists (select 1 from public.channel_members m where m.channel_id = c.id and m.user_id = others[1])
     limit 1;
    if ch.id is not null then return ch; end if;
    insert into public.channels (server_id, name, type, category, is_group, owner_id)
      values (null, 'dm', 'dm', '', false, me) returning * into ch;
  else
    insert into public.channels (server_id, name, type, category, is_group, title, owner_id)
      values (null, 'grupo', 'dm', '', true, nullif(trim(group_title), ''), me) returning * into ch;
  end if;

  insert into public.channel_members (channel_id, user_id) values (ch.id, me);
  foreach u in array others loop
    insert into public.channel_members (channel_id, user_id) values (ch.id, u) on conflict do nothing;
  end loop;
  return ch;
end $$;

-- adicionar pessoas num grupo existente
create or replace function public.add_to_group(c uuid, user_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  if not exists (select 1 from public.channels where id = c and type = 'dm' and is_group) then raise exception 'nao_grupo'; end if;
  if not public.is_dm_member(c) then raise exception 'sem_permissao'; end if;
  if (select count(*) from public.channel_members where channel_id = c) + coalesce(array_length(user_ids, 1), 0) > 10 then
    raise exception 'grupo_grande';
  end if;
  foreach u in array user_ids loop
    if not (public.are_friends(u) or public.shares_server(u)) then raise exception 'sem_permissao'; end if;
    insert into public.channel_members (channel_id, user_id) values (c, u) on conflict do nothing;
  end loop;
end $$;

-- marca a conversa como lida (só se a pessoa deixou a confirmação de leitura ligada)
create or replace function public.mark_read(c uuid)
returns void language sql security definer set search_path = '' as $$
  update public.channel_members set last_read_at = now()
   where channel_id = c and user_id = auth.uid()
     and (select read_receipts from public.profiles where id = auth.uid());
$$;

-- ordena as DMs pela última mensagem
create or replace function public.touch_channel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.channels set last_message_at = new.created_at where id = new.channel_id and type = 'dm';
  return new;
end $$;
drop trigger if exists on_message_touch on public.messages;
create trigger on_message_touch after insert on public.messages for each row execute function public.touch_channel();

revoke execute on function public.touch_channel() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.is_dm_member(uuid)', 'public.can_read_channel(uuid)', 'public.are_friends(uuid)', 'public.can_see_profile(uuid)',
    'public.find_profile(text)', 'public.send_friend_request(text)', 'public.open_dm(uuid[], text)',
    'public.add_to_group(uuid, uuid[])', 'public.mark_read(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------- segurança (RLS) ----------
alter table public.channel_members   enable row level security;
alter table public.friendships       enable row level security;
alter table public.message_reactions enable row level security;
alter table public.server_emojis     enable row level security;

-- perfis: também amigos, pedidos e quem está nas suas DMs
drop policy if exists "ver perfis" on public.profiles;
create policy "ver perfis" on public.profiles for select using (public.can_see_profile(id));

-- canais (incluindo DMs)
drop policy if exists "ver canais" on public.channels;
create policy "ver canais" on public.channels for select using (public.can_read_channel(id));
create policy "membros renomeiam o grupo" on public.channels for update
  using (type = 'dm' and is_group and public.is_dm_member(id))
  with check (type = 'dm' and is_group);
-- só os campos de texto podem ser editados pelo app
revoke update on public.channels from anon, authenticated;
grant update (name, topic, category, position, title) on public.channels to authenticated;

-- membros das DMs
create policy "ver membros da conversa" on public.channel_members for select using (public.is_dm_member(channel_id));
create policy "sair da conversa" on public.channel_members for delete using (user_id = auth.uid());
revoke insert, update on public.channel_members from anon, authenticated;

-- mensagens: servidores e DMs
drop policy if exists "ler mensagens" on public.messages;
drop policy if exists "enviar mensagens" on public.messages;
create policy "ler mensagens" on public.messages for select using (public.can_read_channel(channel_id));
create policy "enviar mensagens" on public.messages for insert
  with check (author_id = auth.uid() and public.can_read_channel(channel_id) and exists (
    select 1 from public.channels c where c.id = channel_id and c.type in ('text', 'dm')));

-- amigos
create policy "ver minhas amizades" on public.friendships for select
  using (auth.uid() in (requester, addressee));
create policy "aceitar pedido" on public.friendships for update
  using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
create policy "recusar ou desfazer amizade" on public.friendships for delete
  using (auth.uid() in (requester, addressee));
revoke insert, update on public.friendships from anon, authenticated;
grant update (status) on public.friendships to authenticated;

-- reações
create policy "ver reações" on public.message_reactions for select using (public.can_read_channel(channel_id));
create policy "reagir" on public.message_reactions for insert
  with check (user_id = auth.uid() and public.can_read_channel(channel_id)
    and exists (select 1 from public.messages m where m.id = message_id and m.channel_id = channel_id));
create policy "tirar a própria reação" on public.message_reactions for delete using (user_id = auth.uid());

-- emojis do servidor (por enquanto, só o dono adiciona; cargos chegam no próximo bloco)
create policy "ver emojis dos meus servidores" on public.server_emojis for select using (public.is_member(server_id));
create policy "dono adiciona emoji" on public.server_emojis for insert
  with check (created_by = auth.uid() and exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));
create policy "dono apaga emoji" on public.server_emojis for delete
  using (exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));

-- ---------- arquivos das conversas (privados, até 50 MB) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = false;

create policy "ler anexos das minhas conversas" on storage.objects for select
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.can_read_channel(((storage.foldername(name))[1])::uuid));
create policy "enviar anexos nas minhas conversas" on storage.objects for insert
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.can_read_channel(((storage.foldername(name))[1])::uuid));
create policy "apagar os próprios anexos" on storage.objects for delete
  using (bucket_id = 'anexos' and (storage.foldername(name))[2] = auth.uid()::text);

-- ---------- tempo real ----------
alter publication supabase_realtime add table public.channel_members, public.friendships, public.message_reactions, public.server_emojis;
alter table public.message_reactions replica identity full;
alter table public.friendships replica identity full;
alter table public.channel_members replica identity full;
