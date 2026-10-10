-- Gaiamum — Mapa mental: reforço de segurança (auditoria de 2026-10-10).
--
-- A RLS da 0059 já barra tudo para quem não está logado (testado em
-- produção: leitura vazia, insert recusado, funções negadas). Mas o papel
-- `anon` ainda tem privilégio de tabela herdado do padrão do Supabase — o
-- app NUNCA usa `anon` nestas tabelas (as Server Actions rodam com o JWT da
-- pessoa = `authenticated`). Tirar o privilégio é defesa em profundidade:
-- se um dia alguém afrouxar uma policy por engano, o anônimo continua fora.
--
-- Não muda nada para quem está logado. Reversão:
--   grant select, insert, update, delete on mapas, mapa_nos to anon;

revoke all on mapas, mapa_nos from anon;

notify pgrst, 'reload schema';
