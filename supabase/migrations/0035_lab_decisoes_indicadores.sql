-- Gaiamum Lab (Fase A2): abre lab_passos para o módulo de Decisões e
-- Indicadores da Visão 360° do Lab — mesmo padrão aditivo de 0023
-- (notificacoes_app_tipo_check), nunca remove os valores já existentes.

alter table lab_passos
  drop constraint lab_passos_modulo_check;

alter table lab_passos
  add constraint lab_passos_modulo_check
  check (modulo in ('nucleo', 'decisoes_indicadores'));

alter table lab_passos
  drop constraint lab_passos_passo_check;

alter table lab_passos
  add constraint lab_passos_passo_check
  check (passo in ('explorar_quadro', 'concluir', 'criar_decisao', 'atualizar_indicador'));
