-- Gaiamum — Módulo de Marketing (Incremento 3): geração de ideias e copy de
-- anúncio (Mandala) no fluxo manual — gerar prompt, colar resposta do
-- Claude, salvar. Mesmo padrão de RLS "só owner" de 0015 (é estratégia de
-- negócio). Nenhuma tabela nova pro quadro de produção — reaproveita
-- `projetos`/`colunas_kanban`/`tarefas`/`etiquetas`, já genéricos.

-- ==========================================================================
-- Grupo 21: Ideias de conteúdo (lote de ~12 por geração, um tipo de
-- anúncio por lote — `lote_id` só agrupa, sem precisar de tabela própria)
-- ==========================================================================

create table ideias_conteudo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  produto_digital_id uuid not null references produtos_digitais (id) on delete cascade,
  lote_id uuid not null,
  numero smallint not null,
  tipo_anuncio text not null
    check (tipo_anuncio in ('ultra_segmentado', 'problema_solucao', 'pesquisa_cientifica', 'atualidades_trend')),
  titulo_gancho text not null,
  checklist_avisos text,
  criado_em timestamptz not null default now()
);

alter table ideias_conteudo enable row level security;

create policy "ideias_conteudo: so owner"
  on ideias_conteudo for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index ideias_conteudo_tenant_id_idx on ideias_conteudo (tenant_id);
create index ideias_conteudo_produto_digital_id_idx on ideias_conteudo (produto_digital_id);

-- ==========================================================================
-- Grupo 22: Peça de conteúdo (copy completa a partir de uma ideia escolhida)
-- ==========================================================================

create table pecas_conteudo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  produto_digital_id uuid not null references produtos_digitais (id) on delete cascade,
  ideia_id uuid not null unique references ideias_conteudo (id) on delete cascade,
  gancho text not null,
  paragrafo_1 text not null,
  paragrafo_2 text not null,
  cta_descoberta text not null,
  cta_relacionamento text not null,
  cta_conversao text not null,
  cta_remarketing text not null,
  cta_escolhida text check (cta_escolhida in ('descoberta', 'relacionamento', 'conversao', 'remarketing')),
  checklist_avisos text,
  tarefa_id uuid references tarefas (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table pecas_conteudo enable row level security;

create policy "pecas_conteudo: so owner"
  on pecas_conteudo for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index pecas_conteudo_tenant_id_idx on pecas_conteudo (tenant_id);
create index pecas_conteudo_produto_digital_id_idx on pecas_conteudo (produto_digital_id);
