-- Gaiamum — Consolidação P0 (2026-09-30): rate limit de IA, corrigindo o
-- achado da auditoria (handoff canônico, seções 11/12.6/18/21): nenhuma
-- chamada real de IA (transcrição de voz, explicação do Alinhamento
-- Gaiamum) tinha limite de taxa — um usuário autenticado podia gerar
-- chamadas pagas sem limite algum.
--
-- Contagem atômica em janela fixa ("fixed window counter"), no banco —
-- NÃO em memória do processo serverless, que reseta a cada cold start e
-- não é compartilhada entre instâncias concorrentes (é exatamente o erro
-- que este desenho evita). `ia_registrar_tentativa` faz um upsert com
-- incremento e devolve se a tentativa é permitida, tudo numa única
-- operação atômica no Postgres — mesma técnica de "claim" já usada em
-- `reivindicar_alarme` (migration 0019): o lock de linha do UPSERT serializa
-- tentativas concorrentes da mesma chave, então duas requisições
-- simultâneas nunca contam errado (uma sempre espera a outra terminar o
-- UPDATE da mesma linha).

create table ia_rate_limit (
  id uuid primary key default gen_random_uuid(),
  -- 'usuario' (rajada curta, por pessoa), 'workspace' (volume sustentado,
  -- por tenant) ou 'global' (teto de custo de todo o SaaS) — 3 camadas
  -- independentes, a chamada só é permitida se as 3 permitirem.
  escopo text not null check (escopo in ('usuario', 'workspace', 'global')),
  -- user_id, tenant_id, ou 'global' conforme o escopo acima.
  chave text not null,
  -- Início da janela truncada (por minuto pra 'usuario', por hora pra
  -- 'workspace'/'global') — cada janela nova é uma linha nova, não reseta
  -- contador (fixed window, simples e suficiente pro volume do piloto).
  janela timestamptz not null,
  contagem integer not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (escopo, chave, janela)
);

-- Índice pra limpeza futura de janelas antigas (não implementada nesta
-- rodada — tabela cresce devagar no volume de piloto; um cron de limpeza
-- periódica é um bom P1/P2 quando o volume justificar).
create index ia_rate_limit_janela_idx on ia_rate_limit (janela);

alter table ia_rate_limit enable row level security;
-- RLS ligado, propositalmente SEM nenhuma policy pro usuário comum — só o
-- service role (via a função abaixo, sempre chamada do servidor) grava e
-- lê, mesmo padrão de segurança já usado em ia_consumo_log/acesso_beta_permitido.

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

-- Mesmo cuidado da migration 0029 (reivindicar_alarme): CREATE FUNCTION
-- concede EXECUTE a PUBLIC por padrão — revoga explicitamente. O único
-- chamador legítimo (src/lib/ecc/ia-rate-limit.ts) usa o service role via
-- createServiceClient(), que ignora GRANT/REVOKE de qualquer forma; sem
-- este revoke, qualquer usuário autenticado conseguiria chamar
-- supabase.rpc("ia_registrar_tentativa", {...}) direto do navegador pra
-- inflar (ou "gastar de propósito") o contador de outro usuário/workspace,
-- fazendo-o bater no limite sem ter feito nenhuma chamada de IA real.
revoke execute on function ia_registrar_tentativa(text, text, timestamptz, integer) from public;
revoke execute on function ia_registrar_tentativa(text, text, timestamptz, integer) from anon;
revoke execute on function ia_registrar_tentativa(text, text, timestamptz, integer) from authenticated;
