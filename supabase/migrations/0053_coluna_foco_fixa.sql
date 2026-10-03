-- Gaiamum — Coluna de foco fixa (2026-10-03).
--
-- Pedido do Fabio: "a coluna em desenvolvimento fica fixa, e o foco só
-- entra ali — retire essa história de botar o foco em qualquer lugar".
-- Até aqui, `dispara_hiperfoco` (migration 0052) era transferível pela
-- interface (botão "Definir foco", Server Action `definirColunaHiperfoco`)
-- e a coluna podia ser renomeada/apagada normalmente, como qualquer outra.
-- A partir de agora:
--   1. A coluna marcada com `dispara_hiperfoco = true` não pode ser
--      renomeada nem apagada (nem pela interface, que parou de oferecer
--      essas ações pra ela — ver `quadro-kanban.tsx` — nem contornando a
--      Server Action, reforçado aqui no banco).
--   2. Não existe mais um jeito de MOVER a marca pra outra coluna — o botão
--      "Definir foco" e a Server Action `definirColunaHiperfoco` foram
--      removidos do código (não só escondidos). Ligar/desligar continua
--      existindo, mas é o cronômetro em si (popup ao mover um cartão pra
--      dentro/fora da coluna), não a identidade da coluna.
--
-- ==========================================================================
-- Grupo 1: corrige dado de projetos que ficaram sem coluna de foco.
--
-- A migration 0052 só promoveu "Em Desenvolvimento" quando existia exatamente
-- 1 coluna aberta com esse nome exato no projeto — quem renomeou antes (ou
-- tem 2+ colunas com esse nome) ficou sem nenhuma marcada. Até aqui dava pra
-- corrigir isso manualmente pela interface ("Definir foco"); como essa opção
-- deixou de existir, esta migration promove automaticamente, só pros
-- projetos ainda sem nenhuma coluna de foco:
--   a) a coluna chamada "Em Desenvolvimento" mais antiga (menor `ordem`),
--      se existir alguma; senão
--   b) a 1ª coluna aberta que não seja a "Hoje" (ordem crescente), ou a
--      1ª coluna aberta de todas se nenhuma for "Hoje".
-- Projeto sem nenhuma coluna aberta (caso degenerado, não deveria existir)
-- fica sem coluna de foco mesmo — nada a promover.
-- ==========================================================================

with projetos_sem_foco as (
  select p.id as projeto_id
  from projetos p
  where not exists (
    select 1 from colunas_kanban c
    where c.projeto_id = p.id and c.dispara_hiperfoco
  )
),
candidata as (
  select distinct on (c.projeto_id)
    c.id as coluna_id,
    c.projeto_id
  from colunas_kanban c
  join projetos_sem_foco psf on psf.projeto_id = c.projeto_id
  where not c.concluido
  order by
    c.projeto_id,
    -- "Em Desenvolvimento" primeiro (se existir mais de uma com esse nome,
    -- a mais antiga); senão, a 1ª coluna aberta que não é "Hoje"; senão,
    -- a 1ª coluna aberta de todas.
    (lower(trim(c.nome)) <> 'em desenvolvimento') asc,
    c.hoje asc,
    c.ordem asc
)
update colunas_kanban c
set dispara_hiperfoco = true
from candidata
where c.id = candidata.coluna_id;

-- ==========================================================================
-- Grupo 2: trava a coluna de foco no banco (2ª camada de defesa, mesmo
-- padrão de "Concluído" nas migrations 0050/0048 — a Server Action já
-- rejeita, isto cobre quem contornar a Server Action).
--
-- Cuidado deliberado com DELETE EM CASCATA: excluir um PROJETO inteiro
-- (`deletarProjeto`) apaga as colunas dele via `on delete cascade` da FK
-- `colunas_kanban.projeto_id` — isso DEVE continuar funcionando mesmo pra
-- quem tem a coluna de foco. O cascade do Postgres remove a linha de
-- `projetos` antes de disparar a cascata nas tabelas filhas (mesma
-- transação), então a trigger abaixo distingue os dois casos checando se o
-- projeto ainda existe: se não existir mais, é cascade de exclusão do
-- projeto (permite); se existir, é exclusão direta da coluna (bloqueia).
-- Testado manualmente contra o Postgres de teste isolado antes de publicar
-- (excluir só a coluna de foco → rejeitado; excluir o projeto inteiro →
-- coluna de foco removida normalmente junto com o resto).
-- ==========================================================================

create or replace function colunas_kanban_bloqueia_mudanca_coluna_foco()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.dispara_hiperfoco and exists (select 1 from projetos p where p.id = OLD.projeto_id) then
      raise exception 'A coluna de foco ("Em Desenvolvimento") é fixa e não pode ser apagada.' using errcode = 'P0001';
    end if;
    return OLD;
  end if;

  -- UPDATE: só o nome é travado. `ordem` (reordenar), `dividida_em_turnos`
  -- e `hoje` continuam livres — "fixa" aqui é sobre identidade/existência,
  -- não sobre posição no quadro.
  if OLD.dispara_hiperfoco and NEW.nome is distinct from OLD.nome then
    raise exception 'A coluna de foco ("Em Desenvolvimento") é fixa e não pode ser renomeada.' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists colunas_kanban_coluna_foco_fixa on colunas_kanban;

create trigger colunas_kanban_coluna_foco_fixa
  before update or delete on colunas_kanban
  for each row
  execute function colunas_kanban_bloqueia_mudanca_coluna_foco();

-- Rollback:
--
-- drop trigger if exists colunas_kanban_coluna_foco_fixa on colunas_kanban;
-- drop function if exists colunas_kanban_bloqueia_mudanca_coluna_foco();
-- (Grupo 1 não tem rollback — era uma correção de dado, não uma estrutura nova.)
