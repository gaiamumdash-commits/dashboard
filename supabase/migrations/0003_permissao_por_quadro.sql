-- Gaiamum — Permissão por quadro (projeto): convite pode ser vinculado a um
-- projeto específico (a pessoa só enxerga aquele quadro, não a plataforma
-- inteira), cada projeto tem um gestor, e só o gestor apaga cartão ou quadro.

-- ==========================================================================
-- Grupo 8: Membros de um projeto específico
-- ==========================================================================

create table projeto_membros (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  projeto_id uuid not null references projetos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel text not null default 'usuario' check (papel in ('gestor', 'usuario')),
  criado_em timestamptz not null default now(),
  unique (projeto_id, user_id)
);

alter table projeto_membros enable row level security;

-- Helper: o usuário autenticado é gestor deste projeto?
create or replace function eh_gestor_do_projeto(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from projeto_membros
    where projeto_id = p_id and user_id = auth.uid() and papel = 'gestor'
  );
$$;

-- Helper: o usuário autenticado enxerga este projeto (é gestor/usuário dele,
-- ou é owner do tenant inteiro)?
create or replace function tem_acesso_ao_projeto(p_id uuid, t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    current_papel(t_id) = 'owner'
    or exists (select 1 from projeto_membros where projeto_id = p_id and user_id = auth.uid());
$$;

create policy "projeto_membros: visivel para quem tem acesso ao projeto"
  on projeto_membros for select
  using (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id));

create policy "projeto_membros: gestor do projeto ou owner do tenant gerencia"
  on projeto_membros for all
  using (
    tenant_id in (select current_tenant_ids())
    and (current_papel(tenant_id) = 'owner' or eh_gestor_do_projeto(projeto_id))
  )
  with check (
    tenant_id in (select current_tenant_ids())
    and (current_papel(tenant_id) = 'owner' or eh_gestor_do_projeto(projeto_id))
  );

create index projeto_membros_projeto_id_idx on projeto_membros (projeto_id);
create index projeto_membros_tenant_id_idx on projeto_membros (tenant_id);

-- ==========================================================================
-- Grupo 9: RLS de projetos e tarefas — restringe por projeto, não só tenant.
-- Substitui as policies "for all" originais por policies por operação.
-- ==========================================================================

drop policy "projetos: isolado por workspace" on projetos;

create policy "projetos: select por quem tem acesso"
  on projetos for select
  using (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(id, tenant_id));

create policy "projetos: insert por qualquer membro do tenant"
  on projetos for insert
  with check (tenant_id in (select current_tenant_ids()));

create policy "projetos: update por quem tem acesso"
  on projetos for update
  using (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(id, tenant_id))
  with check (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(id, tenant_id));

create policy "projetos: delete so gestor ou owner"
  on projetos for delete
  using (
    tenant_id in (select current_tenant_ids())
    and (current_papel(tenant_id) = 'owner' or eh_gestor_do_projeto(id))
  );

drop policy "tarefas: isolado por workspace" on tarefas;

create policy "tarefas: select por quem tem acesso ao projeto"
  on tarefas for select
  using (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id));

create policy "tarefas: insert por quem tem acesso ao projeto"
  on tarefas for insert
  with check (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id));

create policy "tarefas: update por quem tem acesso ao projeto"
  on tarefas for update
  using (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id))
  with check (tenant_id in (select current_tenant_ids()) and tem_acesso_ao_projeto(projeto_id, tenant_id));

create policy "tarefas: delete so gestor do projeto ou owner"
  on tarefas for delete
  using (
    tenant_id in (select current_tenant_ids())
    and (current_papel(tenant_id) = 'owner' or eh_gestor_do_projeto(projeto_id))
  );

-- ==========================================================================
-- Grupo 10: Convite ligado a um projeto específico (opcional)
-- ==========================================================================

alter table convites
  add column projeto_id uuid references projetos (id) on delete cascade;

-- Além do owner do tenant (já coberto pela policy original), o gestor de um
-- projeto também pode convidar gente pro próprio quadro.
create policy "convites: gestor do projeto convida para o proprio projeto"
  on convites for insert
  with check (
    tenant_id in (select current_tenant_ids())
    and projeto_id is not null
    and eh_gestor_do_projeto(projeto_id)
  );

-- ==========================================================================
-- Grupo 11: Escopo do membership — quem entrou convidado só pra um projeto
-- não deve enxergar o resto da plataforma (Metas SMART, Equipe do
-- workspace inteiro), só o(s) quadro(s) em que foi colocado.
-- ==========================================================================

alter table memberships
  add column escopo text not null default 'completo' check (escopo in ('completo', 'projeto'));

create or replace function tem_acesso_completo(t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where tenant_id = t_id and user_id = auth.uid() and escopo = 'completo'
  );
$$;

drop policy "metas_smart: isolado por workspace" on metas_smart;

create policy "metas_smart: so quem tem acesso completo ao workspace"
  on metas_smart for all
  using (tenant_id in (select current_tenant_ids()) and tem_acesso_completo(tenant_id))
  with check (tenant_id in (select current_tenant_ids()) and tem_acesso_completo(tenant_id));
