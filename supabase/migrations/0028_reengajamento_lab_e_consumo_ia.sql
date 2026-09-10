-- Etapa 5 do Contexto Vivo: reengajamento do Gaiamum Lab (e-mail único
-- depois de 48h sem atividade, sem punição — progresso nunca é apagado) +
-- log de consumo de IA (tokens usados por chamada, pra alimentar o painel
-- de analítica restrito ao dono do SaaS, cruzando todos os tenants).

-- ==========================================================================
-- Grupo 28a: lab_tenants ganha o controle de reengajamento. Reaproveita a
-- tabela já 1:1 por usuário em vez de criar uma tabela nova só pra um
-- timestamp. NULL = nunca enviado; o claim de envio é um UPDATE condicional
-- (WHERE reengajamento_enviado_em IS NULL) feito pelo cron — mesmo espírito
-- do reivindicar_alarme, sem precisar de função SQL dedicada (volume
-- esperado baixo, sem concorrência real aqui).
-- ==========================================================================

alter table lab_tenants
  add column reengajamento_enviado_em timestamptz;

-- índice parcial: só indexa quem ainda é elegível, mantém a consulta do
-- cron/painel barata conforme a base cresce.
create index lab_tenants_sem_reengajamento_idx
  on lab_tenants (criado_em)
  where reengajamento_enviado_em is null;

-- ==========================================================================
-- Grupo 28b: notificacoes_app ganha o tipo 'lab_reengajamento' — o cron
-- grava sino in-app além do e-mail (mesmo padrão de disparar-alarmes), e
-- vira o canal de fallback enquanto o domínio gaiamum.com.br não verifica
-- no Resend. Mesmo ALTER aditivo já usado em 0023 (que acrescentou 'equipe'
-- ao check original de 0020, só 'alarme').
-- ==========================================================================

alter table notificacoes_app
  drop constraint notificacoes_app_tipo_check;

alter table notificacoes_app
  add constraint notificacoes_app_tipo_check
  check (tipo in ('alarme', 'equipe', 'lab_reengajamento'));

-- ==========================================================================
-- Grupo 28c: ia_consumo_log — cada chamada real a um provedor de IA
-- (sucesso ou falha), com os tokens usados. `provedor` já nasce fechado em
-- 'gemini' — extensível depois com o mesmo padrão ALTER aditivo (sem
-- redesenho) no dia em que outro provedor entrar. RLS ligado,
-- propositalmente SEM nenhuma policy: nem o dono da linha lê via
-- anon/authenticated — só o service role (bypassa RLS) escreve (call site
-- em explicacao-alinhamento.ts) e lê (painel do dono do SaaS). Mais
-- restritivo que lab_tenants/lab_passos/patentes_usuario porque a leitura
-- aqui é sempre cross-tenant, nunca "o usuário vê a própria".
-- ==========================================================================

create table ia_consumo_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  projeto_id uuid references projetos (id) on delete set null,
  provedor text not null check (provedor in ('gemini')),
  modelo text not null,
  sucesso boolean not null,
  erro text,
  prompt_tokens integer,
  candidates_tokens integer,
  total_tokens integer,
  criado_em timestamptz not null default now()
);

alter table ia_consumo_log enable row level security;

create index ia_consumo_log_criado_em_idx on ia_consumo_log (criado_em desc);
create index ia_consumo_log_user_id_idx on ia_consumo_log (user_id);
