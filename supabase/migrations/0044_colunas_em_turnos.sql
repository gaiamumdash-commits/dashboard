-- Gaiamum — divisão opcional de uma coluna do Kanban em 3 sub-seções fixas
-- (Manhã/Tarde/Noite), pedido do Fabio pra organizar o dia dentro de uma
-- coluna qualquer (ex.: "Em desenvolvimento") sem precisar criar 3 colunas
-- novas. Reversível: desativar `dividida_em_turnos` limpa `turno` de todas
-- as tarefas da coluna (feito na Server Action `alternarDivisaoEmTurnos`,
-- não aqui) e elas voltam a se comportar como uma coluna normal.
--
-- `turno` fica em `tarefas` (não em `colunas_kanban`) porque é o cartão que
-- pertence a um turno, não a coluna — a coluna só guarda se está dividida.

alter table colunas_kanban add column dividida_em_turnos boolean not null default false;

alter table tarefas add column turno text check (turno in ('manha', 'tarde', 'noite'));
