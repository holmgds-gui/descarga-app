-- =========================================================
-- Descarga — base do "Nitro" (visual extra do perfil)
-- • plan / plan_until: quem tem Nitro (só o administrador muda; sem pagamento por enquanto)
-- • name_color, avatar_frame, profile_skin: como os outros veem a pessoa, fora dos servidores
-- • set_cosmetics(): a pessoa escolhe o visual; só vale com Nitro ativo (limpar é sempre permitido)
-- • admin_set_plan(): o administrador liga/desliga o Nitro de uma conta
-- =========================================================
alter table public.profiles add column if not exists plan text not null default 'free' check (plan in ('free', 'nitro'));
alter table public.profiles add column if not exists plan_until timestamptz;
alter table public.profiles add column if not exists name_color text check (name_color is null or name_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.profiles add column if not exists avatar_frame text check (avatar_frame is null or avatar_frame ~ '^[a-z0-9_-]{1,32}$');
alter table public.profiles add column if not exists profile_skin text check (profile_skin is null or profile_skin ~ '^[a-z0-9_-]{1,32}$');

create or replace function public.has_nitro(u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select plan = 'nitro' and (plan_until is null or plan_until > now()) from public.profiles where id = u), false);
$$;
revoke execute on function public.has_nitro(uuid) from public, anon;
grant execute on function public.has_nitro(uuid) to authenticated;

create or replace function public.set_cosmetics(p_name_color text, p_avatar_frame text, p_profile_skin text)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare r public.profiles;
begin
  if auth.uid() is null or not public.is_approved() then raise exception 'conta_nao_aprovada'; end if;
  if (p_name_color is not null or p_avatar_frame is not null or p_profile_skin is not null) and not public.has_nitro(auth.uid()) then
    raise exception 'precisa_nitro';
  end if;
  update public.profiles
     set name_color = nullif(p_name_color, ''), avatar_frame = nullif(p_avatar_frame, ''), profile_skin = nullif(p_profile_skin, '')
   where id = auth.uid()
   returning * into r;
  return r;
end $$;
revoke execute on function public.set_cosmetics(text, text, text) from public, anon;
grant execute on function public.set_cosmetics(text, text, text) to authenticated;

create or replace function public.admin_set_plan(target uuid, new_plan text, until timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then raise exception 'sem_permissao'; end if;
  if new_plan not in ('free', 'nitro') then raise exception 'plano_invalido'; end if;
  update public.profiles
     set plan = new_plan,
         plan_until = case when new_plan = 'nitro' then until else null end,
         -- tirou o Nitro: o visual extra volta ao normal
         name_color = case when new_plan = 'free' then null else name_color end,
         avatar_frame = case when new_plan = 'free' then null else avatar_frame end,
         profile_skin = case when new_plan = 'free' then null else profile_skin end
   where id = target;
  if not found then raise exception 'nao_encontrado'; end if;
end $$;
revoke execute on function public.admin_set_plan(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_set_plan(uuid, text, timestamptz) to authenticated;

-- lista de contas do administrador passa a mostrar o plano
drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table (
  id uuid, email text, username text, display_name text, avatar_url text,
  approval text, is_admin boolean, created_at timestamptz, last_sign_in_at timestamptz,
  plan text, plan_until timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then raise exception 'sem_permissao'; end if;
  return query
    select p.id, u.email::text, p.username, p.display_name, p.avatar_url,
           p.approval, p.is_admin, p.created_at, u.last_sign_in_at, p.plan, p.plan_until
    from public.profiles p join auth.users u on u.id = p.id
    order by case p.approval when 'pending' then 0 when 'approved' then 1 else 2 end, p.created_at desc;
end $$;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
