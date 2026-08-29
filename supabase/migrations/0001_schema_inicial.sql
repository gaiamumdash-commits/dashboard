-- Gaiamum — schema inicial (fundação + Módulo 0-2)
-- Multi-tenant via tenant_id + RLS, mesmo padrão do UltraQuadras.

-- ==========================================================================
-- Grupo 1: Workspace (tenant) e Acesso
-- ==========================================================================

create table tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references tenants (id) on delete cascade,
  papel text not null check (papel in ('owner', 'member')),
  criado_em timestamptz not null default now(),
  unique (user_id, tenant_id)
);

-- Helper: tenants (workspaces) do usuário autenticado (usada nas policies de RLS abaixo).
create or replace function current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from memberships where user_id = auth.uid();
$$;

-- Helper: papel do usuário autenticado dentro de um tenant específico.
create or replace function current_papel(t_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from memberships where user_id = auth.uid() and tenant_id = t_id limit 1;
$$;

alter table tenants enable row level security;
alter table memberships enable row level security;

create policy "tenants: membros veem o proprio workspace"
  on tenants for select
  using (id in (select current_tenant_ids()));

create policy "memberships: membros veem membros do mesmo workspace"
  on memberships for select
  using (tenant_id in (select current_tenant_ids()));

-- ==========================================================================
-- Grupo 2: Módulo 0 — Onboarding & Metas SMART
-- ==========================================================================

create table metas_smart (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  horizonte text not null check (horizonte in ('medio_prazo', 'longo_prazo')),
  visao_macro text not null,
  specific text not null,
  measurable text not null,
  attainable text not null,
  relevant text not null,
  time_bound text not null,
  criado_em timestamptz not null default now()
);

alter table metas_smart enable row level security;

create policy "metas_smart: isolado por workspace"
  on metas_smart for all
  using (tenant_id in (select current_tenant_ids()))
  with check (tenant_id in (select current_tenant_ids()));

-- ==========================================================================
-- Grupo 3: Módulo 1 — Projetos
-- ==========================================================================

create table projetos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  nome text not null,
  descricao text,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'concluido')),
  meta_smart_id uuid references metas_smart (id) on delete set null,
  criado_em timestamptz not null default now()
);

alter table projetos enable row level security;

create policy "projetos: isolado por workspace"
  on projetos for all
  using (tenant_id in (select current_tenant_ids()))
  with check (tenant_id in (select current_tenant_ids()));

-- ==========================================================================
-- Grupo 4: Módulo 2 — Tarefas (Kanban)
-- ==========================================================================

create table tarefas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  projeto_id uuid not null references projetos (id) on delete cascade,
  titulo text not null,
  descricao text,
  status text not null default 'backlog' check (status in ('backlog', 'em_execucao', 'concluido')),
  prioridade text not null default 'P3' check (prioridade in ('P1', 'P2', 'P3', 'P4')),
  tag text,
  data_limite date,
  tempo_estimado_min integer,
  tempo_realizado_min integer,
  criado_em timestamptz not null default now()
);

alter table tarefas enable row level security;

create policy "tarefas: isolado por workspace"
  on tarefas for all
  using (tenant_id in (select current_tenant_ids()))
  with check (tenant_id in (select current_tenant_ids()));

create index tarefas_projeto_id_idx on tarefas (projeto_id);
create index tarefas_tenant_id_idx on tarefas (tenant_id);
create index projetos_tenant_id_idx on projetos (tenant_id);
create index metas_smart_tenant_id_idx on metas_smart (tenant_id);
