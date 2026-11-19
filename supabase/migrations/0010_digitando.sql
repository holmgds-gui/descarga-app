-- "fulano está digitando…": sala de tempo real por conversa/canal (só quem pode ler o canal entra)
create or replace function public.can_use_topic(t text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  rest text;
begin
  if t like 'voz:%' then
    rest := substr(t, 5);
    if rest !~ '^[0-9a-f-]{36}$' then return false; end if;
    return public.is_member(rest::uuid) or public.is_dm_member(rest::uuid);
  elsif t like 'call:%' then
    rest := substr(t, 6);
    if rest !~ '^[0-9a-f-]{36}$' then return false; end if;
    return exists (
      select 1 from public.channels c
      where c.id = rest::uuid
        and ((c.type = 'voice' and public.is_member(c.server_id)) or (c.type = 'dm' and public.is_dm_member(c.id)))
    );
  elsif t like 'digitando:%' then
    rest := substr(t, 11);
    if rest !~ '^[0-9a-f-]{36}$' then return false; end if;
    return public.can_read_channel(rest::uuid);
  end if;
  return false;
end $$;
