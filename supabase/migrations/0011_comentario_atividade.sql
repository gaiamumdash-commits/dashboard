-- Gaiamum — Comentário no cartão de tarefa, reaproveitando a mesma tabela
-- de atividade (tarefa_atividades) em vez de criar uma tabela nova — o
-- texto do comentário fica em detalhe.texto, mesmo mecanismo de
-- notificação por e-mail que os outros tipos de atividade já usam.

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
    'excluida',
    'comentario'
  ));
