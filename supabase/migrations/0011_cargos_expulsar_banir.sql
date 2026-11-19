-- Cargos com permissões, expulsar, banir e apagar servidor.
-- O dono tem todas as permissões. Só o dono cria cargos, escolhe quem tem cada cargo e apaga o servidor.

-- ---------- cargos ----------
create table if not exists public.server_roles (
  id          uuid primary key default gen_random_uuid(),
  server_id   uuid not null references public.servers(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 30),
  color       text not null default '#7B3FE4' check (color ~ '^#[0-9a-fA-F]{6}$'),
  permissions text[] not null default '{}'
              check (permissions <@ array['manage_server','manage_channels','pin_messages','kick','ban']::text[]),
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists server_roles_server on public.server_roles(server_id);

alter table public.server_members add column if not exists role_id uuid references public.server_roles(id) on delete set null;

-- moderadores que já existiam viram um cargo "Moderador" (mesmos poderes de antes: servidor, canais e fixar)
do $$
declare s record; rid uuid;
begin
  for s in select distinct server_id from public.server_members where role = 'mod' loop
    insert into public.server_roles (server_id, name, color, permissions)
    values (s.server_id, 'Moderador', '#2DBE7A', array['manage_server','manage_channels','pin_messages'])
    returning id into rid;
    update public.server_members set role_id = rid where server_id = s.server_id and role = 'mod';
  end loop;
end $$;

-- ---------- banidos ----------
create table if not exists public.server_bans (
  server_id    uuid not null references public.servers(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  username     text not null default '',
  display_name text not null default '',
  reason       text not null default '' check (char_length(reason) <= 200),
  banned_by    uuid references auth.users(id) on delete set null,
  banned_at    timestamptz not null default now(),
  primary key (server_id, user_id)
);

-- ---------- permissões ----------
create or replace function public.is_server_owner(s uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved() and exists (select 1 from public.servers where id = s and owner_id = auth.uid());
$$;

create or replace function public.has_perm(s uuid, perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved() and (
    exists (select 1 from public.servers where id = s and owner_id = auth.uid())
    or exists (
      select 1 from public.server_members m join public.server_roles r on r.id = m.role_id
       where m.server_id = s and m.user_id = auth.uid() and perm = any (r.permissions)
    )
  );
$$;

-- dono ou alguém com qualquer permissão (continua existindo para quem já usava)
create or replace function public.is_server_mod(s uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved() and (
    exists (select 1 from public.servers where id = s and owner_id = auth.uid())
    or exists (
      select 1 from public.server_members m join public.server_roles r on r.id = m.role_id
       where m.server_id = s and m.user_id = auth.uid() and cardinality(r.permissions) > 0
    )
  );
$$;

revoke execute on function public.is_server_owner(uuid), public.has_perm(uuid, text), public.is_server_mod(uuid) from public, anon;
grant  execute on function public.is_server_owner(uuid), public.has_perm(uuid, text), public.is_server_mod(uuid) to authenticated;

-- ---------- regras de acesso às tabelas ----------
alter table public.server_roles enable row level security;
create policy "ver cargos" on public.server_roles for select using (public.is_member(server_id));
create policy "dono cria cargo" on public.server_roles for insert with check (public.is_server_owner(server_id));
create policy "dono edita cargo" on public.server_roles for update using (public.is_server_owner(server_id)) with check (public.is_server_owner(server_id));
create policy "dono apaga cargo" on public.server_roles for delete using (public.is_server_owner(server_id));

alter table public.server_bans enable row level security;
create policy "ver banidos" on public.server_bans for select using (public.has_perm(server_id, 'ban'));
revoke insert, update, delete on public.server_bans from anon, authenticated;

-- servidor: quem pode "gerenciar servidor" edita nome, ícone, descrição e banner
drop policy if exists "dono e moderadores editam servidor" on public.servers;
create policy "editar servidor" on public.servers for update
  using (public.has_perm(id, 'manage_server')) with check (public.has_perm(id, 'manage_server'));

-- canais: quem pode "gerenciar canais"
drop policy if exists "dono e moderadores criam canal" on public.channels;
create policy "criar canal" on public.channels for insert
  with check (server_id is not null and public.has_perm(server_id, 'manage_channels'));
drop policy if exists "dono e moderadores editam canal" on public.channels;
create policy "editar canal" on public.channels for update
  using (server_id is not null and public.has_perm(server_id, 'manage_channels'))
  with check (server_id is not null and public.has_perm(server_id, 'manage_channels'));
drop policy if exists "dono e moderadores apagam canal" on public.channels;
create policy "apagar canal" on public.channels for delete
  using (server_id is not null and public.has_perm(server_id, 'manage_channels'));

-- fixar mensagens em canais de servidor: permissão "fixar mensagens"
create or replace function public.can_pin(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved() and exists (
    select 1 from public.channels ch
     where ch.id = c
       and ((ch.type = 'dm' and public.can_read_channel(c))
         or (ch.server_id is not null and public.has_perm(ch.server_id, 'pin_messages')))
  );
$$;

-- ---------- ações ----------
drop function if exists public.set_member_role(uuid, uuid, text);

-- dono escolhe o cargo de alguém (null = sem cargo)
create or replace function public.set_member_role(s uuid, target uuid, rid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_server_owner(s) then raise exception 'sem_permissao'; end if;
  if target = auth.uid() then raise exception 'cargo_invalido'; end if;
  if rid is not null and not exists (select 1 from public.server_roles where id = rid and server_id = s) then raise exception 'cargo_invalido'; end if;
  update public.server_members set role_id = rid where server_id = s and user_id = target;
end $$;

-- verifica se "eu" posso agir sobre "target": nunca no dono nem em mim; só o dono age sobre quem já tem poderes
create or replace function public.can_act_on(s uuid, target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target <> auth.uid()
    and not exists (select 1 from public.servers where id = s and owner_id = target)
    and (
      exists (select 1 from public.servers where id = s and owner_id = auth.uid())
      or not exists (
        select 1 from public.server_members m join public.server_roles r on r.id = m.role_id
         where m.server_id = s and m.user_id = target and cardinality(r.permissions) > 0
      )
    );
$$;

create or replace function public.kick_member(s uuid, target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_perm(s, 'kick') or not public.can_act_on(s, target) then raise exception 'sem_permissao'; end if;
  delete from public.server_members where server_id = s and user_id = target;
end $$;

create or replace function public.ban_member(s uuid, target uuid, why text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  if not public.has_perm(s, 'ban') or not public.can_act_on(s, target) then raise exception 'sem_permissao'; end if;
  select username, display_name into p from public.profiles where id = target;
  insert into public.server_bans (server_id, user_id, username, display_name, reason, banned_by)
  values (s, target, coalesce(p.username, ''), coalesce(p.display_name, ''), left(coalesce(why, ''), 200), auth.uid())
  on conflict (server_id, user_id) do update set reason = excluded.reason, banned_by = excluded.banned_by, banned_at = now();
  delete from public.server_members where server_id = s and user_id = target;
end $$;

create or replace function public.unban_member(s uuid, target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_perm(s, 'ban') then raise exception 'sem_permissao'; end if;
  delete from public.server_bans where server_id = s and user_id = target;
end $$;

-- só o dono apaga o servidor (canais e mensagens vão junto)
create or replace function public.delete_server(s uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_server_owner(s) then raise exception 'sem_permissao'; end if;
  delete from public.servers where id = s;
end $$;

-- convite não funciona para quem foi banido
create or replace function public.join_server(code text)
returns public.servers language plpgsql security definer set search_path = '' as $$
declare s public.servers;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if not public.is_approved() then raise exception 'conta_nao_aprovada'; end if;
  select * into s from public.servers where invite_code = code;
  if s.id is null then raise exception 'Convite inválido'; end if;
  if exists (select 1 from public.server_bans where server_id = s.id and user_id = auth.uid()) then raise exception 'banido'; end if;
  insert into public.server_members (server_id, user_id) values (s.id, auth.uid())
  on conflict do nothing;
  return s;
end $$;

revoke execute on function public.set_member_role(uuid, uuid, uuid), public.can_act_on(uuid, uuid), public.kick_member(uuid, uuid),
  public.ban_member(uuid, uuid, text), public.unban_member(uuid, uuid), public.delete_server(uuid) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, uuid), public.can_act_on(uuid, uuid), public.kick_member(uuid, uuid),
  public.ban_member(uuid, uuid, text), public.unban_member(uuid, uuid), public.delete_server(uuid) to authenticated;

-- ---------- tempo real ----------
do $$ begin alter publication supabase_realtime add table public.server_roles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.server_bans;  exception when duplicate_object then null; end $$;
alter table public.server_roles replica identity full;
alter table public.server_bans replica identity full;
