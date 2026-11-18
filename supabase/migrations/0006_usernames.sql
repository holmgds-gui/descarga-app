-- Descarga — nomes de usuário com maiúsculas, acentos e símbolos (sem espaços).
-- A unicidade ignora maiúsculas/minúsculas: "Gui" e "gui" são o mesmo nome. Busca e @menção também ignoram.

alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check
  check (username ~ '^[^[:space:][:cntrl:]@]{2,32}$');

create unique index if not exists profiles_username_lower on public.profiles (lower(username));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'usuario'),
    '[[:space:][:cntrl:]@]', '', 'g');
  if char_length(base) < 2 then base := 'usuario'; end if;
  base := left(base, 26);
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
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

create or replace function public.find_profile(uname text)
returns table (id uuid, username text, display_name text, avatar_url text, accent_color text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.accent_color
  from public.profiles p
  where lower(p.username) = lower(trim(uname)) and p.approval = 'approved' and public.is_approved();
$$;

create or replace function public.send_friend_request(uname text)
returns public.friendships language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  f public.friendships;
begin
  if me is null then raise exception 'login'; end if;
  if not public.is_approved() then raise exception 'conta_nao_aprovada'; end if;
  select id into other from public.profiles where lower(username) = lower(trim(uname)) and approval = 'approved';
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

-- menções: devolve os ids dos perfis cujo nome (sem diferenciar maiúsculas) está na lista
create or replace function public.profiles_by_names(names text[])
returns table (id uuid) language sql stable security definer set search_path = '' as $$
  select p.id from public.profiles p where lower(p.username) = any (select lower(n) from unnest(names) n);
$$;
revoke all on function public.profiles_by_names(text[]) from public, anon, authenticated;
grant execute on function public.profiles_by_names(text[]) to service_role;
