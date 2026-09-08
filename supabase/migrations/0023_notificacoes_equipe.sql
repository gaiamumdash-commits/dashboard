-- Gaiamum — Colaboração em equipe (item 1 do backlog, sessão #20): notificação
-- in-app quando alguém é promovido/removido de um quadro ou do workspace.
-- Convite continua só por e-mail (quem ainda não tem conta não tem pra onde
-- mandar notificação in-app, e resolver e-mail -> user_id existente abriria
-- oracle de enumeração de conta — decisão registrada no handoff).

alter table notificacoes_app
  drop constraint notificacoes_app_tipo_check;

alter table notificacoes_app
  add constraint notificacoes_app_tipo_check
  check (tipo in ('alarme', 'equipe'));
