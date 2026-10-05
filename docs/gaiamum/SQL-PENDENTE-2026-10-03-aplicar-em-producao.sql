-- ============================================================================
-- Gaiamum — SQL pendente de aplicação manual em produção (2026-10-03)
-- ============================================================================
--
-- Cole este arquivo INTEIRO no SQL Editor do Supabase de produção
-- (projeto zfjtcivusdmjvdbycpjs, https://www.gaiamum.com.br) e rode de uma
-- vez — está envolvido em begin;...commit; (mesma rotina já usada pras
-- migrations 0048-0052).
--
-- O QUE É E POR QUE ESTÁ PENDENTE: a migration 0046 já existe no repo desde
-- 2026-09-30 (Consolidação P0), mas nunca foi aplicada em produção — ficou
-- pra trás por engano num dos lotes manuais anteriores, enquanto 0048-0052
-- (criadas depois) foram aplicadas normalmente. Achado confirmado por fora,
-- com `curl` direto contra a API REST de produção (não por suposição) —
-- ver handoff, checkpoint #68.
--
-- CONSEQUÊNCIA PRÁTICA de não ter a 0046: toda chamada de IA no app (criar
-- projeto com planejamento assistido, transcrição de voz, explicação do
-- Alinhamento) falha com "Não foi possível verificar o limite de uso da IA
-- agora" — a checagem de limite é fail-closed de propósito (nunca gasta
-- Gemini à toa se não conseguir checar a cota), e ela quebra porque a
-- tabela/função que ela usa não existe.
--
-- ⚠️ CORREÇÃO (2026-10-04): este arquivo chegou a incluir também a migration
-- 0047 (segurança — vazamento de e-mail entre membros do workspace), mas
-- ela foi REMOVIDA daqui: a 1ª tentativa de aplicar falhou
-- (`cannot change return type of existing function`), o que revelou que a
-- correção de segurança da 0047 JÁ está em produção — reimplementada do
-- zero, de forma independente, pela migration 0049 (aplicada há dias,
-- junto com 0048/0050/0051/0052). Nada foi alterado no banco nessa
-- tentativa (o erro abortou a transação inteira). Ver nota no topo do
-- arquivo `supabase/migrations/0047_restringe_membros_do_tenant_por_escopo.sql`.
--
-- A 0053 (nova, desta sessão) trava a coluna de foco ("Em Desenvolvimento")
-- pra não poder ser renomeada/apagada — pedido do Fabio, já testada contra
-- o Postgres de teste isolado antes de entrar aqui.
--
-- Seguro aplicar as 2 agora: nenhuma delas depende de nada criado nas
-- migrations 0048-0052 (que já estão em produção).
-- ============================================================================

begin;

-- ============================================================================
-- Migration 0046_rate_limit_ia.sql
-- ============================================================================

create table ia_rate_limit (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('usuario', 'workspace', 'global')),
  chave text not null,
  janela timestamptz not null,
  contagem integer not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (escopo, chave, janela)
);

create index ia_rate_limit_janela_idx on ia_rate_limit (janela);

alter table ia_rate_limit enable row level security;

create or replace function ia_registrar_tentativa(
  p_escopo text,
  p_chave text,
  p_janela timestamptz,
  p_limite integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contagem integer;
begin
  insert into ia_rate_limit (escopo, chave, janela, contagem)
  values (p_escopo, p_chave, p_janela, 1)
  on conflict (escopo, chave, janela)
  do update set contagem = ia_rate_limit.contagem + 1, atualizado_em = now()
  returning contagem into v_contagem;

  return v_contagem <= p_limite;
end;
$$;

revoke execute on function ia_registrar_tentativa(text, text, timestamptz, integer) from public;
revoke execute on function ia_registrar_tentativa(text, text, timestamptz, integer) from anon;
revoke execute on function ia_registrar_tentativa(text, text, timestamptz, integer) from authenticated;

-- (Migration 0047 removida daqui — já superada pela 0049, que está em
-- produção. Ver explicação no topo deste arquivo.)

-- ============================================================================
-- Migration 0053_coluna_foco_fixa.sql
-- ============================================================================

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
    (lower(trim(c.nome)) <> 'em desenvolvimento') asc,
    c.hoje asc,
    c.ordem asc
)
update colunas_kanban c
set dispara_hiperfoco = true
from candidata
where c.id = candidata.coluna_id;

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

commit;

-- ============================================================================
-- Depois de rodar: me avise (ou só mande eu conferir) — eu confirmo por
-- fora com curl direto na API, mesmo jeito que usei pra achar o problema,
-- antes de considerar fechado.
-- ============================================================================
