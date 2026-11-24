-- Ordem dos servidores na barra lateral (cada pessoa organiza a sua, arrastando).
alter table public.server_prefs add column if not exists position int;
