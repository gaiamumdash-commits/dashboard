-- Corrige race condition real em garantirWorkspace() (achado de sessão,
-- 2026-09-12): 2 requisições quase simultâneas do mesmo usuário sem
-- membership ainda (ex.: navegação + prefetch do Next, ou o middleware
-- rodando 2x na mesma navegação) podiam ambas ver "sem workspace" e criar 2
-- tenants + memberships distintos pro mesmo usuário — a constraint
-- unique(user_id, tenant_id) de memberships não protege esse caso porque
-- cada corrida gera um tenant_id novo, então nunca colide.
--
-- Serializa com um advisory lock transacional por usuário (auto-libera no
-- fim da transação, não precisa de unlock explícito): a 2ª chamada
-- concorrente espera a 1ª terminar e, ao reconsultar, já encontra a
-- membership recém-criada — nunca cria um 2º tenant.
--
-- auth.uid() é lido de dentro da função (nunca recebido como parâmetro) de
-- propósito: só afeta o próprio workspace de quem chama, então não precisa
-- do mesmo revoke de anon/authenticated já usado em reivindicar_alarme()
-- (migration 0029), que sim recebia um id de recurso alheio sem dono.
create or replace function garantir_workspace_pessoal(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text)::bigint);

  select tenant_id into v_tenant_id
  from memberships
  where user_id = v_user_id
  order by criado_em asc
  limit 1;

  if v_tenant_id is not null then
    return v_tenant_id;
  end if;

  insert into tenants (nome) values (p_nome) returning id into v_tenant_id;
  insert into memberships (user_id, tenant_id, papel) values (v_user_id, v_tenant_id, 'owner');

  return v_tenant_id;
end;
$$;
