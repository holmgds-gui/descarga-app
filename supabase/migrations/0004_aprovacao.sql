-- =========================================================
-- Descarga — aprovação de contas e administrador
-- • Todo cadastro novo nasce "pendente" e só usa o app depois que o administrador aprova.
-- • Só existe UM administrador (a conta holmgds@gmail.com). Ninguém vira admin se cadastrando.
-- • A trava vale no banco (RLS): mesmo mexendo no app, quem não está aprovado não lê nem escreve nada.
-- =========================================================

-- contas que já existem continuam funcionando (entram como "aprovadas"); as novas nascem "pendentes"
alter table public.profiles add column if not exists approval text not null default 'approved'
  check (approval in ('pending', 'approved', 'blocked'));
alter table public.profiles alter column approval set default 'pending';
alter table public.profiles add column if not exists is_admin boolean not null default false;
-- controle para avisar o administrador só uma vez por cadastro
alter table public.profiles add column if not exists admin_notified boolean not null default false;

-- a conta do administrador é marcada pelo id (não por um gatilho de e-mail, para ninguém "roubar" o cargo)
update public.profiles set is_admin = true, approval = 'approved'
 where id = (select id from auth.users where lower(email) = 'holmgds@gmail.com');
-- garante que nunca exista mais de um administrador
create unique index if not exists profiles_um_admin on public.profiles (is_admin) where is_admin;

-- ---------- funções de apoio ----------
create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select approval = 'approved' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin and approval = 'approved' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.user_is_approved(u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select approval = 'approved' from public.profiles where id = u), false);
$$;

-- quem não está aprovado não é "membro" de nada, não tem amigos e não usa as calls
create or replace function public.is_member(s uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved()
     and exists (select 1 from public.server_members where server_id = s and user_id = auth.uid());
$$;

create or replace function public.shares_server(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved() and exists (
    select 1 from public.server_members a
    join public.server_members b on a.server_id = b.server_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

create or replace function public.is_dm_member(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved()
     and exists (select 1 from public.channel_members where channel_id = c and user_id = auth.uid());
$$;

create or replace function public.are_friends(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_approved() and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = auth.uid() and f.addressee = other) or (f.addressee = auth.uid() and f.requester = other))
  );
$$;

create or replace function public.can_see_profile(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select other = auth.uid()
    or public.is_app_admin()
    or (public.is_approved() and (
         public.shares_server(other)
      or exists (select 1 from public.friendships f
                 where (f.requester = auth.uid() and f.addressee = other) or (f.addressee = auth.uid() and f.requester = other))
      or exists (select 1 from public.channel_members a join public.channel_members b on a.channel_id = b.channel_id
                 where a.user_id = auth.uid() and b.user_id = other)
    ));
$$;

-- contas bloqueadas ou pendentes não aparecem nas listas de membros
drop policy if exists "ver membros" on public.server_members;
create policy "ver membros" on public.server_members for select
  using (public.is_member(server_id) and public.user_is_approved(user_id));
drop policy if exists "ver membros da conversa" on public.channel_members;
create policy "ver membros da conversa" on public.channel_members for select
  using (public.is_dm_member(channel_id) and public.user_is_approved(user_id));

-- ---------- ações que mexem em dados exigem conta aprovada ----------
create or replace function public.join_server(code text)
returns public.servers language plpgsql security definer set search_path = '' as $$
declare s public.servers;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if not public.is_approved() then raise exception 'conta_nao_aprovada'; end if;
  select * into s from public.servers where invite_code = code;
  if s.id is null then raise exception 'Convite inválido'; end if;
  insert into public.server_members (server_id, user_id) values (s.id, auth.uid())
  on conflict do nothing;
  return s;
end $$;

create or replace function public.find_profile(uname text)
returns table (id uuid, username text, display_name text, avatar_url text, accent_color text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.accent_color
  from public.profiles p
  where p.username = lower(trim(uname)) and p.approval = 'approved' and public.is_approved();
$$;

create or replace function public.send_friend_request(uname text)
returns public.friendships language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  f public.friendships;
begin
  if me is null then raise exception 'login'; end if;
  if not public.is_approved() then raise exception 'conta_nao_aprovada'; end if;
  select id into other from public.profiles where username = lower(trim(uname)) and approval = 'approved';
  if other is null then raise exception 'nao_encontrado'; end if;
  if other = me then raise exception 'voce_mesmo'; end if;
  select * into f from public.friendships
   where least(requester, addressee) = least(me, other) and greatest(requester, addressee) = greatest(me, other);
  if f.id is not null then
    if f.status = 'accepted' then raise exception 'ja_amigos'; end if;
    if f.addressee = me then
      update public.friendships set status = 'accepted' where id = f.id returning * into f;
      return f;
    end if;
    raise exception 'ja_enviado';
  end if;
  insert into public.friendships (requester, addressee) values (me, other) returning * into f;
  return f;
end $$;

-- criar/abrir DM: só com gente aprovada
create or replace function public.open_dm(user_ids uuid[], group_title text default null)
returns public.channels language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  others uuid[];
  ch public.channels;
  u uuid;
begin
  if me is null then raise exception 'login'; end if;
  if not public.is_approved() then raise exception 'conta_nao_aprovada'; end if;
  select array_agg(distinct x) into others from unnest(user_ids) x where x <> me;
  if others is null or array_length(others, 1) = 0 then raise exception 'sem_pessoas'; end if;
  if array_length(others, 1) > 9 then raise exception 'grupo_grande'; end if;
  foreach u in array others loop
    if not public.user_is_approved(u) or not (public.are_friends(u) or public.shares_server(u)) then
      raise exception 'sem_permissao';
    end if;
  end loop;

  if array_length(others, 1) = 1 and group_title is null then
    select c.* into ch from public.channels c
     where c.type = 'dm' and not c.is_group
       and exists (select 1 from public.channel_members m where m.channel_id = c.id and m.user_id = me)
       and exists (select 1 from public.channel_members m where m.channel_id = c.id and m.user_id = others[1])
     limit 1;
    if ch.id is not null then return ch; end if;
    insert into public.channels (server_id, name, type, category, is_group, owner_id)
      values (null, 'dm', 'dm', '', false, me) returning * into ch;
  else
    insert into public.channels (server_id, name, type, category, is_group, title, owner_id)
      values (null, 'grupo', 'dm', '', true, nullif(trim(group_title), ''), me) returning * into ch;
  end if;

  insert into public.channel_members (channel_id, user_id) values (ch.id, me);
  foreach u in array others loop
    insert into public.channel_members (channel_id, user_id) values (ch.id, u) on conflict do nothing;
  end loop;
  return ch;
end $$;

create or replace function public.add_to_group(c uuid, user_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  if not exists (select 1 from public.channels where id = c and type = 'dm' and is_group) then raise exception 'nao_grupo'; end if;
  if not public.is_dm_member(c) then raise exception 'sem_permissao'; end if;
  if (select count(*) from public.channel_members where channel_id = c) + coalesce(array_length(user_ids, 1), 0) > 10 then
    raise exception 'grupo_grande';
  end if;
  foreach u in array user_ids loop
    if not public.user_is_approved(u) or not (public.are_friends(u) or public.shares_server(u)) then
      raise exception 'sem_permissao';
    end if;
    insert into public.channel_members (channel_id, user_id) values (c, u) on conflict do nothing;
  end loop;
end $$;

-- políticas de escrita: só conta aprovada
drop policy if exists "criar servidor" on public.servers;
create policy "criar servidor" on public.servers for insert
  with check (owner_id = auth.uid() and public.is_approved());
drop policy if exists "dono edita servidor" on public.servers;
create policy "dono edita servidor" on public.servers for update
  using (owner_id = auth.uid() and public.is_approved());
drop policy if exists "dono apaga servidor" on public.servers;
create policy "dono apaga servidor" on public.servers for delete
  using (owner_id = auth.uid() and public.is_approved());

drop policy if exists "dono cria canal" on public.channels;
create policy "dono cria canal" on public.channels for insert
  with check (public.is_approved() and exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));
drop policy if exists "dono edita canal" on public.channels;
create policy "dono edita canal" on public.channels for update
  using (public.is_approved() and exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));
drop policy if exists "dono apaga canal" on public.channels;
create policy "dono apaga canal" on public.channels for delete
  using (public.is_approved() and exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));

drop policy if exists "editar a própria mensagem" on public.messages;
create policy "editar a própria mensagem" on public.messages for update
  using (author_id = auth.uid() and public.is_approved()) with check (author_id = auth.uid());
drop policy if exists "apagar a própria mensagem" on public.messages;
create policy "apagar a própria mensagem" on public.messages for delete
  using (author_id = auth.uid() and public.is_approved());

drop policy if exists "dono adiciona emoji" on public.server_emojis;
create policy "dono adiciona emoji" on public.server_emojis for insert
  with check (public.is_approved() and created_by = auth.uid()
    and exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));
drop policy if exists "dono apaga emoji" on public.server_emojis;
create policy "dono apaga emoji" on public.server_emojis for delete
  using (public.is_approved() and exists (select 1 from public.servers s where s.id = server_id and s.owner_id = auth.uid()));

-- fotos de perfil, banners e ícones (bucket público): só quem está aprovado envia
drop policy if exists "enviar na própria pasta" on storage.objects;
create policy "enviar na própria pasta" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text and public.is_approved());
drop policy if exists "trocar na própria pasta" on storage.objects;
create policy "trocar na própria pasta" on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text and public.is_approved());

-- ---------- ações do administrador ----------
create or replace function public.admin_list_users()
returns table (
  id uuid, email text, username text, display_name text, avatar_url text,
  approval text, is_admin boolean, created_at timestamptz, last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then raise exception 'sem_permissao'; end if;
  return query
    select p.id, u.email::text, p.username, p.display_name, p.avatar_url,
           p.approval, p.is_admin, p.created_at, u.last_sign_in_at
    from public.profiles p join auth.users u on u.id = p.id
    order by case p.approval when 'pending' then 0 when 'approved' then 1 else 2 end, p.created_at desc;
end $$;

create or replace function public.admin_set_approval(target uuid, new_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then raise exception 'sem_permissao'; end if;
  if new_status not in ('approved', 'blocked') then raise exception 'status_invalido'; end if;
  if exists (select 1 from public.profiles where id = target and is_admin) then raise exception 'nao_pode_admin'; end if;
  update public.profiles set approval = new_status where id = target;
  if not found then raise exception 'nao_encontrado'; end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.is_approved()', 'public.is_app_admin()', 'public.user_is_approved(uuid)',
    'public.admin_list_users()', 'public.admin_set_approval(uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- as colunas novas só mudam pelo administrador (a permissão de editar o perfil é por coluna e não as inclui)
-- o administrador recebe os cadastros novos em tempo real (profiles já está no realtime)
