-- Gaiamum — Criação de projeto com planejamento assistido por IA (2026-10-02).
--
-- Pedido do Fabio (handoff canônico, checkpoint #62): ao criar um projeto, a
-- pessoa pode descrever o objetivo (texto ou voz) e a IA sugere uma lista de
-- tarefas candidatas; a pessoa revisa, edita e seleciona o que quer, e só
-- então o projeto + as colunas padrão + os cartões escolhidos (com
-- checklists internos) são criados — tudo numa operação atômica, em "Tarefas".
--
-- Esta migration NÃO muda a estrutura de colunas padrão (Hoje → Tarefas → Em
-- Desenvolvimento → Concluído já é o padrão de fábrica desde a migration
-- 0048/criarProjeto) nem a visualização "Compromissos" (já é derivada,
-- montada em ColunaCompromissosDoDia, nunca uma coluna persistida — nada a
-- mudar aqui). O que falta é só a criação ATÔMICA e IDEMPOTENTE de um
-- projeto já com cartões/checklists vindos da prévia da IA.
--
-- ==========================================================================
-- Grupo: idempotência (clique duplo / retry nunca duplica o projeto)
-- ==========================================================================
--
-- Cada confirmação do assistente de IA carrega uma chave gerada no cliente
-- (1 UUID por sessão do modal, gerado uma única vez ao abrir — não a cada
-- clique) — a função abaixo é a única gravação possível nesta tabela, e o
-- índice único garante que a 2ª tentativa com a MESMA chave nunca cria um
-- 2º projeto, só devolve o id do que já existe.
create table projeto_criacao_idempotencia (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key text not null,
  projeto_id uuid not null references projetos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (tenant_id, user_id, idempotency_key)
);

alter table projeto_criacao_idempotencia enable row level security;

-- Só leitura/escrita do próprio registro — nunca precisa ser lida pela
-- interface (é um detalhe interno da função abaixo), mas a RLS tem que
-- liberar o INSERT pro próprio usuário autenticado, já que a função roda
-- SECURITY INVOKER (sem bypass de RLS), igual ao resto do insert feito por
-- ela nesta mesma transação.
create policy "projeto_criacao_idempotencia: proprio usuario"
  on projeto_criacao_idempotencia for all
  using (tenant_id in (select current_tenant_ids()) and user_id = auth.uid())
  with check (tenant_id in (select current_tenant_ids()) and user_id = auth.uid());

create index projeto_criacao_idempotencia_tenant_idx on projeto_criacao_idempotencia (tenant_id);

-- ==========================================================================
-- Grupo: função atômica de criação
-- ==========================================================================
--
-- SECURITY INVOKER (padrão, omitido de propósito — nunca precisa bypassar
-- RLS): roda com os mesmos privilégios de quem chama via `supabase.rpc(...)`
-- autenticado, então toda escrita feita aqui dentro (projetos, colunas_kanban,
-- tarefas, tarefa_checklist_itens, projeto_membros) continua validada pelas
-- policies já em vigor — a função não abre NENHUM acesso que o usuário já
-- não tivesse fazendo as mesmas operações direto (mesmo caminho que
-- `criarProjeto`, em actions.ts, já usa hoje, só que em lote e atômico).
--
-- `p_tenant_id` sempre vem do servidor (Server Action resolve via
-- garantirWorkspace(), nunca aceito cru do cliente) — mas mesmo assim seria
-- inofensivo receber um tenant_id arbitrário aqui: toda gravação exige
-- `tenant_id in current_tenant_ids()` e `current_papel(p_tenant_id) = 'owner'`,
-- então tentar criar num tenant alheio simplesmente falha na policy.
--
-- `p_tarefas` é jsonb de sugestões JÁ REVISADAS/VALIDADAS pela Server Action
-- (schema, tamanho e quantidade checados em TypeScript antes de chamar esta
-- função) — mas o limite de quantidade é reforçado aqui de novo, porque "o
-- navegador não é fonte de autorização": nenhum dado do modelo de IA (nem
-- id de tenant/usuário/coluna/responsável) é aceito, só título/descrição/
-- checklist, e tudo o mais (tenant_id, projeto_id, coluna_id de destino,
-- user_id do gestor) é resolvido aqui dentro, nunca vindo do array.
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

  -- Serializa tentativas concorrentes com a MESMA chave (duplo clique, ou
  -- um retry de rede enquanto a 1ª tentativa ainda está em voo) — mesma
  -- técnica de advisory lock já usada em garantir_workspace_pessoal
  -- (migration 0040). O lock é liberado sozinho no fim da transação.
  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':' || auth.uid()::text || ':' || p_idempotency_key)::bigint);

  select projeto_id into v_projeto_id
  from projeto_criacao_idempotencia
  where tenant_id = p_tenant_id and user_id = auth.uid() and idempotency_key = p_idempotency_key;

  if v_projeto_id is not null then
    -- Já criado por uma tentativa anterior com a mesma chave — devolve o
    -- mesmo projeto, não duplica nada.
    return v_projeto_id;
  end if;

  insert into projetos (tenant_id, nome, descricao)
  values (p_tenant_id, trim(p_nome), nullif(trim(coalesce(p_descricao, '')), ''))
  returning id into v_projeto_id;

  insert into projeto_membros (tenant_id, projeto_id, user_id, papel)
  values (p_tenant_id, v_projeto_id, auth.uid(), 'gestor');

  -- Mesma estrutura de fábrica de `criarProjeto` (actions.ts) — todo objeto
  -- do array com as MESMAS chaves (achado real documentado na migration
  -- 0048: PostgREST monta colunas pela união das chaves; aqui é um INSERT
  -- plpgsql comum, não tem essa armadilha, mas a simetria evita divergência
  -- entre os dois caminhos de criação).
  insert into colunas_kanban (tenant_id, projeto_id, nome, ordem, concluido, hoje)
  values
    (p_tenant_id, v_projeto_id, 'Hoje', 0, false, true),
    (p_tenant_id, v_projeto_id, 'Tarefas', 1, false, false),
    (p_tenant_id, v_projeto_id, 'Em Desenvolvimento', 2, false, false),
    (p_tenant_id, v_projeto_id, 'Concluído', 0, true, false);

  select id into v_coluna_tarefas_id
  from colunas_kanban
  where projeto_id = v_projeto_id and nome = 'Tarefas' and not concluido;

  if p_tarefas is not null then
    for v_tarefa in select * from jsonb_array_elements(p_tarefas)
    loop
      if v_tarefa->>'titulo' is null or length(trim(v_tarefa->>'titulo')) = 0 then
        continue; -- ignora silenciosamente um item sem título (já deveria ter sido barrado em TS)
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

-- CREATE FUNCTION concede EXECUTE a PUBLIC por padrão — restringe a quem já
-- precisaria estar autenticado de qualquer forma (anon nunca passaria de
-- `auth.uid() is null` lá em cima, mas reduzir a superfície é mais simples
-- de auditar do que confiar só nisso).
revoke execute on function criar_projeto_planejado_ia(uuid, text, text, text, jsonb) from public;
revoke execute on function criar_projeto_planejado_ia(uuid, text, text, text, jsonb) from anon;
grant execute on function criar_projeto_planejado_ia(uuid, text, text, text, jsonb) to authenticated;

-- Rollback (perde só a função/tabela novas — não apaga projeto/tarefa já
-- criados por ela, que já são linhas normais de `projetos`/`tarefas`):
--
-- drop function if exists criar_projeto_planejado_ia(uuid, text, text, text, jsonb);
-- drop table if exists projeto_criacao_idempotencia;
