-- Gaiamum — Configurações de quadro (projeto): cor de fundo e arquivar.
-- Reaproveita a mesma paleta fixa de 6 cores das etiquetas, pra não criar
-- um segundo sistema de cor. RLS de `projetos` já cobre update (quem tem
-- acesso) — a restrição a gestor/owner fica na camada de aplicação, mesmo
-- padrão já usado em excluirColuna/deletarTarefa.

alter table projetos
  add column cor_fundo text not null default 'blue' check (cor_fundo in ('purple', 'teal', 'yellow', 'blue', 'coral', 'lime')),
  add column arquivado boolean not null default false;

create index projetos_arquivado_idx on projetos (tenant_id, arquivado);
