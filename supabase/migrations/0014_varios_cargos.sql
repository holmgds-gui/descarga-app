-- Vários cargos por pessoa + novas permissões (gerenciar cargos, mensagens e emojis).

-- 1) um cargo pode estar em várias pessoas e uma pessoa pode ter vários cargos
create table if not exists public.member_roles (
  server_id uuid not null,
  user_id   uuid not null,
  role_id   uuid not null references public.server_roles(id) on delete cascade,
  primary key (user_id, role_id),
  foreign key (server_id, user_id) references public.server_members(server_id, user_id) on delete cascade
);
create index if not exists member_roles_server on public.member_roles(server_id);
insert into public.member_roles (server_id, user_id, role_id)
  select server_id, user_id, role_id from public.server_members where role_id is not null
  on conflict do nothing;

alter table public.member_roles enable row level security;
create policy "ver cargos dos membros" on public.member_roles for select using (public.is_member(server_id));
revoke insert, update, delete on public.member_roles from anon, authenticated;

-- 2) todas as permissões de alguém (soma dos cargos dela)
create or replace function public.perms_of(s uuid, u uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct p), '{}'::text[])
    from public.member_roles mr
    join public.server_roles r on r.id = mr.role_id
    cross join lateral unnest(r.permissions) p
   where mr.server_id = s and mr.user_id = u;
$$;

create or replace function public.has_perm(s uuid, perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved() and (
    exists (select 1 from public.servers where id = s and owner_id = auth.uid())
    or perm = any (public.perms_of(s, auth.uid()))
  );
$$;

create or replace function public.is_server_mod(s uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved() and (
    exists (select 1 from public.servers where id = s and owner_id = auth.uid())
    or cardinality(public.perms_of(s, auth.uid())) > 0
  );
$$;

create or replace function public.can_act_on(s uuid, target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target <> auth.uid()
    and not exists (select 1 from public.servers where id = s and owner_id = target)
    and (
      exists (select 1 from public.servers where id = s and owner_id = auth.uid())
      or cardinality(public.perms_of(s, target)) = 0
    );
$$;

-- 3) quem tem "gerenciar cargos" cria/edita/apaga cargos, mas só com permissões que ele mesmo tem
drop policy if exists "dono cria cargo" on public.server_roles;
drop policy if exists "dono edita cargo" on public.server_roles;
drop policy if exists "dono apaga cargo" on public.server_roles;
create policy "criar cargo" on public.server_roles for insert with check (
  public.is_server_owner(server_id)
  or (public.has_perm(server_id, 'manage_roles') and permissions <@ public.perms_of(server_id, auth.uid())));
create policy "editar cargo" on public.server_roles for update
  using (public.is_server_owner(server_id)
    or (public.has_perm(server_id, 'manage_roles') and permissions <@ public.perms_of(server_id, auth.uid())))
  with check (public.is_server_owner(server_id)
    or (public.has_perm(server_id, 'manage_roles') and permissions <@ public.perms_of(server_id, auth.uid())));
create policy "apagar cargo" on public.server_roles for delete
  using (public.is_server_owner(server_id)
    or (public.has_perm(server_id, 'manage_roles') and permissions <@ public.perms_of(server_id, auth.uid())));

-- 4) dar / tirar um cargo de alguém (sem limite de cargos por pessoa)
drop function if exists public.set_member_role(uuid, uuid, uuid);
create or replace function public.toggle_member_role(s uuid, target uuid, rid uuid, on_ boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare rperms text[];
begin
  if not public.has_perm(s, 'manage_roles') then raise exception 'sem_permissao'; end if;
  if target = auth.uid() or exists (select 1 from public.servers where id = s and owner_id = target) then raise exception 'cargo_invalido'; end if;
  select permissions into rperms from public.server_roles where id = rid and server_id = s;
  if not found then raise exception 'cargo_invalido'; end if;
  if not exists (select 1 from public.server_members where server_id = s and user_id = target) then raise exception 'cargo_invalido'; end if;
  if not public.is_server_owner(s) then
    -- quem não é dono só mexe com poderes que ele mesmo tem
    if not (rperms <@ public.perms_of(s, auth.uid())) or not (public.perms_of(s, target) <@ public.perms_of(s, auth.uid())) then
      raise exception 'sem_permissao';
    end if;
  end if;
  if on_ then
    insert into public.member_roles (server_id, user_id, role_id) values (s, target, rid) on conflict do nothing;
  else
    delete from public.member_roles where server_id = s and user_id = target and role_id = rid;
  end if;
end $$;

revoke execute on function public.perms_of(uuid, uuid), public.toggle_member_role(uuid, uuid, uuid, boolean) from public, anon;
grant  execute on function public.perms_of(uuid, uuid), public.toggle_member_role(uuid, uuid, uuid, boolean) to authenticated;

-- 5) "gerenciar mensagens": apagar mensagens de outras pessoas nos canais do servidor
create policy "moderadores apagam mensagens" on public.messages for delete using (
  public.is_approved() and exists (
    select 1 from public.channels ch
     where ch.id = channel_id and ch.server_id is not null
       and public.has_perm(ch.server_id, 'manage_messages') and public.can_act_on(ch.server_id, author_id)));

-- 6) "gerenciar emojis": adicionar e apagar emojis do servidor
drop policy if exists "dono adiciona emoji" on public.server_emojis;
create policy "adicionar emoji" on public.server_emojis for insert
  with check (public.is_approved() and created_by = auth.uid() and public.has_perm(server_id, 'manage_emojis'));
drop policy if exists "dono apaga emoji" on public.server_emojis;
create policy "apagar emoji" on public.server_emojis for delete
  using (public.is_approved() and public.has_perm(server_id, 'manage_emojis'));

do $$ begin alter publication supabase_realtime add table public.member_roles; exception when duplicate_object then null; end $$;
alter table public.member_roles replica identity full;
