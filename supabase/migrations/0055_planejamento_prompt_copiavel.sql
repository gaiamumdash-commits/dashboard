-- Gaiamum — "Planejar com IA" por prompt copiável, Fase 1 (2026-10-05).
--
-- Pedido do Fabio (docs/gaiamum/FRENTES-RECEITAS-E-PROMPT-IA-2026-10-05.md):
-- a pessoa copia um prompt, conversa na IA que preferir e cola o resultado
-- de volta; tarefas e MARCOS marcados viram cartões na coluna "Tarefas". Vale
-- na criação do projeto e dentro de um projeto já existente.
--
-- Duas mudanças, as duas SECURITY INVOKER (nenhum bypass de RLS — mesmas
-- policies de tarefas/checklist que o usuário já teria fazendo direto):
--   1. criar_projeto_planejado_ia passa a aceitar `marco` (tarefas.is_marco,
--      migration 0026) por item e até 30 itens (marcos + tarefas). Corpo
--      baseado na versão VIGENTE (migration 0052, que marca a coluna de
--      foco) — não na 0051.
--   2. adicionar_tarefas_planejadas: mesma criação em lote e idempotente,
--      mas num projeto que já existe.

-- --------------------------------------------------------------------------
-- 1. Criação de projeto: + marco, até 30 itens
-- --------------------------------------------------------------------------
create or replace function criar_projeto_planejado_ia(
  p_tenant_id uuid,
  p_nome text,
  p_descricao text,
  p_idempotency_key text,
  p_tarefas jsonb
) returns uuid
language plpgsql
as $$
declare
  v_projeto_id uuid;
  v_coluna_tarefas_id uuid;
  v_tarefa jsonb;
  v_tarefa_id uuid;
  v_checklist_item text;
  v_ordem integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.' using errcode = 'P0001';
  end if;

  if p_nome is null or length(trim(p_nome)) = 0 then
    raise exception 'Informe o nome do projeto.' using errcode = 'P0001';
  end if;

  if current_papel(p_tenant_id) is distinct from 'owner' then
    raise exception 'Só o dono do workspace pode criar projetos novos.' using errcode = 'P0001';
  end if;

  if p_tarefas is not null and jsonb_typeof(p_tarefas) <> 'array' then
    raise exception 'Formato inválido de tarefas.' using errcode = 'P0001';
  end if;

  if p_tarefas is not null and jsonb_array_length(p_tarefas) > 30 then
    raise exception 'No máximo 30 itens por planejamento.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':' || auth.uid()::text || ':' || p_idempotency_key)::bigint);

  select projeto_id into v_projeto_id
  from projeto_criacao_idempotencia
  where tenant_id = p_tenant_id and user_id = auth.uid() and idempotency_key = p_idempotency_key;

  if v_projeto_id is not null then
    return v_projeto_id;
  end if;

  insert into projetos (tenant_id, nome, descricao)
  values (p_tenant_id, trim(p_nome), nullif(trim(coalesce(p_descricao, '')), ''))
  returning id into v_projeto_id;

  insert into projeto_membros (tenant_id, projeto_id, user_id, papel)
  values (p_tenant_id, v_projeto_id, auth.uid(), 'gestor');

  -- Igual à versão vigente (migration 0052): "Em Desenvolvimento" já nasce
  -- como a coluna de foco (`dispara_hiperfoco`).
  insert into colunas_kanban (tenant_id, projeto_id, nome, ordem, concluido, hoje, dispara_hiperfoco)
  values
    (p_tenant_id, v_projeto_id, 'Hoje', 0, false, true, false),
    (p_tenant_id, v_projeto_id, 'Tarefas', 1, false, false, false),
    (p_tenant_id, v_projeto_id, 'Em Desenvolvimento', 2, false, false, true),
    (p_tenant_id, v_projeto_id, 'Concluído', 0, true, false, false);

  select id into v_coluna_tarefas_id
  from colunas_kanban
  where projeto_id = v_projeto_id and nome = 'Tarefas' and not concluido;

  if p_tarefas is not null then
    for v_tarefa in select * from jsonb_array_elements(p_tarefas)
    loop
      if v_tarefa->>'titulo' is null or length(trim(v_tarefa->>'titulo')) = 0 then
        continue;
      end if;

      v_ordem := v_ordem + 1;

      insert into tarefas (tenant_id, projeto_id, coluna_id, titulo, descricao, prioridade, ordem, is_marco)
      values (
        p_tenant_id,
        v_projeto_id,
        v_coluna_tarefas_id,
        left(trim(v_tarefa->>'titulo'), 200),
        nullif(left(trim(coalesce(v_tarefa->>'descricao', '')), 1000), ''),
        'P3',
        v_ordem * 1000,
        coalesce((v_tarefa->>'marco')::boolean, false)
      )
      returning id into v_tarefa_id;

      if jsonb_typeof(v_tarefa->'checklist') = 'array' then
        for v_checklist_item in
          select t.item from jsonb_array_elements_text(v_tarefa->'checklist') as t(item) limit 15
        loop
          if length(trim(v_checklist_item)) > 0 then
            insert into tarefa_checklist_itens (tenant_id, tarefa_id, texto, ordem)
            values (
              p_tenant_id,
              v_tarefa_id,
              left(trim(v_checklist_item), 300),
              (select coalesce(max(ordem), -1) + 1 from tarefa_checklist_itens where tarefa_id = v_tarefa_id)
            );
          end if;
        end loop;
      end if;
    end loop;
  end if;

  insert into projeto_criacao_idempotencia (tenant_id, user_id, idempotency_key, projeto_id)
  values (p_tenant_id, auth.uid(), p_idempotency_key, v_projeto_id);

  return v_projeto_id;
end;
$$;

-- --------------------------------------------------------------------------
-- 2. Adicionar tarefas planejadas a um projeto existente
-- --------------------------------------------------------------------------
-- Quem pode: dono do workspace ou gestor do projeto (mesma regra do menu ⋯
-- do projeto, onde a ação fica). Destino: a coluna "Tarefas"; se ela foi
-- renomeada/apagada, a 1ª coluna comum (nem Concluído, nem Hoje, nem a de
-- foco) — nunca falha só por causa do nome da coluna. Os cartões entram no
-- FIM da coluna, sem mexer na ordem do que já existe.
--
-- Idempotência reaproveita `projeto_criacao_idempotencia` (migration 0051):
-- a chave é única por sessão do modal; a 2ª tentativa com a mesma chave
-- devolve 0 sem duplicar nada.
create or replace function adicionar_tarefas_planejadas(
  p_tenant_id uuid,
  p_projeto_id uuid,
  p_idempotency_key text,
  p_tarefas jsonb
) returns integer
language plpgsql
as $$
declare
  v_coluna_id uuid;
  v_tarefa jsonb;
  v_tarefa_id uuid;
  v_checklist_item text;
  v_ordem integer;
  v_criadas integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from projetos where id = p_projeto_id and tenant_id = p_tenant_id) then
    raise exception 'Projeto não encontrado.' using errcode = 'P0001';
  end if;

  if current_papel(p_tenant_id) is distinct from 'owner' and not eh_gestor_do_projeto(p_projeto_id) then
    raise exception 'Só o dono do workspace ou o gestor do projeto pode planejar o projeto.' using errcode = 'P0001';
  end if;

  if p_tarefas is null or jsonb_typeof(p_tarefas) <> 'array' then
    raise exception 'Formato inválido de tarefas.' using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_tarefas) > 30 then
    raise exception 'No máximo 30 itens por planejamento.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':' || auth.uid()::text || ':' || p_idempotency_key)::bigint);

  if exists (
    select 1 from projeto_criacao_idempotencia
    where tenant_id = p_tenant_id and user_id = auth.uid() and idempotency_key = p_idempotency_key
  ) then
    return 0;
  end if;

  select id into v_coluna_id
  from colunas_kanban
  where projeto_id = p_projeto_id and nome = 'Tarefas' and not concluido
  order by ordem
  limit 1;

  if v_coluna_id is null then
    select id into v_coluna_id
    from colunas_kanban
    where projeto_id = p_projeto_id and not concluido and not hoje and not dispara_hiperfoco
    order by ordem
    limit 1;
  end if;

  if v_coluna_id is null then
    raise exception 'O projeto não tem uma coluna onde colocar as tarefas.' using errcode = 'P0001';
  end if;

  select coalesce(max(ordem), 0) into v_ordem from tarefas where coluna_id = v_coluna_id;

  for v_tarefa in select * from jsonb_array_elements(p_tarefas)
  loop
    if v_tarefa->>'titulo' is null or length(trim(v_tarefa->>'titulo')) = 0 then
      continue;
    end if;

    v_ordem := v_ordem + 1000;

    insert into tarefas (tenant_id, projeto_id, coluna_id, titulo, descricao, prioridade, ordem, is_marco)
    values (
      p_tenant_id,
      p_projeto_id,
      v_coluna_id,
      left(trim(v_tarefa->>'titulo'), 200),
      nullif(left(trim(coalesce(v_tarefa->>'descricao', '')), 1000), ''),
      'P3',
      v_ordem,
      coalesce((v_tarefa->>'marco')::boolean, false)
    )
    returning id into v_tarefa_id;

    v_criadas := v_criadas + 1;

    if jsonb_typeof(v_tarefa->'checklist') = 'array' then
      for v_checklist_item in
        select t.item from jsonb_array_elements_text(v_tarefa->'checklist') as t(item) limit 15
      loop
        if length(trim(v_checklist_item)) > 0 then
          insert into tarefa_checklist_itens (tenant_id, tarefa_id, texto, ordem)
          values (
            p_tenant_id,
            v_tarefa_id,
            left(trim(v_checklist_item), 300),
            (select coalesce(max(ordem), -1) + 1 from tarefa_checklist_itens where tarefa_id = v_tarefa_id)
          );
        end if;
      end loop;
    end if;
  end loop;

  insert into projeto_criacao_idempotencia (tenant_id, user_id, idempotency_key, projeto_id)
  values (p_tenant_id, auth.uid(), p_idempotency_key, p_projeto_id);

  return v_criadas;
end;
$$;

revoke execute on function adicionar_tarefas_planejadas(uuid, uuid, text, jsonb) from public;
revoke execute on function adicionar_tarefas_planejadas(uuid, uuid, text, jsonb) from anon;
grant execute on function adicionar_tarefas_planejadas(uuid, uuid, text, jsonb) to authenticated;

-- Rollback: reaplicar a função da migration 0052 e
-- drop function if exists adicionar_tarefas_planejadas(uuid, uuid, text, jsonb);
