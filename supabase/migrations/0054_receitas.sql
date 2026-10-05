-- Gaiamum — Receitas (entradas) no Financeiro. Até aqui o Financeiro só
-- modelava SAÍDAS (`contas_a_pagar`), e o card "Financeiro do mês" do Painel
-- geral mostrava "Entradas" sempre 0 por falta de onde cadastrar. Espelha
-- `contas_a_pagar` (mesma RLS owner-only, mesmo `mes_referencia`), pedido do
-- Fabio em 2026-10-05 (docs/gaiamum/FRENTES-RECEITAS-E-PROMPT-IA-2026-10-05.md).
--
-- Decisões (Fabio, 2026-10-05): sem receita recorrente por enquanto (receita
-- é rara e variável — fechar trabalho com cliente, venda via tráfego); vínculo
-- com projeto só como campo opcional, relatório de retorno por projeto depois.

create table receitas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  projeto_id uuid references projetos (id) on delete set null,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
  valor numeric(12, 2) not null check (valor > 0),
  -- Opcional: os dois tipos de receita que o Fabio citou (trabalho fechado
  -- com cliente = serviço, venda via tráfego = produto) + um coringa.
  categoria text check (categoria in ('servico', 'produto', 'outra')),
  -- primeiro dia do mês da data prevista — mesmo papel de
  -- `contas_a_pagar.mes_referencia`: é por ele que o mês soma as entradas.
  mes_referencia date not null,
  data_prevista date not null,
  data_recebimento date,
  recebida boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table receitas enable row level security;

-- Owner-only, como todo o Financeiro. O `with check` também impede apontar
-- `projeto_id` pra um projeto de OUTRO workspace (o FK sozinho aceitaria
-- qualquer UUID existente).
create policy "receitas: so owner"
  on receitas for all
  using (tenant_id in (select current_tenant_ids()) and current_papel(tenant_id) = 'owner')
  with check (
    tenant_id in (select current_tenant_ids())
    and current_papel(tenant_id) = 'owner'
    and (
      projeto_id is null
      or exists (select 1 from projetos p where p.id = receitas.projeto_id and p.tenant_id = receitas.tenant_id)
    )
  );

create index receitas_tenant_mes_idx on receitas (tenant_id, mes_referencia);
create index receitas_projeto_id_idx on receitas (projeto_id) where projeto_id is not null;
