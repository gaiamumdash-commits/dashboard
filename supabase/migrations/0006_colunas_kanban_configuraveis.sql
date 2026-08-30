-- Gaiamum — Colunas do kanban configuráveis por projeto (estilo Trello).
-- Substitui o enum fixo de status ("backlog" / "em_execucao" / "concluido")
-- por uma tabela de colunas por projeto. Só a coluna "Concluído"
-- (concluido = true) é fixa — não pode ser renomeada nem apagada; as demais
-- o usuário cria, renomeia e apaga como quiser.

-- ==========================================================================
-- Grupo 12: Tabela de colunas
-- ==========================================================================

create table colunas_kanban (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  projeto_id uuid not null references projetos (id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  concluido boolean not null default false,
  criado_em timestamptz not null default now()
);

-- No máximo uma coluna "Concluído" por projeto.
create unique index colunas_kanban_um_concluido_por_projeto
  on colunas_kanban (projeto_id)
  where concluido;

alter table colunas_kanban enable row level security;

create policy "colunas_kanban: select por quem tem acesso ao projeto"
  on colunas_kanban for select
  using (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id));

create policy "colunas_kanban: insert por quem tem acesso ao projeto"
  on colunas_kanban for insert
  with check (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id));

-- A coluna "Concluído" (concluido = true) não pode ser renomeada.
create policy "colunas_kanban: update por quem tem acesso, exceto a fixa"
  on colunas_kanban for update
  using (
    tenant_id in (select current_tenant_ids())
    and tem_acesso_ao_projeto(projeto_id, tenant_id)
    and not concluido
  )
  with check (
    tenant_id in (select current_tenant_ids())
    and tem_acesso_ao_projeto(projeto_id, tenant_id)
    and not concluido
  );

-- A coluna "Concluído" (concluido = true) não pode ser apagada.
create policy "colunas_kanban: delete por quem tem acesso, exceto a fixa"
  on colunas_kanban for delete
  using (
    tenant_id in (select current_tenant_ids())
    and tem_acesso_ao_projeto(projeto_id, tenant_id)
    and not concluido
  );

create index colunas_kanban_projeto_id_idx on colunas_kanban (projeto_id);
create index colunas_kanban_tenant_id_idx on colunas_kanban (tenant_id);

-- ==========================================================================
-- Grupo 13: Migra tarefas de status (enum fixo) para coluna_id (FK dinâmica)
-- ==========================================================================

alter table tarefas add column coluna_id uuid references colunas_kanban (id);

-- Cria as 3 colunas atuais pra cada projeto já existente, preservando nome e
-- posição (renomeadas nesta mesma sessão de "A Fazer / Backlog" → "Em
-- Aberto" e "Em Execução" → "Em Desenvolvimento"), e marca "Concluído" como
-- a fixa.
insert into colunas_kanban (tenant_id, projeto_id, nome, ordem, concluido)
select tenant_id, id, 'Em Aberto', 0, false from projetos
union all
select tenant_id, id, 'Em Desenvolvimento', 1, false from projetos
union all
select tenant_id, id, 'Concluído', 0, true from projetos;

-- Aponta cada tarefa existente pra coluna correspondente do próprio projeto.
update tarefas t
set coluna_id = c.id
from colunas_kanban c
where c.projeto_id = t.projeto_id
  and (
    (t.status = 'backlog' and c.ordem = 0 and not c.concluido)
    or (t.status = 'em_execucao' and c.ordem = 1 and not c.concluido)
    or (t.status = 'concluido' and c.concluido)
  );

alter table tarefas alter column coluna_id set not null;
alter table tarefas drop column status;

create index tarefas_coluna_id_idx on tarefas (coluna_id);
