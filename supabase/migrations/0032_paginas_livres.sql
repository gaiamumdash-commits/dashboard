-- Gaiamum — Página livre: bloco de notas estilo Notion por projeto, lista
-- simples sem hierarquia, editável por qualquer um com acesso ao projeto
-- (Padrão A, igual tarefas — não Padrão B "só owner" de decisões/indicadores).

create table paginas_livres (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  projeto_id uuid not null references projetos (id) on delete cascade,
  titulo text not null default 'Sem título',
  conteudo jsonb not null default '[]'::jsonb,
  criado_por uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table paginas_livres enable row level security;

create policy "paginas_livres: select por quem tem acesso ao projeto"
  on paginas_livres for select
  using (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id));

create policy "paginas_livres: insert por quem tem acesso ao projeto"
  on paginas_livres for insert
  with check (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id));

create policy "paginas_livres: update por quem tem acesso ao projeto"
  on paginas_livres for update
  using (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id))
  with check (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id));

create policy "paginas_livres: delete so gestor do projeto ou owner"
  on paginas_livres for delete
  using (
    tenant_id in (select current_tenant_ids())
    and (current_papel(tenant_id) = 'owner' or eh_gestor_do_projeto(projeto_id))
  );

create index paginas_livres_tenant_id_idx on paginas_livres (tenant_id);
create index paginas_livres_projeto_id_idx on paginas_livres (projeto_id);
