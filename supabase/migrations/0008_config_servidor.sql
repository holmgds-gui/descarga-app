-- Configurações do servidor: moderadores, descrição, banner e edição de canais.
-- Dono e moderadores editam o servidor e os canais; só o dono escolhe quem é moderador.

alter table public.server_members add column if not exists role text not null default 'member';
alter table public.server_members drop constraint if exists server_members_role_check;
alter table public.server_members add constraint server_members_role_check check (role in ('member', 'mod'));

alter table public.servers add column if not exists description text not null default '';
alter table public.servers drop constraint if exists servers_description_check;
alter table public.servers add constraint servers_description_check check (char_length(description) <= 300);
alter table public.servers add column if not exists banner_url text;

-- dono ou moderador (e conta aprovada)
create or replace function public.is_server_mod(s uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved() and (
    exists (select 1 from public.servers where id = s and owner_id = auth.uid())
    or exists (select 1 from public.server_members where server_id = s and user_id = auth.uid() and role = 'mod')
  );
$$;
revoke execute on function public.is_server_mod(uuid) from public, anon;
grant  execute on function public.is_server_mod(uuid) to authenticated;

-- só o dono muda o cargo de alguém
create or replace function public.set_member_role(s uuid, target uuid, new_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if new_role not in ('member', 'mod') then raise exception 'cargo_invalido'; end if;
  if not public.is_approved() or not exists (select 1 from public.servers where id = s and owner_id = auth.uid()) then
    raise exception 'sem_permissao';
  end if;
  if target = auth.uid() then raise exception 'cargo_invalido'; end if;
  update public.server_members set role = new_role where server_id = s and user_id = target;
end $$;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
grant  execute on function public.set_member_role(uuid, uuid, text) to authenticated;

-- servidor: dono e moderadores editam (nome, ícone, descrição, banner); apagar continua só com o dono
drop policy if exists "dono edita servidor" on public.servers;
create policy "dono e moderadores editam servidor" on public.servers for update
  using (public.is_server_mod(id)) with check (public.is_server_mod(id));
revoke update on public.servers from anon, authenticated;
grant update (name, icon_url, description, banner_url) on public.servers to authenticated;

-- canais do servidor: dono e moderadores criam, renomeiam, reorganizam e apagam
drop policy if exists "dono cria canal" on public.channels;
create policy "dono e moderadores criam canal" on public.channels for insert
  with check (server_id is not null and public.is_server_mod(server_id));
drop policy if exists "dono edita canal" on public.channels;
create policy "dono e moderadores editam canal" on public.channels for update
  using (server_id is not null and public.is_server_mod(server_id))
  with check (server_id is not null and public.is_server_mod(server_id));
drop policy if exists "dono apaga canal" on public.channels;
create policy "dono e moderadores apagam canal" on public.channels for delete
  using (server_id is not null and public.is_server_mod(server_id));

-- tempo real: mudanças no servidor (nome, ícone…) chegam para todos os membros
do $$ begin
  alter publication supabase_realtime add table public.servers;
exception when duplicate_object then null;
end $$;
