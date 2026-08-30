-- Gaiamum — Módulo Financeiro (Onda 3): contas fixas recorrentes, despesas
-- avulsas, anexo de comprovante e regras de categorização pra importação de
-- extrato. Isolado por workspace inteiro (não por projeto do kanban) e
-- restrito ao owner — é dado sensível (pagamento, extrato bancário) e hoje
-- só o dono do workspace usa.

-- ==========================================================================
-- Grupo 14: Contas fixas (modelo recorrente) e contas a pagar (instâncias)
-- ==========================================================================

create table contas_fixas_modelo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  nome text not null,
  valor_esperado numeric(12, 2) not null,
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  categoria text not null check (categoria in ('consumo', 'investimento', 'despesa')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table contas_fixas_modelo enable row level security;

create policy "contas_fixas_modelo: so owner"
  on contas_fixas_modelo for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index contas_fixas_modelo_tenant_id_idx on contas_fixas_modelo (tenant_id);

create table contas_a_pagar (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  conta_fixa_id uuid references contas_fixas_modelo (id) on delete set null,
  nome text not null,
  valor numeric(12, 2) not null,
  categoria text not null check (categoria in ('consumo', 'investimento', 'despesa')),
  -- primeiro dia do mês a que a cobrança se refere — usado pra não gerar a
  -- mesma conta fixa duas vezes no mesmo mês (ver índice único abaixo).
  mes_referencia date not null,
  data_vencimento date not null,
  data_pagamento date,
  pago boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table contas_a_pagar enable row level security;

create policy "contas_a_pagar: so owner"
  on contas_a_pagar for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create unique index contas_a_pagar_unica_por_mes
  on contas_a_pagar (conta_fixa_id, mes_referencia)
  where conta_fixa_id is not null;

create index contas_a_pagar_tenant_id_idx on contas_a_pagar (tenant_id);
create index contas_a_pagar_mes_referencia_idx on contas_a_pagar (tenant_id, mes_referencia);

-- ==========================================================================
-- Grupo 15: Anexo genérico (comprovante de conta a pagar hoje; desenhado
-- pra aceitar cartão de tarefa depois, sem migration nova).
-- ==========================================================================

create table anexos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  entidade_tipo text not null check (entidade_tipo in ('conta_a_pagar', 'tarefa')),
  entidade_id uuid not null,
  storage_path text not null,
  nome_arquivo text not null,
  tamanho_bytes bigint not null,
  tipo_mime text not null,
  enviado_por uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table anexos enable row level security;

-- Só cobre entidade_tipo = 'conta_a_pagar' por enquanto (owner-only, mesma
-- regra do financeiro). Quando o anexo de tarefa for construído de verdade,
-- entra uma policy nova pra entidade_tipo = 'tarefa' baseada em acesso ao
-- projeto — não modifica esta.
create policy "anexos: conta_a_pagar, so owner"
  on anexos for all
  using (
    tenant_id in (select current_tenant_ids())
    and entidade_tipo = 'conta_a_pagar'
    and current_papel(tenant_id) = 'owner'
  )
  with check (
    tenant_id in (select current_tenant_ids())
    and entidade_tipo = 'conta_a_pagar'
    and current_papel(tenant_id) = 'owner'
  );

create index anexos_entidade_idx on anexos (entidade_tipo, entidade_id);
create index anexos_tenant_id_idx on anexos (tenant_id);

-- Bucket privado — objetos em `{tenant_id}/{entidade_tipo}/{entidade_id}/arquivo`.
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

create policy "anexos bucket: select por membro do tenant no path"
  on storage.objects for select
  using (bucket_id = 'anexos' and (storage.foldername(name))[1]::uuid in (select current_tenant_ids()));

create policy "anexos bucket: insert por membro do tenant no path"
  on storage.objects for insert
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1]::uuid in (select current_tenant_ids()));

create policy "anexos bucket: delete por membro do tenant no path"
  on storage.objects for delete
  using (bucket_id = 'anexos' and (storage.foldername(name))[1]::uuid in (select current_tenant_ids()));

-- ==========================================================================
-- Grupo 16: Regras de categorização por palavra-chave (importação de CSV)
-- ==========================================================================

create table contas_categoria_regras (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  palavra_chave text not null,
  categoria text not null check (categoria in ('consumo', 'investimento', 'despesa')),
  criado_em timestamptz not null default now()
);

alter table contas_categoria_regras enable row level security;

create policy "contas_categoria_regras: so owner"
  on contas_categoria_regras for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner');

create index contas_categoria_regras_tenant_id_idx on contas_categoria_regras (tenant_id);
