-- Gaiamum — Etiquetas múltiplas coloridas no cartão de tarefa (estilo
-- Trello), substituindo a `tag` única fixa. Etiqueta é por workspace
-- inteiro (reaproveitável entre projetos, com autocomplete), cor é
-- atribuída automaticamente por ordem de criação entre 6 cores fixas.

create table etiquetas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  nome text not null,
  cor text not null check (cor in ('purple', 'teal', 'yellow', 'blue', 'coral', 'lime')),
  criado_em timestamptz not null default now(),
  unique (tenant_id, nome)
);

alter table etiquetas enable row level security;

create policy "etiquetas: isolado por workspace"
  on etiquetas for all
  using (tenant_id in (select current_tenant_ids()))
  with check (tenant_id in (select current_tenant_ids()));

create index etiquetas_tenant_id_idx on etiquetas (tenant_id);

create table tarefa_etiquetas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tarefa_id uuid not null references tarefas (id) on delete cascade,
  etiqueta_id uuid not null references etiquetas (id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (tarefa_id, etiqueta_id)
);

alter table tarefa_etiquetas enable row level security;

-- Mesmo padrão de tarefa_membros/tarefa_checklist_itens (migration 0002):
-- isolado por workspace, não por projeto — a UI só consulta IDs que o
-- usuário já vê pela query de tarefas do próprio projeto.
create policy "tarefa_etiquetas: isolado por workspace"
  on tarefa_etiquetas for all
  using (tenant_id in (select current_tenant_ids()))
  with check (tenant_id in (select current_tenant_ids()));

create index tarefa_etiquetas_tarefa_id_idx on tarefa_etiquetas (tarefa_id);
create index tarefa_etiquetas_etiqueta_id_idx on tarefa_etiquetas (etiqueta_id);

-- Nenhuma tarefa real tinha `tag` preenchida no momento desta migration
-- (confirmado antes de escrever) — corta direto, sem passo de migração de dado.
alter table tarefas drop column tag;
