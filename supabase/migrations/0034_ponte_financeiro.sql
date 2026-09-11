-- Ponte Kanban/Decisões -> Financeiro: marcar valor estimado (informativo,
-- mesma RLS de tarefas/decisoes) e permitir gerar uma conta a pagar real a
-- partir da tarefa/decisão (sempre revisado pelo owner, nunca automático —
-- contas_a_pagar continua Padrão B, sem RLS nova aqui).
alter table tarefas add column valor_estimado numeric(12,2);
alter table decisoes add column valor_estimado numeric(12,2);

alter table contas_a_pagar add column tarefa_id uuid references tarefas (id) on delete set null;
alter table contas_a_pagar add column decisao_id uuid references decisoes (id) on delete set null;

create unique index contas_a_pagar_tarefa_id_idx on contas_a_pagar (tarefa_id) where tarefa_id is not null;
create unique index contas_a_pagar_decisao_id_idx on contas_a_pagar (decisao_id) where decisao_id is not null;
