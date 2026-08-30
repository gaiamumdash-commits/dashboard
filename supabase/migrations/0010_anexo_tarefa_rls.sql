-- Gaiamum — Anexo de arquivo no cartão de tarefa, reaproveitando a mesma
-- peça de `anexos` já construída pro comprovante de conta a pagar
-- (migration 0008). A policy de conta_a_pagar (owner-only) continua
-- intocada; esta é nova, específica pra entidade_tipo = 'tarefa', usando
-- a mesma regra de acesso por projeto que já vale pra `tarefas`.

create policy "anexos: tarefa, por acesso ao projeto"
  on anexos for all
  using (
    tenant_id in (select current_tenant_ids())
    and entidade_tipo = 'tarefa'
    and exists (
      select 1 from tarefas t
      where t.id = anexos.entidade_id
        and tem_acesso_ao_projeto(t.projeto_id, anexos.tenant_id)
    )
  )
  with check (
    tenant_id in (select current_tenant_ids())
    and entidade_tipo = 'tarefa'
    and exists (
      select 1 from tarefas t
      where t.id = anexos.entidade_id
        and tem_acesso_ao_projeto(t.projeto_id, anexos.tenant_id)
    )
  );
