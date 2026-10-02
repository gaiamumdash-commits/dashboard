-- Gaiamum — Ajustes do Kanban após a entrega mobile (2026-10-01).
--
-- PROBLEMA: "só a coluna Hoje pode dividir em turnos" não tinha como ser
-- aplicado de verdade — o sistema nunca teve uma identidade formal de
-- "qual coluna é a Hoje" (nem no schema, nem em `criarProjeto`, que sempre
-- criou "Em Aberto" + "Em Desenvolvimento" + "Concluído"). Usar o NOME da
-- coluna pra decidir isso seria frágil (quebra se o usuário renomear, usar
-- maiúscula diferente, espaço extra, etc.) — pedido explícito do Fabio pra
-- evitar exatamente essa comparação.
--
-- SOLUÇÃO: nova coluna de sistema `hoje`, no MESMO padrão arquitetural já
-- usado por `concluido` (migration 0006) — um booleano simples, no máximo
-- 1 por projeto (índice único parcial), sem exigir reescrever nada do que
-- já existe. "Hoje" NÃO fica com a posição travada (diferente de
-- `concluido`, que não pode ser movida/renomeada/apagada) — ela pode ser
-- arrastada livremente e renomeada; só carrega o significado especial de
-- "permite dividir em turnos" e "novas colunas nascem logo depois dela".

alter table colunas_kanban add column hoje boolean not null default false;

create unique index colunas_kanban_uma_hoje_por_projeto
  on colunas_kanban (projeto_id)
  where hoje;

-- ==========================================================================
-- Migração de dado existente — preserva conteúdo e ordem, não apaga nada.
-- ==========================================================================

-- 1) Convenção já em uso no produto real: promove a coluna chamada "Hoje"
--    (comparação de nome usada SÓ nesta migração pontual, para não perder a
--    convenção que o Fabio já segue manualmente — nunca mais comparado por
--    nome depois disso, nem na aplicação nem nesta migration) a coluna de
--    sistema, quando existir exatamente 1 com esse nome no projeto (sem
--    ambiguidade). Quem não seguir essa convenção fica sem "Hoje" até
--    marcar uma pela interface nova (`definirColunaHoje`) — fallback
--    documentado abaixo e no Backlog.
update colunas_kanban c
set hoje = true
where lower(trim(c.nome)) = 'hoje'
  and not c.concluido
  and (
    select count(*) from colunas_kanban c2
    where c2.projeto_id = c.projeto_id and lower(trim(c2.nome)) = 'hoje'
  ) = 1;

-- 2) Colunas que já tinham `dividida_em_turnos = true` mas NÃO viraram
--    "Hoje" no passo acima: a regra nova as deixaria inconsistentes com o
--    CHECK constraint abaixo. A correção aqui é SÓ desligar a divisão
--    VISUAL (3 sub-blocos de Manhã/Tarde/Noite) — nenhuma tarefa é tocada,
--    nenhum cartão é apagado, e o campo `tarefas.turno` de cada uma
--    continua gravado exatamente como estava (não é a mesma operação que
--    `alternarDivisaoEmTurnos(dividida: false)` faz na aplicação, que
--    LIMPA `turno` das tarefas — aqui a limpeza é deliberadamente omitida
--    pra não perder essa informação; se o usuário remarcar a coluna como
--    "Hoje" depois, os cartões reaparecem agrupados no turno de origem).
update colunas_kanban
set dividida_em_turnos = false
where dividida_em_turnos = true and not hoje;

-- ==========================================================================
-- Regra no banco, não só na aplicação — "garanta a regra também no
-- servidor, não apenas escondendo botão".
-- ==========================================================================
alter table colunas_kanban
  add constraint colunas_kanban_turnos_so_na_coluna_hoje
  check (not dividida_em_turnos or hoje);

-- Nenhuma mudança de RLS necessária: a policy de update já em vigor
-- ("colunas_kanban: update por quem tem acesso, exceto a fixa", migration
-- 0006) libera update de qualquer campo não-`concluido` pra quem tem acesso
-- ao projeto — cobre tanto `definirColunaHoje` quanto o `alternarDivisaoEmTurnos`
-- já existente, sem precisar de uma policy nova.

-- Rollback (se precisar reverter — perde a trava do servidor, mas não
-- apaga dado nenhum):
--
-- alter table colunas_kanban drop constraint colunas_kanban_turnos_so_na_coluna_hoje;
-- drop index colunas_kanban_uma_hoje_por_projeto;
-- alter table colunas_kanban drop column hoje;
