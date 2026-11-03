-- =========================================================
-- Descarga — Etapa 1: perfis, servidores, canais e mensagens
-- Cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- PERFIS ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null check (username ~ '^[a-z0-9_.]{2,32}$'),
  display_name  text not null default '' check (char_length(display_name) <= 32),
  avatar_url    text,
  banner_url    text,
  accent_color  text not null default '#7B3FE4' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  bio           text not null default '' check (char_length(bio) <= 300),
  pronouns      text not null default '' check (char_length(pronouns) <= 40),
  birthday      date,
  city          text not null default '' check (char_length(city) <= 60),
  links         jsonb not null default '[]'::jsonb,
  status        text not null default 'online' check (status in ('online','idle','dnd','invisible')),
  custom_status text not null default '' check (char_length(custom_status) <= 80),
  created_at    timestamptz not null default now()
);

-- cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'usuario'),
    '[^a-zA-Z0-9_.]', '', 'g'));
  if char_length(base) < 2 then base := 'usuario'; end if;
  base := left(base, 26);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    left(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', candidate), 32),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- SERVIDORES ----------
create table if not exists public.servers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  icon_url    text,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at  timestamptz not null default now()
);

create table if not exists public.server_members (
  server_id uuid references public.servers(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (server_id, user_id)
);

create table if not exists public.channels (
  id         uuid primary key default gen_random_uuid(),
  server_id  uuid not null references public.servers(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  type       text not null default 'text' check (type in ('text','voice')),
  category   text not null default 'Canais de texto',
  topic      text not null default '',
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 4000),
  reply_to   uuid references public.messages(id) on delete set null,
  edited_at  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_channel_created on public.messages(channel_id, created_at desc);

-- ---------- FUNÇÕES AUXILIARES ----------
create or replace function public.is_member(s uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.server_members where server_id = s and user_id = auth.uid());
$$;

create or replace function public.shares_server(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.server_members a
    join public.server_members b on a.server_id = b.server_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- quando um servidor é criado: dono vira membro + canais padrão
create or replace function public.handle_new_server()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.server_members (server_id, user_id) values (new.id, new.owner_id);
  insert into public.channels (server_id, name, type, category, position) values
    (new.id, 'geral',  'text',  'Canais de texto', 0),
    (new.id, 'memes',  'text',  'Canais de texto', 1),
    (new.id, 'Geral',  'voice', 'Canais de voz',   0);
  return new;
end $$;

drop trigger if exists on_server_created on public.servers;
create trigger on_server_created
  after insert on public.servers
  for each row execute function public.handle_new_server();

-- entrar num servidor pelo código de convite
create or replace function public.join_server(code text)
returns public.servers language plpgsql security definer set search_path = public as $$
declare s public.servers;
begin
  select * into s from public.servers where invite_code = code;
  if s.id is null then raise exception 'Convite inválido'; end if;
  insert into public.server_members (server_id, user_id) values (s.id, auth.uid())
  on conflict do nothing;
  return s;
end $$;

-- ---------- SEGURANÇA (RLS) ----------
alter table public.profiles       enable row level security;
alter table public.servers        enable row level security;
alter table public.server_members enable row level security;
alter table public.channels       enable row level security;
alter table public.messages       enable row level security;

-- perfis: você vê o seu e o de quem divide servidor com você
create policy "ver perfis" on public.profiles for select
  using (id = auth.uid() or public.shares_server(id));
create policy "editar o próprio perfil" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- servidores
create policy "ver servidores onde sou membro" on public.servers for select
  using (public.is_member(id) or owner_id = auth.uid());
create policy "criar servidor" on public.servers for insert
  with check (owner_id = auth.uid());
create policy "dono edita servidor" on public.servers for update
  using (owner_id = auth.uid());
create policy "dono apaga servidor" on public.servers for delete
  using (owner_id = auth.uid());

-- membros
create policy "ver membros" on public.server_members for select
  using (public.is_member(server_id));
create policy "sair do servidor" on public.server_members for delete
  using (user_id = auth.uid());

-- canais
create policy "ver canais" on public.channels for select
  using (public.is_member(server_id));
create policy "dono cria canal" on public.channels for insert
  with check (exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));
create policy "dono edita canal" on public.channels for update
  using (exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));
create policy "dono apaga canal" on public.channels for delete
  using (exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));

-- mensagens
create policy "ler mensagens" on public.messages for select
  using (exists (select 1 from public.channels c where c.id = channel_id and public.is_member(c.server_id)));
create policy "enviar mensagens" on public.messages for insert
  with check (author_id = auth.uid() and exists (
    select 1 from public.channels c where c.id = channel_id and c.type = 'text' and public.is_member(c.server_id)));
create policy "editar a própria mensagem" on public.messages for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "apagar a própria mensagem" on public.messages for delete
  using (author_id = auth.uid());

-- ---------- TEMPO REAL ----------
alter table public.messages replica identity full;
alter publication supabase_realtime add table public.messages, public.channels, public.server_members, public.profiles;

-- ---------- ARQUIVOS (fotos de perfil, banners, ícones) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 10485760)
on conflict (id) do nothing;

create policy "qualquer um vê mídia" on storage.objects for select
  using (bucket_id = 'media');
create policy "enviar na própria pasta" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "trocar na própria pasta" on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "apagar na própria pasta" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
