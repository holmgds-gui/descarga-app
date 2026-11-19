-- Denúncias de pessoas (botão direito → Denunciar…). Só o administrador lê e resolve;
-- quem denuncia não vê a lista, e a pessoa denunciada nunca fica sabendo.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('harassment','hate','illegal','copyright','spam','other')),
  details text not null check (char_length(btrim(details)) between 10 and 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (reporter_id <> reported_id)
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;

create or replace function public.reports_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports where reporter_id = new.reporter_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Limite de denúncias atingido por hoje.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists reports_limit_trg on public.reports;
create trigger reports_limit_trg before insert on public.reports for each row execute function public.reports_limit();

create policy "contas aprovadas denunciam" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_approved());
create policy "administrador le denuncias" on public.reports for select to authenticated using (public.is_app_admin());
create policy "administrador resolve denuncias" on public.reports for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
create policy "administrador apaga denuncias" on public.reports for delete to authenticated using (public.is_app_admin());
