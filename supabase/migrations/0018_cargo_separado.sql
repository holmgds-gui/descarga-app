-- Cargo pode aparecer como seção própria na lista de membros ("hoist"). Por padrão aparece.
alter table public.server_roles add column if not exists hoist boolean not null default true;
