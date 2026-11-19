-- Nota e apelido que cada pessoa dá a outra (só quem escreveu enxerga).
create table if not exists public.user_notes (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 256),
  nickname text not null default '' check (char_length(nickname) <= 32),
  updated_at timestamptz not null default now(),
  primary key (owner_id, target_id)
);
alter table public.user_notes enable row level security;
create policy "ver minhas notas" on public.user_notes for select to authenticated using (owner_id = auth.uid() and public.is_approved());
create policy "criar minhas notas" on public.user_notes for insert to authenticated with check (owner_id = auth.uid() and public.is_approved());
create policy "editar minhas notas" on public.user_notes for update to authenticated using (owner_id = auth.uid() and public.is_approved()) with check (owner_id = auth.uid() and public.is_approved());
create policy "apagar minhas notas" on public.user_notes for delete to authenticated using (owner_id = auth.uid() and public.is_approved());
