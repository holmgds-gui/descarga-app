-- Termos de Uso: guarda qual versão cada pessoa aceitou e quando.
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

create or replace function public.accept_terms(v text)
returns void language sql security definer set search_path = '' as $$
  update public.profiles set terms_version = v, terms_accepted_at = now()
   where id = auth.uid() and char_length(v) between 1 and 40;
$$;
revoke execute on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
