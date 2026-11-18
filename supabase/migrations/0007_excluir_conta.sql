-- Descarga — excluir conta.
-- A conta (login, e-mail), o perfil e os arquivos somem; o e-mail volta a ficar livre para um novo cadastro.
-- As mensagens ficam, assinadas por "Usuário excluído" (o perfil vira uma casca sem dados, sem login).
-- Bloquear continua sendo outra coisa: só o administrador desbloqueia.

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add column if not exists deleted_at timestamptz;

-- a casca de uma conta excluída aparece para todo mundo logado (para mostrar "Usuário excluído" nas mensagens)
drop policy if exists "ver perfis" on public.profiles;
create policy "ver perfis" on public.profiles for select
  using (id = auth.uid() or public.shares_server(id) or deleted_at is not null);

-- arquivos da pessoa (fotos/anexos), para a função de exclusão apagar do armazenamento
create or replace function public.account_files(target uuid)
returns table (bucket text, path text)
language sql stable security definer set search_path = '' as $$
  select o.bucket_id::text, o.name::text from storage.objects o
  where (o.bucket_id = 'media' and (storage.foldername(o.name))[1] = target::text)
     or (o.bucket_id = 'anexos' and (storage.foldername(o.name))[2] = target::text);
$$;

-- anonimiza o perfil e remove tudo que ligava a pessoa a servidores, amizades e conversas
create or replace function public.account_tombstone(target uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s record;
  heir uuid;
begin
  if exists (select 1 from public.profiles where id = target and is_admin) then
    raise exception 'nao_pode_excluir_admin';
  end if;
  -- servidores que a pessoa criou: passam para o membro mais antigo; sem ninguém, são apagados
  for s in select id from public.servers where owner_id = target loop
    select user_id into heir from public.server_members
     where server_id = s.id and user_id <> target order by joined_at nulls last limit 1;
    if heir is null then delete from public.servers where id = s.id;
    else update public.servers set owner_id = heir where id = s.id;
    end if;
  end loop;
  delete from public.server_members where user_id = target;
  delete from public.channel_members where user_id = target;
  delete from public.friendships where requester = target or addressee = target;
  delete from public.message_reactions where user_id = target;
  delete from public.push_subscriptions where user_id = target;
  -- anexos e mensagens de voz foram apagados do armazenamento: tira a referência
  update public.messages
     set attachments = '[]'::jsonb, content = case when content = '' then '(arquivo removido)' else content end
   where author_id = target and attachments <> '[]'::jsonb;
  update public.profiles set
    username = 'excluido-' || left(replace(target::text, '-', ''), 12),
    display_name = 'Usuário excluído', avatar_url = null, banner_url = null, bio = '', pronouns = '',
    city = '', birthday = null, links = '[]'::jsonb, custom_status = '', status = 'invisible',
    approval = 'blocked', is_admin = false, deleted_at = now()
   where id = target;
end $$;

revoke all on function public.account_files(uuid), public.account_tombstone(uuid) from public, anon, authenticated;
grant execute on function public.account_files(uuid), public.account_tombstone(uuid) to service_role;
