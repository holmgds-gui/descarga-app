-- O dono do servidor pode dar cargos a si mesmo (por exemplo, para ter a cor do nome).
-- Continua proibido: alguém sem ser dono mexer nos próprios cargos, ou qualquer pessoa mexer nos cargos do dono.
create or replace function public.toggle_member_role(s uuid, target uuid, rid uuid, on_ boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare rperms text[];
begin
  if not public.has_perm(s, 'manage_roles') then raise exception 'sem_permissao'; end if;
  if target = auth.uid() and not public.is_server_owner(s) then raise exception 'cargo_invalido'; end if;
  if target <> auth.uid() and exists (select 1 from public.servers where id = s and owner_id = target) then raise exception 'cargo_invalido'; end if;
  select permissions into rperms from public.server_roles where id = rid and server_id = s;
  if not found then raise exception 'cargo_invalido'; end if;
  if not exists (select 1 from public.server_members where server_id = s and user_id = target) then raise exception 'cargo_invalido'; end if;
  if not public.is_server_owner(s) then
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
