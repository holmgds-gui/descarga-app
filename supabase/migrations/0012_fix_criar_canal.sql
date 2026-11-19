-- Criar canal falhava com "new row violates row-level security policy for table channels":
-- o INSERT ... RETURNING precisa passar na regra de leitura, e can_read_channel(id) consulta
-- a própria tabela (não enxerga a linha recém-criada). A regra passa a olhar a linha direto.
drop policy if exists "ver canais" on public.channels;
create policy "ver canais" on public.channels for select to authenticated
  using (
    (server_id is not null and public.is_member(server_id))
    or (type = 'dm' and public.is_dm_member(id))
  );
