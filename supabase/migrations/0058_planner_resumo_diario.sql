-- Gaiamum — Resumo diário do Planner por e-mail (pedido do Fabio, 2026-10-07).
-- Às 7h (Brasília) cada pessoa que tem algo no Planner pra hoje recebe um
-- e-mail com o PRÓPRIO dia: compromissos, rotinas, hábitos, manutenções
-- vencendo e como foi ontem. Quem não tem nada pra hoje não recebe nada.
--
-- `resumo_diario`: liga/desliga, pela própria pessoa (botão no Meu Planner).
--   Padrão ligado — sem linha em planner_preferencias também conta como
--   ligado (o cron cria a linha na 1ª vez que envia).
-- `resumo_enviado_em`: dia (Brasília) do último envio. O cron só envia se
--   conseguir trocar esse valor pra "hoje" num UPDATE condicional — 2
--   execuções no mesmo dia nunca mandam 2 e-mails (mesmo padrão do
--   reengajamento do Lab).
--
-- Reversão: alter table planner_preferencias drop column resumo_diario,
--   drop column resumo_enviado_em;

alter table planner_preferencias
  add column resumo_diario boolean not null default true,
  add column resumo_enviado_em date;
