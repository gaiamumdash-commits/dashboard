-- Gaiamum — aumenta o timeout do net.http_get usado pelo cron de reforço
-- dos alarmes (migration 0021).
--
-- Achado em produção (2026-09-04): depois de corrigir o CRON_SECRET
-- divergente entre a Vercel e o Vault (causa do 401 anterior), metade das
-- chamadas continuava falhando -- desta vez por timeout. net._http_response
-- mostrava "Timeout of 5000 ms reached" com o tempo real de resposta da
-- rota ficando entre ~4.5s e ~4.8s, ou seja, no limiar do timeout padrão
-- do pg_net (5000ms). Muito provável cold start da função serverless da
-- Vercel (plano Hobby, sem instância aquecida) -- não um bug na lógica da
-- rota (as chamadas que respondiam a tempo vinham 200 normalmente,
-- {"verificados":2,"disparados":0,"falhas":[]}).
--
-- cron.alter_job troca só o texto do comando do job já agendado (jobid=1,
-- 'disparar-alarmes-reforco') -- não precisa unschedule/reschedule.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'disparar-alarmes-reforco'),
  command => $$
  select net.http_get(
    url := 'https://www.gaiamum.com.br/api/cron/disparar-alarmes',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret_alarmes')
    ),
    timeout_milliseconds := 15000
  ) as request_id;
  $$
);

-- Acompanhar respostas HTTP: select status_code, content, error_msg, created from net._http_response order by created desc limit 20;
