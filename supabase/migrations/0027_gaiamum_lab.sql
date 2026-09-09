-- Gaiamum Lab (Etapa 4 do Contexto Vivo): onboarding gamificado com o case
-- fictício "Café Mangue" + trilha de patentes (Explorador → Estrategista →
-- Estrategista Master) que atravessa 2 tenants por usuário (o do Lab e o
-- real). Por isso, diferente do resto do schema (isolado por tenant_id),
-- as 3 tabelas abaixo são chaveadas por user_id — patente e progresso do
-- Lab são conquista de CONTA, não de workspace.

-- ==========================================================================
-- Grupo 27a: lab_tenants — mapeia cada usuário ao seu tenant pessoal do Lab
-- (1:1). Fonte da verdade tanto pra garantirTenantLab() achar/criar esse
-- tenant quanto pra saber, se precisar no futuro, que um tenant é o do Lab.
-- ==========================================================================

create table lab_tenants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null unique references tenants (id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table lab_tenants enable row level security;

create policy "lab_tenants: usuario ve o proprio"
  on lab_tenants for select
  using (user_id = auth.uid());

-- sem policy de insert/update/delete pro usuário comum: só o service client
-- (garantirTenantLab) grava, mesmo padrão de notificacoes_app.

-- ==========================================================================
-- Grupo 27b: lab_passos — progresso do roteiro guiado dentro de um módulo do
-- Lab. `modulo` já existe como coluna (só 'nucleo' por enquanto) pra quando
-- entrarem os módulos futuros (Financeiro/Marketing/Colaboração) sem
-- precisar redesenhar a tabela.
-- ==========================================================================

create table lab_passos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  modulo text not null default 'nucleo' check (modulo in ('nucleo')),
  passo text not null check (passo in ('explorar_quadro', 'concluir')),
  concluido_em timestamptz not null default now(),
  unique (user_id, modulo, passo)
);

alter table lab_passos enable row level security;

create policy "lab_passos: usuario ve os proprios"
  on lab_passos for select
  using (user_id = auth.uid());

-- sem policy de insert/update/delete pro usuário comum — só service client.

-- ==========================================================================
-- Grupo 27c: patentes_usuario — trilha Explorador → Estrategista →
-- Estrategista Master. `contexto` guarda de onde veio a conquista (ex.: qual
-- projeto real gerou o Master) só pra auditoria/exibição, nunca pra lógica
-- de autorização. Patentes reais futuras (Financeiro, Marketing,
-- Colaboração) entram depois com um ALTER aditivo neste CHECK, mesmo padrão
-- já usado em notificacoes_app (0020 criou só 'alarme', 0023 estendeu pra
-- incluir 'equipe') — não é redesenho de tabela.
-- ==========================================================================

create table patentes_usuario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  codigo text not null check (codigo in ('explorador', 'estrategista', 'master')),
  conquistada_em timestamptz not null default now(),
  contexto jsonb,
  unique (user_id, codigo)
);

alter table patentes_usuario enable row level security;

create policy "patentes_usuario: usuario ve as proprias"
  on patentes_usuario for select
  using (user_id = auth.uid());

-- sem policy de insert/update/delete pro usuário comum — só service client
-- (concederPatente) grava, idêntico ao padrão de notificacoes_app.

create index lab_passos_user_id_idx on lab_passos (user_id);
create index patentes_usuario_user_id_idx on patentes_usuario (user_id);
