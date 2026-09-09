-- Gaiamum — Módulo de Marketing (Incremento 5): Roteiro de VSL no mesmo fluxo
-- manual (gerar prompt, colar resposta do Claude, salvar) dos Incrementos 3/4.
-- Roteiro falado em 7 blocos (Gancho, Identificação da dor, Agitação, Virada,
-- Prova, Oferta, CTA final), cada um com tempo estimado pra guiar a gravação.
-- Um roteiro por produto digital, com peça de conteúdo OU página de venda já
-- gerada podendo ser usada como referência opcional de tom (nunca as duas).

-- ==========================================================================
-- Grupo 24: Roteiro de VSL (texto estruturado — 7 blocos com tempo estimado)
-- ==========================================================================

create table roteiros_vsl (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  produto_digital_id uuid not null unique references produtos_digitais (id) on delete cascade,
  peca_referencia_id uuid references pecas_conteudo (id) on delete set null,
  pagina_venda_referencia_id uuid references paginas_venda (id) on delete set null,
  tempo_gancho text,
  gancho text not null,
  tempo_identificacao_dor text,
  identificacao_dor text not null,
  tempo_agitacao text,
  agitacao text not null,
  tempo_virada text,
  virada text not null,
  tempo_prova text,
  prova text,
  tempo_oferta text,
  oferta text not null,
  tempo_cta_final text,
  cta_final text not null,
  checklist_avisos text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint roteiros_vsl_referencia_unica check (
    not (peca_referencia_id is not null and pagina_venda_referencia_id is not null)
  )
);

alter table roteiros_vsl enable row level security;

create policy "roteiros_vsl: so owner"
  on roteiros_vsl for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index roteiros_vsl_tenant_id_idx on roteiros_vsl (tenant_id);
create index roteiros_vsl_produto_digital_id_idx on roteiros_vsl (produto_digital_id);
