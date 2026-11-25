-- #0000: cada pessoa ganha um código de 4 números que acompanha o nick.
-- O nick pode repetir entre pessoas; o par nick + #código é o que identifica cada uma.

-- 1) coluna e geração automática do código (sem repetir dentro do mesmo nick)
alter table public.profiles add column if not exists tag text;

create or replace function public.trg_profile_tag()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tag is null then
    loop
      new.tag := lpad(floor(random() * 10000)::int::text, 4, '0');
      exit when not exists (
        select 1 from public.profiles p where lower(p.username) = lower(new.username) and p.tag = new.tag
      );
    end loop;
  end if;
  return new;
end $$;

-- 2) quem já existe ganha código aleatório
update public.profiles set tag = lpad(floor(random() * 10000)::int::text, 4, '0') where tag is null;

-- a conta principal fica com #0000 (confira o nick antes de rodar; troque se for outro)
update public.profiles set tag = '0000' where lower(username) = 'theguigs';

alter table public.profiles alter column tag set not null;

-- 3) o nick deixa de ser único: sai a restrição antiga e entra o par nick + código
alter table public.profiles drop constraint if exists profiles_username_key;
drop index if exists public.profiles_username_lower;
create index if not exists profiles_username_lower on public.profiles (lower(username));
create unique index if not exists profiles_nick_tag on public.profiles (lower(username), tag);

drop trigger if exists profile_tag on public.profiles;
create trigger profile_tag before insert on public.profiles
  for each row execute function public.trg_profile_tag();

-- 4) pedido de amizade aceita "nick" (só quando o nick é único) ou "nick#0000"
create or replace function public.send_friend_request(uname text)
returns public.friendships language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid;
  n int;
  f public.friendships;
  nick text := lower(trim(split_part(trim(uname), '#', 1)));
  code text := trim(split_part(trim(uname), '#', 2));
begin
  if me is null then raise exception 'login'; end if;
  if not public.is_approved() then raise exception 'conta_nao_aprovada'; end if;
  if position('#' in uname) > 0 then
    select p.id into other from public.profiles p
     where lower(p.username) = nick and p.tag = code and p.approval = 'approved';
  else
    select count(*), min(p.id) into n, other from public.profiles p
     where lower(p.username) = nick and p.approval = 'approved';
    if n > 1 then raise exception 'nick_repetido'; end if;
  end if;
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
