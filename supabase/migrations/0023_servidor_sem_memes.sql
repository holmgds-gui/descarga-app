-- Servidores novos nascem só com #geral e a sala de voz Geral (sem #memes). O dono pode renomear/apagar qualquer canal.
create or replace function public.handle_new_server()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.server_members (server_id, user_id) values (new.id, new.owner_id);
  insert into public.channels (server_id, name, type, category, position) values
    (new.id, 'geral',  'text',  'Canais de texto', 0),
    (new.id, 'Geral',  'voice', 'Canais de voz',   0);
  return new;
end $$;
