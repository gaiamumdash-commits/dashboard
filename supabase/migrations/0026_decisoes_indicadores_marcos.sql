-- Gaiamum — Contexto Vivo / Visão 360° (Etapa 1): fundação de dados, sem IA.
-- resultado_esperado em projetos, tabela decisoes, flag is_marco em tarefas
-- (reaproveita o kanban em vez de criar tabela de marcos) e tabela
-- indicadores simples. RLS "só owner" em decisoes/indicadores, igual
-- financeiro e roteiros_vsl — quem decide e mede resultado de projeto é o
-- dono do workspace nesta etapa (sem granularidade por projeto ainda).

-- ==========================================================================
-- Grupo 26a: projetos.resultado_esperado — texto livre, sem RLS nova (usa a
-- policy já existente de projetos)
-- ==========================================================================

alter table projetos add column resultado_esperado text;

-- ==========================================================================
-- Grupo 26b: tarefas.is_marco — reaproveita o kanban em vez de tabela nova
-- ==========================================================================

alter table tarefas add column is_marco boolean not null default false;

-- ==========================================================================
-- Grupo 26c: decisoes — registro de decisão de projeto (título, decisão,
-- motivo, impacto esperado), com meta SMART como referência opcional
-- ==========================================================================

create table decisoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  projeto_id uuid not null references projetos (id) on delete cascade,
  meta_smart_id uuid references metas_smart (id) on delete set null,
  titulo text not null,
  decisao text not null,
  motivo text not null,
  impacto_esperado text not null,
  autor uuid not null references auth.users (id) on delete cascade,
  data date not null default current_date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table decisoes enable row level security;

create policy "decisoes: so owner"
  on decisoes for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index decisoes_tenant_id_idx on decisoes (tenant_id);
create index decisoes_projeto_id_idx on decisoes (projeto_id);
create index decisoes_meta_smart_id_idx on decisoes (meta_smart_id);

-- ==========================================================================
-- Grupo 26d: indicadores — indicador numérico simples por projeto
-- ==========================================================================

create table indicadores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  projeto_id uuid not null references projetos (id) on delete cascade,
  nome text not null,
  valor_atual numeric not null default 0,
  meta numeric not null,
  unidade text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table indicadores enable row level security;

create policy "indicadores: so owner"
  on indicadores for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index indicadores_tenant_id_idx on indicadores (tenant_id);
create index indicadores_projeto_id_idx on indicadores (projeto_id);
