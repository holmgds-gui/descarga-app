-- =========================================================
-- Descarga — Descobrir servidores
-- • o dono liga "aparecer em Descobrir" (padrão: desligado)
-- • discover_servers(): lista os servidores abertos onde a pessoa ainda não está
-- • join_discoverable(id): entra num deles (respeita banimento e aprovação da conta)
-- =========================================================
alter table public.servers add column if not exists discoverable boolean not null default false;
grant update (discoverable) on public.servers to authenticated;

create or replace function public.discover_servers()
returns table (id uuid, name text, icon_url text, banner_url text, description text, members bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_approved() then raise exception 'conta_nao_aprovada'; end if;
  return query
    select s.id, s.name, s.icon_url, s.banner_url, s.description,
           (select count(*) from public.server_members m where m.server_id = s.id) as members
      from public.servers s
     where s.discoverable
       and not exists (select 1 from public.server_members m where m.server_id = s.id and m.user_id = auth.uid())
       and not exists (select 1 from public.server_bans b where b.server_id = s.id and b.user_id = auth.uid())
     order by members desc, s.created_at
     limit 60;
end $$;

create or replace function public.join_discoverable(sid uuid)
returns public.servers language plpgsql security definer set search_path = '' as $$
declare s public.servers;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if not public.is_approved() then raise exception 'conta_nao_aprovada'; end if;
  select * into s from public.servers where id = sid and discoverable;
  if s.id is null then raise exception 'indisponivel'; end if;
  if exists (select 1 from public.server_bans where server_id = s.id and user_id = auth.uid()) then raise exception 'banido'; end if;
  insert into public.server_members (server_id, user_id) values (s.id, auth.uid()) on conflict do nothing;
  return s;
end $$;

revoke execute on function public.discover_servers(), public.join_discoverable(uuid) from public, anon;
grant execute on function public.discover_servers(), public.join_discoverable(uuid) to authenticated;
