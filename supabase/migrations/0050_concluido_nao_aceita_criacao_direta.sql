-- "Concluído" é uma coluna só de chegada: nunca se cria cartão novo
-- diretamente nela, só se recebe por movimentação (arrasto ou
-- "Mover para..."). Pedido do Fabio, 2026-10-01.
--
-- A Server Action `criarTarefa` já barra isso com uma mensagem amigável em
-- português, mas aqui é o reforço real: um trigger BEFORE INSERT rejeita
-- qualquer inserção cujo `coluna_id` aponte pra uma coluna com
-- `concluido = true` — vale até pra quem contornar a Server Action e
-- escrever direto na tabela (ex.: service role mal configurado, script
-- avulso). UPDATE (mover um cartão existente pra lá) continua liberado:
-- o trigger só olha para INSERT.
create or replace function bloquear_criacao_direta_em_concluido()
returns trigger
language plpgsql
as $$
declare
  destino_concluido boolean;
begin
  select concluido into destino_concluido
  from colunas_kanban
  where id = new.coluna_id;

  if destino_concluido then
    raise exception 'A coluna "Concluído" só recebe cartões movidos de outra coluna — crie o cartão em outra coluna e transporte pra cá.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists tarefas_bloqueia_criacao_em_concluido on tarefas;

create trigger tarefas_bloqueia_criacao_em_concluido
  before insert on tarefas
  for each row
  execute function bloquear_criacao_direta_em_concluido();
