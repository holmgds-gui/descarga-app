-- Recado fixado do administrador, mostrado no Início para todas as contas aprovadas.
create table if not exists public.app_notice (
  id int primary key default 1 check (id = 1),
  body text not null default '' check (char_length(body) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.app_notice enable row level security;
create policy "contas aprovadas veem o recado" on public.app_notice for select to authenticated using (public.is_approved());
create policy "administrador cria o recado" on public.app_notice for insert to authenticated with check (public.is_app_admin());
create policy "administrador edita o recado" on public.app_notice for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "administrador apaga o recado" on public.app_notice for delete to authenticated using (public.is_app_admin());
