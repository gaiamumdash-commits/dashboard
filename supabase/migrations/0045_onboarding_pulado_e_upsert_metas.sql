-- Gaiamum — Consolidação P0 (2026-09-30): corrige 2 achados da auditoria
-- (GAIAMUM-HANDOFF-CANONICO-ESTADO-ATUAL.md, seções 11/16/21):
--
-- 1. Não existia nenhuma forma de editar uma Meta SMART depois de criada —
--    a única escrita em metas_smart era um `insert` puro. O link "Editar"
--    do dashboard levava a uma tela que, com metas já existentes, não
--    mostrava formulário nenhum. Índice único (tenant_id, horizonte)
--    permite trocar `criarMetasSmart` (insert puro) por um upsert real
--    (`.upsert(..., {onConflict: "tenant_id,horizonte"})`), que PRESERVA o
--    id e os vínculos existentes (projetos.meta_smart_id,
--    decisoes.meta_smart_id) ao editar — nunca duplica a linha do mesmo
--    horizonte, mesmo em clique duplo/corrida (o índice único garante isso
--    no banco, não só no código da aplicação).
--
-- 2. "Pular onboarding" não tinha estado persistido: `pularOnboarding()`
--    manda pra /projetos, mas o Painel geral (`/`) sempre redireciona de
--    volta pro onboarding enquanto não houver nenhuma meta salva — um loop
--    de fato para quem pula e depois visita "/" de novo. A nova coluna
--    registra a decisão explícita de pular, sem apagar nada de quem já tem
--    meta (nullable, sem default, não força nada em quem já passou por
--    aqui antes desta migration).

-- ==========================================================================
-- Índice único: no máximo 1 meta por horizonte, por workspace.
-- ==========================================================================

-- Pré-requisito de segurança antes de aplicar em qualquer ambiente com
-- dados reais: confirmar que não há hoje duas linhas de metas_smart com o
-- mesmo (tenant_id, horizonte) — nunca visto no código de escrita (só
-- `criarMetasSmart`, que sempre insere as duas linhas juntas, uma por
-- HORIZONTES, uma vez só, no dia 1), mas o índice falha ao criar se existir
-- duplicata real. Rodar antes, no ambiente-alvo:
--
--   select tenant_id, horizonte, count(*)
--   from metas_smart
--   group by tenant_id, horizonte
--   having count(*) > 1;
--
-- Se aparecer alguma linha, resolver manualmente (decidir qual das
-- duplicatas fica) antes de aplicar esta migration — ver
-- docs/gaiamum/GAIAMUM-RELATORIO-INCREMENTO-P0.md para o registro desta
-- verificação nesta sessão (não foi possível rodar contra um banco real,
-- Docker Desktop indisponível neste ambiente — ver seção de impedimentos).
create unique index metas_smart_tenant_horizonte_unico
  on metas_smart (tenant_id, horizonte);

-- ==========================================================================
-- Onboarding: decisão explícita de pular, sem mexer na policy de UPDATE de
-- `tenants` já existente (migration 0036, só owner) — a Server Action que
-- grava esta coluna usa o service client de propósito (mesmo padrão já
-- usado em vincularUsuarioAoConvite/garantirTenantLab), porque quem pula o
-- onboarding pode ser um member com escopo completo, não só o owner, e a
-- policy atual de tenants não cobre esse caso. tenantId nunca vem de input
-- do cliente (sempre de garantirWorkspace()), então é seguro escrever via
-- service client aqui.
-- ==========================================================================

alter table tenants
  add column onboarding_metas_pulado_em timestamptz;
