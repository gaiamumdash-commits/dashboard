-- reivindicar_alarme() é security definer e não checa se quem chama tem
-- vínculo com o tenant do alarme (ao contrário de membros_do_tenant(), que
-- se auto-restringe com current_tenant_ids()) — CREATE FUNCTION concede
-- EXECUTE a PUBLIC por padrão no Postgres, então sem este revoke qualquer
-- usuário autenticado do Gaiamum conseguiria chamar
-- supabase.rpc("reivindicar_alarme", {...}) direto do navegador com o uuid
-- de um alarme de OUTRO tenant e marcá-lo como "já disparado", silenciando
-- a notificação de um cliente que não é o dele (achado de auditoria de
-- segurança, 2026-09-10).
--
-- Seguro revogar de anon/authenticated: o único chamador legítimo
-- (src/app/api/cron/disparar-alarmes/route.ts) já usa o service role via
-- createServiceClient(), que ignora GRANT/REVOKE de qualquer forma.
revoke execute on function reivindicar_alarme(uuid, timestamptz) from public;
revoke execute on function reivindicar_alarme(uuid, timestamptz) from anon;
revoke execute on function reivindicar_alarme(uuid, timestamptz) from authenticated;
