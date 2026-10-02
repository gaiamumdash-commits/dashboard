-- Gaiamum — Revisão pontual de privacidade (2026-10-01), item 6 do pedido
-- de ajustes do Kanban.
--
-- ACHADO 1 (confirmado, não só suposto): a migration 0047 corrigiu o
-- vazamento de e-mail de QUALQUER membro do workspace pra convidado de
-- escopo='projeto', mas manteve o e-mail COMPLETO do(s) owner(s) visível
-- pra qualquer convidado, mesmo sem projeto compartilhado — justificado
-- antes como "necessário pra @menção/atribuição". Reavaliação mais
-- rigorosa: a função de IDENTIFICAR/SELECIONAR a pessoa na interface (
-- autocomplete de @menção, seletor de responsável, avatar) só precisa de
-- ALGO único e legível — não precisa ser especificamente o endereço de
-- e-mail completo. `user_id` já resolve a AÇÃO (atribuir, marcar
-- responsável — os botões de seleção já usam isso, não o e-mail). Falta só
-- uma IDENTIFICAÇÃO textual que não seja o endereço completo: a parte
-- local do e-mail (antes do @) já cumpre esse papel, com a mesma técnica
-- de derivação (`split_part`) em toda consulta.
--
-- ACHADO 2, descoberto ao investigar o achado 1 (mais grave, achado real,
-- não hipotético): a resolução de quem notificar por e-mail
-- (`registrarAtividade` em atividade.ts, `enviarConsolidacaoProjeto` em
-- actions.ts) usa `listarMembros()`/`listarMembrosComAcessoAoProjeto()` —
-- a MESMA function pública, limitada por escopo de QUEM DISPAROU a ação,
-- não uma resolução privilegiada. Isso significa que, se um convidado de
-- projeto (ou um gestor de projeto sem acesso completo) move um cartão
-- atribuído ao owner, ou dispara um Freeze, a notificação dependeria do
-- e-mail do owner estar visível PRA ELE — um acoplamento indevido entre
-- "o que a interface mostra pra mim" e "pra quem o sistema consegue
-- avisar". Corrigido com uma function SEPARADA, privilegiada, que nunca é
-- limitada pelo escopo de quem disparou a notificação — exatamente a
-- separação pedida: "identificar/selecionar a pessoa na interface" versus
-- "resolver seu endereço para enviar notificação no servidor".

-- ==========================================================================
-- 1) `membros_do_tenant()` — e-mail completo só quando necessário de
--    verdade; `nome_exibicao` sempre presente, pra identificação sem expor
--    o endereço completo.
-- ==========================================================================
-- `CREATE OR REPLACE` não permite mudar o shape de retorno (coluna nova,
-- `nome_exibicao`) — precisa derrubar a versão anterior primeiro.
drop function if exists membros_do_tenant(uuid);

create function membros_do_tenant(t_id uuid)
returns table (user_id uuid, email text, papel text, nome_exibicao text)
language sql
stable
security definer
set search_path = public
as $$
  with visibilidade as (
    select
      m.user_id,
      m.papel,
      u.email as email_real,
      tem_acesso_completo(t_id) as chamador_tem_acesso_completo,
      exists (
        select 1
        from projeto_membros pm_eu
        join projeto_membros pm_alvo on pm_alvo.projeto_id = pm_eu.projeto_id
        where pm_eu.tenant_id = t_id
          and pm_eu.user_id = auth.uid()
          and pm_alvo.user_id = m.user_id
      ) as compartilha_projeto
    from memberships m
    join auth.users u on u.id = m.user_id
    where m.tenant_id = t_id
      and t_id in (select current_tenant_ids())
  )
  select
    user_id,
    -- E-mail completo só quando o chamador JÁ tinha direito a ele antes
    -- desta migration: acesso completo ao workspace, ou compartilha pelo
    -- menos 1 projeto com o alvo. O único caso que muda é "owner sem
    -- projeto compartilhado, visível só pela regra de fallback" — antes
    -- vinha com e-mail completo, agora vem `null` (a identificação
    -- continua via `nome_exibicao`).
    case when chamador_tem_acesso_completo or compartilha_projeto then email_real else null end as email,
    papel,
    split_part(email_real, '@', 1) as nome_exibicao
  from visibilidade
  where chamador_tem_acesso_completo or papel = 'owner' or compartilha_projeto;
$$;

-- ==========================================================================
-- 2) Nova function PRIVILEGIADA, só pra resolução de notificação — nunca
--    chamada pelo cliente, nunca limitada pelo escopo de quem disparou a
--    ação que gerou a notificação. Mesmo padrão de revoke já usado em
--    `reivindicar_alarme` (0029) e `ia_registrar_tentativa` (0046).
-- ==========================================================================
create or replace function emails_para_notificacao(p_user_ids uuid[], p_tenant_id uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, u.email
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.user_id = any(p_user_ids) and m.tenant_id = p_tenant_id;
$$;

revoke execute on function emails_para_notificacao(uuid[], uuid) from public;
revoke execute on function emails_para_notificacao(uuid[], uuid) from anon;
revoke execute on function emails_para_notificacao(uuid[], uuid) from authenticated;

-- Rollback (perde a redução de exposição e a resolução privilegiada, mas
-- não apaga dado nenhum — `auth.users.email` nunca foi alterado):
--
-- create or replace function membros_do_tenant(t_id uuid)
-- returns table (user_id uuid, email text, papel text)
-- language sql stable security definer set search_path = public as $$
--   select m.user_id, u.email, m.papel
--   from memberships m
--   join auth.users u on u.id = m.user_id
--   where m.tenant_id = t_id
--     and t_id in (select current_tenant_ids())
--     and (
--       tem_acesso_completo(t_id)
--       or m.papel = 'owner'
--       or exists (
--         select 1 from projeto_membros pm_eu
--         join projeto_membros pm_alvo on pm_alvo.projeto_id = pm_eu.projeto_id
--         where pm_eu.tenant_id = t_id and pm_eu.user_id = auth.uid() and pm_alvo.user_id = m.user_id
--       )
--     );
-- $$;
-- drop function if exists emails_para_notificacao(uuid[], uuid);
