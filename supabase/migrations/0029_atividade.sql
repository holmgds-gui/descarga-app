-- =========================================================
-- Descarga — atividade ("Jogando X"), detectada pelo app de PC
-- • activity / activity_at: o que a pessoa está fazendo agora (vale só enquanto activity_at é recente)
-- • set_activity(): a própria pessoa publica ('' = nada)
-- • perfil privado: quem não é amigo não vê a atividade
-- =========================================================
alter table public.profiles add column if not exists activity text not null default '' check (char_length(activity) <= 80);
alter table public.profiles add column if not exists activity_at timestamptz;

create or replace function public.set_activity(p_activity text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_approved() then return; end if;
  update public.profiles
     set activity = left(coalesce(trim(p_activity), ''), 80),
         activity_at = case when coalesce(trim(p_activity), '') = '' then null else now() end
   where id = auth.uid();
end $$;
revoke execute on function public.set_activity(text) from public, anon;
grant execute on function public.set_activity(text) to authenticated;

create or replace function public.get_profiles(ids uuid[])
returns setof public.profiles language plpgsql stable set search_path = '' as $$
declare r public.profiles%rowtype;
begin
  for r in select * from public.profiles where id = any(ids) loop
    if r.profile_private and r.id <> auth.uid() and not public.is_app_admin() and not public.are_friends(r.id) then
      r.banner_url := null; r.bio := ''; r.pronouns := ''; r.birthday := null; r.city := '';
      r.links := '[]'::jsonb; r.custom_status := ''; r.activity := ''; r.activity_at := null;
    end if;
    return next r;
  end loop;
end $$;
revoke execute on function public.get_profiles(uuid[]) from public, anon;
grant execute on function public.get_profiles(uuid[]) to authenticated;
