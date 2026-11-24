-- 1) Perfil privado: quem não é amigo vê só nome, foto, cor e status (sem bio, banner, pronomes, aniversário, cidade, links e status personalizado).
alter table public.profiles add column if not exists profile_private boolean not null default false;
grant update (profile_private) on public.profiles to authenticated;

-- leitura de perfis já com a máscara aplicada (respeita as regras de visibilidade de sempre: roda como quem chamou)
create or replace function public.get_profiles(ids uuid[])
returns setof public.profiles language plpgsql stable set search_path = '' as $$
declare r public.profiles%rowtype;
begin
  for r in select * from public.profiles where id = any(ids) loop
    if r.profile_private and r.id <> auth.uid() and not public.is_app_admin() and not public.are_friends(r.id) then
      r.banner_url := null; r.bio := ''; r.pronouns := ''; r.birthday := null; r.city := '';
      r.links := '[]'::jsonb; r.custom_status := '';
    end if;
    return next r;
  end loop;
end $$;
revoke execute on function public.get_profiles(uuid[]) from public, anon;
grant execute on function public.get_profiles(uuid[]) to authenticated;

-- 2) Todo mundo que for aprovado entra sozinho no servidor padrão (DESCARGA SERVER).
create table if not exists public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
insert into public.app_config (key, value) values ('default_server', '444e3f06-8422-4c6a-a319-ef54ac61964b') on conflict (key) do nothing;

create or replace function public.join_default_server(u uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  select value::uuid into sid from public.app_config where key = 'default_server';
  if sid is null or not exists (select 1 from public.servers where id = sid) then return; end if;
  if exists (select 1 from public.server_bans where server_id = sid and user_id = u) then return; end if;
  insert into public.server_members (server_id, user_id) values (sid, u) on conflict do nothing;
end $$;
revoke execute on function public.join_default_server(uuid) from public, anon, authenticated;

create or replace function public.trg_join_default_server()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.approval = 'approved' and new.deleted_at is null
     and (tg_op = 'INSERT' or old.approval is distinct from 'approved') then
    perform public.join_default_server(new.id);
  end if;
  return new;
end $$;
revoke execute on function public.trg_join_default_server() from public, anon, authenticated;

drop trigger if exists on_profile_join_default_server on public.profiles;
create trigger on_profile_join_default_server
  after insert or update of approval on public.profiles
  for each row execute function public.trg_join_default_server();

-- quem já está no app (aprovado) entra agora
select public.join_default_server(id) from public.profiles where approval = 'approved' and deleted_at is null;
