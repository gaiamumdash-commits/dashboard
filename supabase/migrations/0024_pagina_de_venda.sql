-- Gaiamum — Módulo de Marketing (Incremento 4): Página de Venda no fluxo
-- manual (gerar prompt, colar resposta do Claude, salvar) — mesmo padrão do
-- Incremento 3 (Mandala de Anúncios). Uma página por produto digital (é a
-- página oficial que recebe o tráfego daquele produto), com uma peça de
-- conteúdo já gerada podendo ser usada como referência opcional de tom.

-- ==========================================================================
-- Grupo 23: Página de venda (texto estruturado — headline, blocos, prova
-- social, preço, CTA) — sem page-builder nem publicação real de URL.
-- ==========================================================================

create table paginas_venda (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  produto_digital_id uuid not null unique references produtos_digitais (id) on delete cascade,
  peca_referencia_id uuid references pecas_conteudo (id) on delete set null,
  headline text not null,
  subheadline text not null,
  introducao text not null,
  beneficios text not null,
  oferta text not null,
  prova_social text,
  garantia text,
  cta_final text not null,
  checklist_avisos text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table paginas_venda enable row level security;

create policy "paginas_venda: so owner"
  on paginas_venda for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index paginas_venda_tenant_id_idx on paginas_venda (tenant_id);
create index paginas_venda_produto_digital_id_idx on paginas_venda (produto_digital_id);
