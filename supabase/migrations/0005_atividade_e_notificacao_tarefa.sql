-- Gaiamum — Log de atividade da tarefa (quem mexeu, quando, o quê) + base
-- pra notificação por e-mail (Resend) quando um cartão muda. Pedido do
-- Fabio comparando com o Trello: precisa ficar registrado quem fez o quê,
-- pra ninguém mexer na tarefa do outro sem saber.

create table tarefa_atividades (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  projeto_id uuid not null references projetos (id) on delete cascade,
  tarefa_id uuid not null references tarefas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in (
    'criada',
    'movida',
    'descricao_editada',
    'checklist_item_adicionado',
    'checklist_item_concluido',
    'checklist_item_reaberto',
    'checklist_item_removido',
    'membro_adicionado',
    'membro_removido'
  )),
  detalhe jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

alter table tarefa_atividades enable row level security;

-- Reaproveita a mesma função de acesso a projeto de projetos/tarefas
-- (migration 0003/0004): quem enxerga a tarefa enxerga o histórico dela.
create policy "tarefa_atividades: select por quem tem acesso ao projeto"
  on tarefa_atividades for select
  using (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id));

create policy "tarefa_atividades: insert por quem tem acesso ao projeto"
  on tarefa_atividades for insert
  with check (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id));

create index tarefa_atividades_tarefa_id_idx on tarefa_atividades (tarefa_id, criado_em desc);
create index tarefa_atividades_projeto_id_idx on tarefa_atividades (projeto_id);
