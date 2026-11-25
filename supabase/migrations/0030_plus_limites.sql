-- =========================================================
-- Descarga — o que cada nível do Plus libera (quanto maior o nível, mais permissões)
--                          sem Plus | Plus | Super Plus | Ultra Mega Plus
--   banner com imagem          não     sim      sim          sim
--   foto/banner animados (GIF) não     não      sim          sim      (regra do app)
--   bio (caracteres)           300     500      800          1200
--   links no perfil            5       8        12           20
--   emojis por servidor        50      100      150          250      (vale o nível do dono do servidor)
--   servidores que cria        5       8        12           25
-- O administrador conta como nível 3 em tudo.
-- =========================================================
create or replace function public.plus_level_of(u uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select case when is_admin then 3
                               when plus_level > 0 and (plus_until is null or plus_until > now()) then plus_level
                               else 0 end
                     from public.profiles where id = u), 0);
$$;

create or replace function public.plus_limit(kind text, lvl int)
returns int language sql immutable set search_path = '' as $$
  select case kind
    when 'bio'     then (array[300, 500, 800, 1200])[lvl + 1]
    when 'links'   then (array[5, 8, 12, 20])[lvl + 1]
    when 'emojis'  then (array[50, 100, 150, 250])[lvl + 1]
    when 'servers' then (array[5, 8, 12, 25])[lvl + 1]
  end;
$$;

alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check check (char_length(bio) <= 1200);

create or replace function public.trg_profile_limites()
returns trigger language plpgsql security definer set search_path = '' as $$
declare lvl int;
begin
  if auth.uid() is null or auth.uid() <> new.id then return new; end if;  -- só vale para a própria pessoa editando
  lvl := public.plus_level_of(new.id);
  if new.banner_url is not null and new.banner_url is distinct from old.banner_url and lvl < 1 then
    raise exception 'precisa_plus_banner';
  end if;
  if new.bio is distinct from old.bio and char_length(new.bio) > public.plus_limit('bio', lvl) then
    raise exception 'bio_longa';
  end if;
  if new.links is distinct from old.links and jsonb_array_length(new.links) > public.plus_limit('links', lvl) then
    raise exception 'muitos_links';
  end if;
  return new;
end $$;
drop trigger if exists profile_limites on public.profiles;
create trigger profile_limites before update on public.profiles for each row execute function public.trg_profile_limites();

create or replace function public.trg_emoji_limite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare lvl int; dono uuid;
begin
  select owner_id into dono from public.servers where id = new.server_id;
  lvl := public.plus_level_of(dono);
  if (select count(*) from public.server_emojis where server_id = new.server_id) >= public.plus_limit('emojis', lvl) then
    raise exception 'limite_emojis';
  end if;
  return new;
end $$;
drop trigger if exists emoji_limite on public.server_emojis;
create trigger emoji_limite before insert on public.server_emojis for each row execute function public.trg_emoji_limite();

create or replace function public.trg_servidor_limite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.servers where owner_id = new.owner_id) >= public.plus_limit('servers', public.plus_level_of(new.owner_id)) then
    raise exception 'limite_servidores';
  end if;
  return new;
end $$;
drop trigger if exists servidor_limite on public.servers;
create trigger servidor_limite before insert on public.servers for each row execute function public.trg_servidor_limite();
