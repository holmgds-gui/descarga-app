-- =========================================================
-- Descarga — "Plus" em 3 níveis (troca o "Nitro" da migração 0027)
--   nível 1 = Plus · nível 2 = Super Plus · nível 3 = Ultra Mega Plus
-- • plus_level / plus_until: só o administrador muda (sem pagamento por enquanto)
-- • nível 1: cor do nome · nível 2: + moldura da foto e skin do perfil · nível 3: tudo (itens exclusivos no app)
-- =========================================================
alter table public.profiles drop column if exists plan_until;
alter table public.profiles drop column if exists plan;
alter table public.profiles add column if not exists plus_level smallint not null default 0 check (plus_level between 0 and 3);
alter table public.profiles add column if not exists plus_until timestamptz;

drop function if exists public.has_nitro(uuid);
drop function if exists public.admin_set_plan(uuid, text, timestamptz);
drop function if exists public.set_cosmetics(text, text, text);
drop function if exists public.admin_list_users();

-- nível que vale agora (0 se não tem ou se já venceu)
create or replace function public.plus_level_of(u uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select case when plus_level > 0 and (plus_until is null or plus_until > now()) then plus_level else 0 end
                     from public.profiles where id = u), 0);
$$;
revoke execute on function public.plus_level_of(uuid) from public, anon;
grant execute on function public.plus_level_of(uuid) to authenticated;

create or replace function public.set_cosmetics(p_name_color text, p_avatar_frame text, p_profile_skin text)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare r public.profiles; lvl int;
begin
  if auth.uid() is null or not public.is_approved() then raise exception 'conta_nao_aprovada'; end if;
  lvl := public.plus_level_of(auth.uid());
  if nullif(p_name_color, '') is not null and lvl < 1 then raise exception 'precisa_plus'; end if;
  if (nullif(p_avatar_frame, '') is not null or nullif(p_profile_skin, '') is not null) and lvl < 2 then raise exception 'precisa_super_plus'; end if;
  update public.profiles
     set name_color = nullif(p_name_color, ''), avatar_frame = nullif(p_avatar_frame, ''), profile_skin = nullif(p_profile_skin, '')
   where id = auth.uid()
   returning * into r;
  return r;
end $$;
revoke execute on function public.set_cosmetics(text, text, text) from public, anon;
grant execute on function public.set_cosmetics(text, text, text) to authenticated;

create or replace function public.admin_set_plus(target uuid, new_level int, until timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then raise exception 'sem_permissao'; end if;
  if new_level not between 0 and 3 then raise exception 'nivel_invalido'; end if;
  update public.profiles
     set plus_level = new_level,
         plus_until = case when new_level > 0 then until else null end,
         -- perdeu nível: o visual que não cabe mais volta ao normal
         name_color = case when new_level < 1 then null else name_color end,
         avatar_frame = case when new_level < 2 then null else avatar_frame end,
         profile_skin = case when new_level < 2 then null else profile_skin end
   where id = target;
  if not found then raise exception 'nao_encontrado'; end if;
end $$;
revoke execute on function public.admin_set_plus(uuid, int, timestamptz) from public, anon;
grant execute on function public.admin_set_plus(uuid, int, timestamptz) to authenticated;

create or replace function public.admin_list_users()
returns table (
  id uuid, email text, username text, display_name text, avatar_url text,
  approval text, is_admin boolean, created_at timestamptz, last_sign_in_at timestamptz,
  plus_level smallint, plus_until timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then raise exception 'sem_permissao'; end if;
  return query
    select p.id, u.email::text, p.username, p.display_name, p.avatar_url,
           p.approval, p.is_admin, p.created_at, u.last_sign_in_at, p.plus_level, p.plus_until
    from public.profiles p join auth.users u on u.id = p.id
    order by case p.approval when 'pending' then 0 when 'approved' then 1 else 2 end, p.created_at desc;
end $$;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
