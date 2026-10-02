-- Gaiamum — Temporizador de hiperfoco (2026-10-02).
--
-- Pedido do Fabio (checkpoint #62, refinado em #64 do handoff): ao mover um
-- cartão pra coluna de foco ("Em Desenvolvimento" por padrão), um popup
-- opcional pergunta se quer um alarme pra essa tarefa. Se definir, o cartão
-- muda de cor conforme o tempo passa (amarelo na metade, borda vermelha ao
-- esgotar) e toca um alarme no horário exato em que vence; ao vencer, pode
-- renovar (e por quanto tempo). Objetivo: foco único pra quem procrastina
-- ou tem TDAH — por isso só 1 cronômetro ativo por PESSOA (não por
-- workspace) a qualquer momento.
--
-- ==========================================================================
-- Grupo 1: identidade da coluna de foco — mesmo padrão exato de `hoje`
-- (migration 0048). Comparar por NOME seria frágil (quebra se o usuário
-- renomear) — o comentário da própria 0048 documenta que isso foi rejeitado
-- de propósito pelo Fabio. "Em Desenvolvimento" hoje não carrega nenhuma
-- marca especial no banco, só é uma string criada por `criarProjeto`.
-- ==========================================================================

alter table colunas_kanban add column dispara_hiperfoco boolean not null default false;

create unique index colunas_kanban_uma_foco_por_projeto
  on colunas_kanban (projeto_id)
  where dispara_hiperfoco;

-- Migração de dado existente — promove a coluna chamada "Em Desenvolvimento"
-- (comparação de nome usada SÓ nesta migração pontual, igual à 0048 fez com
-- "Hoje") quando existir exatamente 1 com esse nome no projeto, sem
-- ambiguidade. Quem não seguir essa convenção fica sem coluna de foco até
-- marcar uma pela interface (`definirColunaHiperfoco`).
update colunas_kanban c
set dispara_hiperfoco = true
where lower(trim(c.nome)) = 'em desenvolvimento'
  and not c.concluido
  and (
    select count(*) from colunas_kanban c2
    where c2.projeto_id = c.projeto_id and lower(trim(c2.nome)) = 'em desenvolvimento'
  ) = 1;

-- ==========================================================================
-- Grupo 2: estado do temporizador na própria tarefa.
--
-- `tempo_estimado_min` já existe desde a migration 0001 e nunca foi usado
-- em nenhuma Server Action ou UI até agora — reaproveitado aqui pra guardar
-- a duração escolhida (minutos), em vez de abrir uma coluna nova só pra
-- isso. As 2 colunas novas são o mínimo que falta: QUANDO o timer começou e
-- QUEM é o dono dele.
-- ==========================================================================

alter table tarefas add column hiperfoco_iniciado_em timestamptz;
alter table tarefas add column hiperfoco_user_id uuid references auth.users (id) on delete set null;

-- Esta é a trava REAL de "1 timer por pessoa, não por workspace" — não é só
-- esconder botão na interface. A 2ª tentativa de UPDATE que deixaria a
-- MESMA pessoa com 2 linhas de `hiperfoco_iniciado_em is not null` falha
-- com violação de unicidade (23505), tratada em `iniciarHiperfoco`
-- (actions.ts) como mensagem amigável.
create unique index tarefas_hiperfoco_um_por_pessoa
  on tarefas (hiperfoco_user_id)
  where hiperfoco_iniciado_em is not null;

-- Nenhuma policy de RLS nova: o UPDATE desses campos já é coberto pela
-- policy genérica existente ("tarefas: update por quem tem acesso ao
-- projeto", migration 0003) — mesma trilha que `coluna_id`/`turno` já usam.

-- ==========================================================================
-- Grupo 3: projetos novos já nascem com "Em Desenvolvimento" marcada.
--
-- A migration 0051 criou `criar_projeto_planejado_ia` sem essa marcação
-- (ainda não existia `dispara_hiperfoco` quando ela foi escrita) — redefine
-- a função aqui (CREATE OR REPLACE, mesma assinatura) só pra adicionar a
-- coluna nova no INSERT em lote de `colunas_kanban`. Resto do corpo
-- idêntico ao da 0051.
-- ==========================================================================

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

  if p_tarefas is not null and jsonb_array_length(p_tarefas) > 20 then
    raise exception 'No máximo 20 tarefas por planejamento.' using errcode = 'P0001';
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

      insert into tarefas (tenant_id, projeto_id, coluna_id, titulo, descricao, prioridade, ordem)
      values (
        p_tenant_id,
        v_projeto_id,
        v_coluna_tarefas_id,
        left(trim(v_tarefa->>'titulo'), 200),
        nullif(left(trim(coalesce(v_tarefa->>'descricao', '')), 1000), ''),
        'P3',
        v_ordem * 1000
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

-- Rollback (perde só a feature nova — não apaga tarefa/coluna já criada):
--
-- alter table tarefas drop column hiperfoco_iniciado_em;
-- alter table tarefas drop column hiperfoco_user_id;
-- drop index if exists colunas_kanban_uma_foco_por_projeto;
-- drop index if exists tarefas_hiperfoco_um_por_pessoa;
-- alter table colunas_kanban drop column dispara_hiperfoco;
-- (reverter `criar_projeto_planejado_ia` pro corpo da migration 0051, se necessário)
