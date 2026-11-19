-- Silenciar servidor e nível de notificação de cada pessoa (valem para os avisos push).
create table if not exists public.server_prefs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  server_id uuid not null references public.servers(id) on delete cascade,
  level text not null default 'all' check (level in ('all', 'mentions', 'none')),
  muted_until timestamptz,
  primary key (user_id, server_id)
);
alter table public.server_prefs enable row level security;
create policy "ver minhas prefs" on public.server_prefs for select to authenticated using (user_id = auth.uid());
create policy "criar minhas prefs" on public.server_prefs for insert to authenticated with check (user_id = auth.uid() and public.is_member(server_id));
create policy "editar minhas prefs" on public.server_prefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "apagar minhas prefs" on public.server_prefs for delete to authenticated using (user_id = auth.uid());
