-- =========================================================
-- Descarga — endurecimento de segurança
-- • visitante (anon) sem acesso a nada nas tabelas e funções de public
-- • funções de gatilho não ficam expostas como RPC
-- • fotos/banners/ícones só podem apontar para o nosso armazenamento (ou foto do Google): sem rastreadores
-- • bucket "media" só aceita imagens
-- =========================================================

-- 1) visitante sem login não precisa de nada em public
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- 2) funções de gatilho não são para chamar de fora
revoke execute on function public.reports_limit() from public, anon, authenticated;
revoke execute on function public.trg_emoji_limite() from public, anon, authenticated;
revoke execute on function public.trg_profile_limites() from public, anon, authenticated;
revoke execute on function public.trg_profile_tag() from public, anon, authenticated;
revoke execute on function public.trg_servidor_limite() from public, anon, authenticated;
revoke execute on function public.plus_limit(text, integer) from public, anon;

-- 3) perfis nunca são criados pela API: só pelo gatilho do cadastro
revoke insert on public.profiles from authenticated;

-- 4) endereços de imagem só do nosso armazenamento (ou da foto do Google)
alter table public.profiles drop constraint if exists profiles_urls_seguras;
alter table public.profiles add constraint profiles_urls_seguras check (
  (avatar_url is null or avatar_url = '' or avatar_url ~ '^https://(ebumtgqfiygrfaafjctg\.supabase\.co/storage/v1/object/public/media/|lh3\.googleusercontent\.com/)[A-Za-z0-9_./%~+=?&:,@-]*$')
  and (banner_url is null or banner_url = '' or banner_url ~ '^https://ebumtgqfiygrfaafjctg\.supabase\.co/storage/v1/object/public/media/[A-Za-z0-9_./%~+=?&:,@-]*$')
) not valid;
alter table public.profiles validate constraint profiles_urls_seguras;

alter table public.servers drop constraint if exists servers_urls_seguras;
alter table public.servers add constraint servers_urls_seguras check (
  (icon_url is null or icon_url = '' or icon_url ~ '^https://ebumtgqfiygrfaafjctg\.supabase\.co/storage/v1/object/public/media/[A-Za-z0-9_./%~+=?&:,@-]*$')
  and (banner_url is null or banner_url = '' or banner_url ~ '^https://ebumtgqfiygrfaafjctg\.supabase\.co/storage/v1/object/public/media/[A-Za-z0-9_./%~+=?&:,@-]*$')
) not valid;
alter table public.servers validate constraint servers_urls_seguras;

alter table public.server_emojis drop constraint if exists server_emojis_url_segura;
alter table public.server_emojis add constraint server_emojis_url_segura check (
  url ~ '^https://ebumtgqfiygrfaafjctg\.supabase\.co/storage/v1/object/public/media/[A-Za-z0-9_./%~+=?&:,@-]*$'
) not valid;
alter table public.server_emojis validate constraint server_emojis_url_segura;

-- 5) o bucket público só aceita imagens
update storage.buckets
   set allowed_mime_types = array['image/webp', 'image/gif', 'image/png', 'image/jpeg', 'image/avif']
 where id = 'media';

-- 6) avisos push só para os serviços de push de verdade (Google, Mozilla, Microsoft, Apple)
alter table public.push_subscriptions drop constraint if exists push_endpoint_seguro;
alter table public.push_subscriptions add constraint push_endpoint_seguro check (
  endpoint ~ '^https://([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|windows\.com|apple\.com|push\.apple\.com)(:[0-9]+)?/'
) not valid;
alter table public.push_subscriptions validate constraint push_endpoint_seguro;
