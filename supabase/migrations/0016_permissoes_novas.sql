-- O banco só aceitava as 5 permissões antigas; agora aceita também gerenciar cargos, mensagens e emojis.
alter table public.server_roles drop constraint if exists server_roles_permissions_check;
alter table public.server_roles add constraint server_roles_permissions_check
  check (permissions <@ array['manage_server','manage_channels','manage_roles','manage_messages','manage_emojis','pin_messages','kick','ban']::text[]);
