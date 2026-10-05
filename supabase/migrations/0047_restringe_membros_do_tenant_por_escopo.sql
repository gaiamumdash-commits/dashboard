-- ⚠️ SUPERADA — NÃO APLICAR EM PRODUÇÃO (achado real, 2026-10-04).
--
-- Esta migration nunca chegou a ser aplicada em produção (ficou pra trás
-- por engano num lote manual anterior), mas a correção que ela trazia foi
-- reimplementada do zero, de forma independente e mais completa, pela
-- migration `0049_privacidade_membros_e_resolucao_notificacao.sql` — que
-- essa sim ESTÁ em produção. A 0049 faz `drop function` + `create function`
-- com a MESMA regra de restrição por escopo desta migration, mais uma
-- coluna nova (`nome_exibicao`) e lógica adicional de mascarar e-mail.
--
-- Tentar aplicar esta migration (0047) por cima da 0049 falha —
-- `ERROR: 42P13: cannot change return type of existing function` — porque
-- o formato de retorno não bate mais (3 colunas aqui vs. 4 na 0049). Se
-- alguém "corrigir" isso com um DROP FUNCTION antes, o resultado seria uma
-- REGRESSÃO: perderia `nome_exibicao` (que o app já depende dele existir,
-- ver `MembroTenant` em tipos.ts) e a função privilegiada
-- `emails_para_notificacao` que a 0049 também criou.
--
-- Mantida aqui só por valor histórico/arqueológico — nunca aplicar.
--
-- ============================================================================
-- Texto original (histórico) abaixo:
-- ============================================================================
--
-- Gaiamum — Fechamento do P0 (2026-09-30): corrige achado de segurança
-- descoberto durante a validação do P0 (não fazia parte do escopo
-- original), confirmado contra Postgres real em
-- tests/integration/rls-limites-entre-projetos.test.ts.
--
-- PROBLEMA: membros_do_tenant() (migration 0002) sempre devolveu TODOS os
-- membros do tenant (user_id + email + papel) pra qualquer chamador com
-- QUALQUER membership ali — nunca checou `escopo`. A function nunca teve
-- `EXECUTE` restrito (diferente de reivindicar_alarme/ia_registrar_tentativa,
-- que foram revogados de authenticated nas migrations 0029/0046), então um
-- usuário convidado só pra 1 projeto (`escopo: 'projeto'`, que pelo design
-- documentado "não vê Equipe do workspace inteiro, só o(s) quadro(s) dele")
-- conseguia chamar supabase.rpc("membros_do_tenant", {t_id}) direto do
-- navegador e receber e-mail de todo mundo do workspace, inclusive o owner.
--
-- MAPEAMENTO DOS 4 CONSUMIDORES REAIS (nenhum deles vazava isso pro cliente
-- por si só — o vazamento só existia via chamada direta à RPC, contornando
-- a aplicação):
--   1. app/equipe/page.tsx — já bloqueada por temAcessoCompleto() ANTES de
--      chamar listarMembros(); nunca alcançada por quem tem escopo='projeto'.
--   2. equipe.ts:listarMembrosComAcessoAoProjeto() — busca todos e filtra em
--      JS, mas TUDO roda no servidor antes de qualquer resposta ao cliente;
--      usada em /projetos/[id]/tarefas (seletor de responsável, @menção) e
--      /projetos/[id]/configuracoes ("Equipe do quadro") — AMBAS acessíveis
--      por quem tem escopo='projeto', dentro do PRÓPRIO projeto dele. Esta
--      função não pode perder acesso a "quem está no meu projeto", só não
--      deve mais poder enxergar o resto do workspace.
--   3. atividade.ts:registrarAtividade() — resolve e-mail de responsáveis/
--      menções pra notificar, sempre dentro do escopo de uma tarefa (logo,
--      de um projeto) que o chamador já tem acesso.
--   4. actions.ts:removerMembro() — só chamável por owner (guard explícito
--      antes), nunca por escopo='projeto'.
--
-- CORREÇÃO (no banco, não só na aplicação — pedido explícito): a própria
-- function agora filtra por quem está chamando (auth.uid()), preservando
-- 100% do comportamento atual pra quem tem acesso completo (owner ou
-- escopo='completo' — cobre os casos 1 e 4 acima, e o uso normal dos casos
-- 2/3 quando quem mexe no projeto tem acesso completo), e restringindo quem
-- tem só escopo='projeto' a enxergar SÓ colegas que compartilham pelo menos
-- 1 projeto com ele (via projeto_membros) — exatamente o que os casos 2/3
-- precisam pra continuar funcionando (atribuir responsável, @mencionar,
-- "Equipe do quadro"), sem vazar o resto do workspace. O(s) owner(s) do
-- tenant sempre aparecem na lista mesmo sem linha explícita em
-- projeto_membros (o dono legitimamente pode precisar ser @mencionado/
-- atribuído num quadro que ele não administra diretamente — na prática ele
-- quase sempre já está em projeto_membros como gestor por ter criado o
-- projeto, mas isto cobre o caso de um 2º owner que não criou aquele quadro).
--
-- CREATE OR REPLACE é aditivo — não altera dado nenhum, só o comportamento
-- da function a partir de agora. Rollback ao final do arquivo.

create or replace function membros_do_tenant(t_id uuid)
returns table (user_id uuid, email text, papel text)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, u.email, m.papel
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = t_id
    and t_id in (select current_tenant_ids())
    and (
      -- Acesso completo ao workspace (owner, ou member com escopo='completo')
      -- continua vendo todo mundo — comportamento original, inalterado.
      tem_acesso_completo(t_id)
      -- Owner(s) do tenant sempre aparecem, mesmo pra quem tem só
      -- escopo='projeto' — ver comentário acima.
      or m.papel = 'owner'
      -- Escopo='projeto': só vê quem compartilha pelo menos 1 projeto com
      -- quem está chamando — nunca o resto do workspace.
      or exists (
        select 1
        from projeto_membros pm_eu
        join projeto_membros pm_alvo
          on pm_alvo.projeto_id = pm_eu.projeto_id
        where pm_eu.tenant_id = t_id
          and pm_eu.user_id = auth.uid()
          and pm_alvo.user_id = m.user_id
      )
    );
$$;

-- Rollback (restaura o comportamento de antes desta migration, se algum dia
-- precisar reverter — não recomendado, reintroduz o vazamento):
--
-- create or replace function membros_do_tenant(t_id uuid)
-- returns table (user_id uuid, email text, papel text)
-- language sql stable security definer set search_path = public as $$
--   select m.user_id, u.email, m.papel
--   from memberships m
--   join auth.users u on u.id = m.user_id
--   where m.tenant_id = t_id and t_id in (select current_tenant_ids());
-- $$;
