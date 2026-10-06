-- Gaiamum — correções da auditoria de segurança (2026-10-06).
--
-- 1. ALTO — Storage do bucket `anexos`: as policies (migration 0008) só
--    checavam "o 1º pedaço do caminho é um workspace do usuário". Qualquer
--    membro do workspace — inclusive convidado de UM projeto — conseguia
--    listar, baixar e APAGAR comprovantes do financeiro (owner-only na
--    tabela `anexos`) e anexos de cartões de projetos em que não está.
--    Comprovado no Postgres de teste antes da correção. Agora o arquivo
--    segue a MESMA regra da tabela `anexos`:
--      {tenant}/conta_a_pagar/{conta}/arquivo → só o dono do workspace;
--      {tenant}/tarefa/{tarefa}/arquivo      → só quem acessa o projeto do cartão.
--    Formato do caminho: `src/lib/ecc/anexos.ts` (enviarAnexo*).
--
-- 2. MÉDIO — `garantir_workspace_pessoal` (migration 0040) podia ser chamada
--    direto pela API por QUALQUER conta logada, criando workspace mesmo com
--    o cadastro fechado (a trava `MODO_CADASTRO_FECHADO` só existe no Next).
--    Agora: a versão chamável pelo usuário deixa de ser executável, e o Next
--    usa `garantir_workspace_pessoal_para(user_id, nome)`, executável só pelo
--    service role, DEPOIS de checar convite/allowlist no servidor.

-- --------------------------------------------------------------------------
-- 1. Storage
-- --------------------------------------------------------------------------

-- SECURITY INVOKER de propósito: a consulta a `tarefas` passa pela RLS do
-- próprio usuário (se ele não enxerga o cartão, não enxerga o arquivo).
create or replace function anexo_storage_permitido(p_nome text)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_partes text[] := storage.foldername(p_nome);
  v_tenant uuid;
  v_entidade uuid;
begin
  if array_length(v_partes, 1) is distinct from 3 then
    return false;
  end if;
  if v_partes[1] !~* '^[0-9a-f-]{36}$' or v_partes[3] !~* '^[0-9a-f-]{36}$' then
    return false;
  end if;
  v_tenant := v_partes[1]::uuid;
  v_entidade := v_partes[3]::uuid;

  if v_tenant not in (select current_tenant_ids()) then
    return false;
  end if;

  if v_partes[2] = 'conta_a_pagar' then
    return current_papel(v_tenant) = 'owner';
  end if;

  if v_partes[2] = 'tarefa' then
    return exists (
      select 1 from tarefas t
      where t.id = v_entidade and t.tenant_id = v_tenant and tem_acesso_ao_projeto(t.projeto_id, t.tenant_id)
    );
  end if;

  return false;
end;
$$;

revoke execute on function anexo_storage_permitido(text) from public;
revoke execute on function anexo_storage_permitido(text) from anon;
grant execute on function anexo_storage_permitido(text) to authenticated;

drop policy if exists "anexos bucket: select por membro do tenant no path" on storage.objects;
drop policy if exists "anexos bucket: insert por membro do tenant no path" on storage.objects;
drop policy if exists "anexos bucket: delete por membro do tenant no path" on storage.objects;

create policy "anexos bucket: select com a regra da tabela anexos"
  on storage.objects for select
  using (bucket_id = 'anexos' and anexo_storage_permitido(name));

create policy "anexos bucket: insert com a regra da tabela anexos"
  on storage.objects for insert
  with check (bucket_id = 'anexos' and anexo_storage_permitido(name));

create policy "anexos bucket: delete com a regra da tabela anexos"
  on storage.objects for delete
  using (bucket_id = 'anexos' and anexo_storage_permitido(name));

-- --------------------------------------------------------------------------
-- 2. Criação de workspace pessoal só pelo servidor
-- --------------------------------------------------------------------------

create or replace function garantir_workspace_pessoal_para(p_user_id uuid, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  if p_user_id is null then
    raise exception 'Usuário não informado.';
  end if;

  -- Mesmo lock por usuário da versão antiga (migration 0040): 2 requisições
  -- simultâneas nunca criam 2 workspaces.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);

  select tenant_id into v_tenant_id
  from memberships
  where user_id = p_user_id
  order by criado_em asc
  limit 1;

  if v_tenant_id is not null then
    return v_tenant_id;
  end if;

  insert into tenants (nome) values (p_nome) returning id into v_tenant_id;
  insert into memberships (user_id, tenant_id, papel) values (p_user_id, v_tenant_id, 'owner');

  return v_tenant_id;
end;
$$;

revoke execute on function garantir_workspace_pessoal_para(uuid, text) from public;
revoke execute on function garantir_workspace_pessoal_para(uuid, text) from anon;
revoke execute on function garantir_workspace_pessoal_para(uuid, text) from authenticated;
grant execute on function garantir_workspace_pessoal_para(uuid, text) to service_role;

-- A versão antiga continua existindo (rollback simples), mas ninguém de fora
-- consegue mais chamá-la.
revoke execute on function garantir_workspace_pessoal(text) from public;
revoke execute on function garantir_workspace_pessoal(text) from anon;
revoke execute on function garantir_workspace_pessoal(text) from authenticated;

-- Rollback:
--   grant execute on function garantir_workspace_pessoal(text) to authenticated;
--   (e reaplicar as 3 policies de storage da migration 0008)
