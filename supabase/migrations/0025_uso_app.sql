-- =========================================================
-- Descarga — painel de uso (só o administrador vê)
-- • presenca_app: "visto por último" de cada pessoa (quem está com o app aberto)
-- • touch_seen(): cada pessoa avisa que está online (a cada ~5 min)
-- • admin_usage(): números para comparar com os limites do plano gratuito
-- =========================================================
create table if not exists public.presenca_app (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.presenca_app enable row level security;

create or replace function public.touch_seen()
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_approved() then return; end if;
  insert into public.presenca_app (user_id, seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set seen_at = excluded.seen_at;
end;
$$;
revoke execute on function public.touch_seen() from public, anon;
grant execute on function public.touch_seen() to authenticated;

create or replace function public.admin_usage()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_app_admin() then raise exception 'sem_permissao'; end if;
  select jsonb_build_object(
    'online_now',    (select count(*) from public.presenca_app where seen_at > now() - interval '6 minutes'),
    'online_hour',   (select count(*) from public.presenca_app where seen_at > now() - interval '1 hour'),
    'users_total',   (select count(*) from public.profiles where deleted_at is null),
    'users_approved',(select count(*) from public.profiles where deleted_at is null and approval = 'approved'),
    'db_bytes',      pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'storage_files', (select count(*) from storage.objects),
    'messages',      (select count(*) from public.messages)
  ) into r;
  return r;
end;
$$;
revoke execute on function public.admin_usage() from public, anon;
grant execute on function public.admin_usage() to authenticated;
