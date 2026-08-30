-- Gaiamum — regras de permissão decididas pelo Fabio nesta sessão:
-- só o owner (pagante) cria projeto e convida gente pro workspace; dentro
-- de um projeto, todo mundo pode fazer tudo (criar/mover/renomear), menos
-- apagar — apagar cartão ou coluna é só do gestor do projeto (ou owner) —
-- e apagar cartão sempre deixa registro (o log de atividade não some junto
-- com o cartão apagado).

-- ==========================================================================
-- Só owner cria projeto novo.
-- ==========================================================================

drop policy "projetos: insert por qualquer membro do tenant" on projetos;

create policy "projetos: insert somente owner"
  on projetos for insert
  with check (
    tenant_id in (select current_tenant_ids())
    and current_papel(tenant_id) = 'owner'
  );

-- ==========================================================================
-- Só owner convida (a policy de gestor-de-projeto-convida da migration 0003
-- nunca teve UI própria — a tela de convite só existe em /equipe, já restrita
-- a owner. Removendo pra não deixar uma via de convite sem controle na UI).
-- ==========================================================================

drop policy "convites: gestor do projeto convida para o proprio projeto" on convites;

-- ==========================================================================
-- Apagar coluna do kanban também é só gestor do projeto (ou owner) — criar
-- e renomear coluna continuam liberados pra qualquer membro do projeto.
-- ==========================================================================

drop policy "colunas_kanban: delete por quem tem acesso, exceto a fixa" on colunas_kanban;

create policy "colunas_kanban: delete so gestor do projeto ou owner, exceto a fixa"
  on colunas_kanban for delete
  using (
    tenant_id in (select current_tenant_ids())
    and (current_papel(tenant_id) = 'owner' or eh_gestor_do_projeto(projeto_id))
    and not concluido
  );

-- ==========================================================================
-- Apagar cartão passa a deixar registro: o histórico de atividade não é
-- mais apagado em cascata junto com o cartão.
-- ==========================================================================

alter table tarefa_atividades
  drop constraint tarefa_atividades_tipo_check;

alter table tarefa_atividades
  add constraint tarefa_atividades_tipo_check
  check (tipo in (
    'criada',
    'movida',
    'descricao_editada',
    'checklist_item_adicionado',
    'checklist_item_concluido',
    'checklist_item_reaberto',
    'checklist_item_removido',
    'membro_adicionado',
    'membro_removido',
    'excluida'
  ));

alter table tarefa_atividades
  alter column tarefa_id drop not null;

alter table tarefa_atividades
  drop constraint tarefa_atividades_tarefa_id_fkey;

alter table tarefa_atividades
  add constraint tarefa_atividades_tarefa_id_fkey
  foreign key (tarefa_id) references tarefas (id) on delete set null;
