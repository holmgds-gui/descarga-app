-- Novos limites do Plus (links 3/6/10/15 e servidores 5/12/24/40); bio e emojis continuam.
create or replace function public.plus_limit(kind text, lvl int)
returns int language sql immutable set search_path = '' as $$
  select case kind
    when 'bio'     then (array[300, 500, 800, 1200])[lvl + 1]
    when 'links'   then (array[3, 6, 10, 15])[lvl + 1]
    when 'emojis'  then (array[50, 100, 150, 250])[lvl + 1]
    when 'servers' then (array[5, 12, 24, 40])[lvl + 1]
  end;
$$;
