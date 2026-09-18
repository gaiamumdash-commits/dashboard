-- Gaiamum — Kanban: reordenar cartões dentro da mesma coluna. Nunca existiu
-- coluna de posição em `tarefas` (só coluna_id, sem ordem manual dentro
-- dela) — a listagem sempre saiu na ordem física do Postgres, sem nenhum
-- jeito de o usuário mudar. `double precision` (não integer) de propósito:
-- inserir um cartão entre dois outros vira 1 update (média dos vizinhos),
-- sem reindexar a coluna inteira a cada arrasto — mesma técnica usada por
-- Trello/Notion internamente.

alter table tarefas add column ordem double precision;

with numeradas as (
  select id, row_number() over (partition by coluna_id order by criado_em asc) as rn
  from tarefas
)
update tarefas t
set ordem = numeradas.rn * 1000
from numeradas
where t.id = numeradas.id;

alter table tarefas alter column ordem set not null;
alter table tarefas alter column ordem set default 1000;

create index tarefas_coluna_id_ordem_idx on tarefas (coluna_id, ordem);
