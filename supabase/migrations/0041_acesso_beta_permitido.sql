-- Allowlist temporária do modo de cadastro fechado (ver MODO_CADASTRO_FECHADO
-- em garantirWorkspace(), src/lib/ecc/workspace.ts). Enquanto o cadastro
-- público estiver fechado, só e-mails aqui (ou com convite pendente pra um
-- tenant existente, checado antes) ganham workspace novo. Tabela, não env
-- var, porque o Fabio pretende autorizar pessoas aos poucos ao longo do
-- tempo, sem depender de redeploy a cada e-mail novo.

create table acesso_beta_permitido (
  email text primary key check (email = lower(email)),
  autorizado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  bloqueado boolean not null default false
);

alter table acesso_beta_permitido enable row level security;

-- Sem nenhuma policy pro usuário comum (nem select) — só o service client
-- lê/escreve, mesmo padrão de patentes_usuario/lab_tenants (migration 0027).
-- Ninguém não-autenticado descobre pela API se um e-mail está na lista.
