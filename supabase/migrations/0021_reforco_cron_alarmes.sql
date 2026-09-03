-- Gaiamum — reforço de disparo dos alarmes via pg_cron/pg_net, direto do
-- Postgres (Supabase), independente do cron nativo da Vercel.
--
-- Contexto: o cron nativo (`vercel.json`, `/api/cron/disparar-alarmes`)
-- ficou limitado a 1x/dia porque o plano Hobby da Vercel só permite cron
-- diário — de hora em hora (o que já era insuficiente pra antecedências
-- curtas, tipo "15min antes") passou a exceder o limite e travava TODO
-- deploy do projeto (não só o cron) até ser corrigido. Este job roda a
-- cada 15min direto do banco, sem depender de plano pago na Vercel. O
-- claim atômico de `reivindicar_alarme` (migration 0019) garante que
-- rodar os dois crons ao mesmo tempo não duplica notificação — só quem
-- "ganha" o UPDATE da linha dispara.
--
-- PRÉ-REQUISITO MANUAL — rodar ANTES desta migration, direto no SQL
-- Editor do Supabase, substituindo pelo valor real do CRON_SECRET (o
-- mesmo já configurado na Vercel). NUNCA commitar o valor real no
-- repositório:
--
--   select vault.create_secret('<valor do CRON_SECRET da Vercel>', 'cron_secret_alarmes');
--
-- Se o secret precisar trocar depois:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'cron_secret_alarmes'),
--     '<novo valor>'
--   );

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select
  cron.schedule(
    'disparar-alarmes-reforco',
    '*/15 * * * *',
    $$
    select net.http_get(
      url := 'https://www.gaiamum.com.br/api/cron/disparar-alarmes',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret_alarmes')
      )
    ) as request_id;
    $$
  );

-- Acompanhar execuções: select * from cron.job_run_details order by start_time desc limit 20;
-- Acompanhar respostas HTTP: select * from net._http_response order by created desc limit 20;
-- Cancelar se precisar: select cron.unschedule('disparar-alarmes-reforco');
