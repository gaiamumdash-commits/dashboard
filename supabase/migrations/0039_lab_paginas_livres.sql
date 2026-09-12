alter table lab_passos drop constraint lab_passos_modulo_check;
alter table lab_passos add constraint lab_passos_modulo_check
  check (modulo in ('nucleo', 'decisoes_indicadores', 'financeiro', 'agenda', 'paginas_livres'));

alter table lab_passos drop constraint lab_passos_passo_check;
alter table lab_passos add constraint lab_passos_passo_check
  check (passo in (
    'explorar_quadro', 'concluir',
    'criar_decisao', 'atualizar_indicador',
    'marcar_valor_estimado', 'gerar_conta_a_pagar', 'marcar_conta_paga',
    'criar_evento_agenda', 'usar_agenda_por_voz',
    'criar_pagina_livre', 'editar_pagina_livre'
  ));
