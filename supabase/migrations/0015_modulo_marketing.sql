-- Gaiamum — Módulo de Marketing / Criação de Produto Digital (Incremento 1):
-- Perfil do Negócio, Produtos Digitais e Avatar do Cliente Ideal, cadastro
-- manual (sem IA ainda). Isolado por workspace inteiro e restrito ao owner —
-- é estratégia de negócio, mesma regra do Financeiro. `entrevistas_ia` nasce
-- aqui também (schema pronto, só populada de verdade num incremento futuro
-- quando a entrevista guiada por IA for construída) pra não precisar mexer
-- em RLS de novo depois.

-- ==========================================================================
-- Grupo 17: Perfil do negócio (1 por workspace por enquanto)
-- ==========================================================================

create table perfis_negocio (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  nome_negocio text not null,
  nicho text not null,
  site_url text,
  instagram text,
  tom_de_voz text,
  resumo_diagnostico text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table perfis_negocio enable row level security;

create policy "perfis_negocio: so owner"
  on perfis_negocio for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create unique index perfis_negocio_tenant_id_unico on perfis_negocio (tenant_id);

-- ==========================================================================
-- Grupo 18: Produtos digitais
-- ==========================================================================

create table produtos_digitais (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  nome text not null,
  formato text not null check (formato in ('curso', 'ebook', 'mentoria', 'template', 'comunidade', 'outro')),
  promessa text,
  preco numeric(12, 2),
  status text not null default 'rascunho' check (status in ('rascunho', 'validando', 'ativo', 'pausado')),
  criado_em timestamptz not null default now()
);

alter table produtos_digitais enable row level security;

create policy "produtos_digitais: so owner"
  on produtos_digitais for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index produtos_digitais_tenant_id_idx on produtos_digitais (tenant_id);

-- ==========================================================================
-- Grupo 19: Avatar do Cliente Ideal (1:1 com produto digital)
-- ==========================================================================

create table avatares_cliente (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  produto_digital_id uuid not null unique references produtos_digitais (id) on delete cascade,
  dor_unificada text,
  gatilho_compra text,
  criado_em timestamptz not null default now()
);

alter table avatares_cliente enable row level security;

create policy "avatares_cliente: so owner"
  on avatares_cliente for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index avatares_cliente_tenant_id_idx on avatares_cliente (tenant_id);

-- Dores e desejos normalizados como child table (mesmo padrão de
-- tarefa_checklist_itens) em vez de colunas dor_1..dor_5 soltas.
create table avatar_itens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  avatar_id uuid not null references avatares_cliente (id) on delete cascade,
  tipo text not null check (tipo in ('dor', 'desejo')),
  texto text not null,
  ordem smallint not null,
  criado_em timestamptz not null default now()
);

alter table avatar_itens enable row level security;

create policy "avatar_itens: so owner"
  on avatar_itens for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index avatar_itens_avatar_id_idx on avatar_itens (avatar_id);
create index avatar_itens_tenant_id_idx on avatar_itens (tenant_id);

-- ==========================================================================
-- Grupo 20: Entrevista guiada por IA (schema pronto, populada num
-- incremento futuro) — transcript em jsonb é exceção justificada: é o
-- único dado do projeto que é genuinamente uma conversa de forma variável.
-- ==========================================================================

create table entrevistas_ia (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  produto_digital_id uuid references produtos_digitais (id) on delete set null,
  estagio_atual text not null default 'situacao'
    check (estagio_atual in ('situacao', 'problema', 'implicacao', 'necessidade', 'concluida')),
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'concluida', 'abandonada')),
  transcript jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table entrevistas_ia enable row level security;

create policy "entrevistas_ia: so owner"
  on entrevistas_ia for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index entrevistas_ia_tenant_id_idx on entrevistas_ia (tenant_id);
