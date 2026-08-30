-- Gaiamum — Colaboração em equipe: convite de membro, atribuição de tarefa,
-- permissões reais owner/member.

-- ==========================================================================
-- Grupo 5: Convites de workspace
-- ==========================================================================

create table convites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  email text not null,
  papel text not null default 'member' check (papel in ('owner', 'member')),
  token uuid not null default gen_random_uuid(),
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'cancelado')),
  convidado_por uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '7 days')
);

-- Só um convite pendente por e-mail dentro do mesmo workspace.
create unique index convites_pendente_unico
  on convites (tenant_id, lower(email))
  where status = 'pendente';

create index convites_tenant_id_idx on convites (tenant_id);
create unique index convites_token_idx on convites (token);

alter table convites enable row level security;

create policy "convites: membros veem convites do proprio workspace"
  on convites for select
  using (tenant_id in (select current_tenant_ids()));

create policy "convites: so owner convida"
  on convites for insert
  with check (
    tenant_id in (select current_tenant_ids())
    and current_papel(tenant_id) = 'owner'
  );

create policy "convites: so owner cancela"
  on convites for update
  using (
    tenant_id in (select current_tenant_ids())
    and current_papel(tenant_id) = 'owner'
  )
  with check (
    tenant_id in (select current_tenant_ids())
    and current_papel(tenant_id) = 'owner'
  );

-- ==========================================================================
-- Grupo 6: Permissões reais sobre memberships (antes só existia SELECT)
-- ==========================================================================

create policy "memberships: so owner remove membro"
  on memberships for delete
  using (
    tenant_id in (select current_tenant_ids())
    and current_papel(tenant_id) = 'owner'
  );

create policy "memberships: so owner muda papel"
  on memberships for update
  using (
    tenant_id in (select current_tenant_ids())
    and current_papel(tenant_id) = 'owner'
  )
  with check (
    tenant_id in (select current_tenant_ids())
    and current_papel(tenant_id) = 'owner'
  );

-- Devolve e-mail dos membros de um tenant — auth.users não é exposta via
-- RLS normal, então isso precisa de security definer, restrito a quem já é
-- membro do próprio tenant (reaproveita current_tenant_ids()).
create or replace function membros_do_tenant(t_id uuid)
returns table (user_id uuid, email text, papel text)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, u.email, m.papel
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = t_id
    and t_id in (select current_tenant_ids());
$$;

-- ==========================================================================
-- Grupo 7: Cartão de tarefa completo (benchmark Trello) — membros
-- (múltiplos, não um responsável só), checklist, data de início.
-- ==========================================================================

alter table tarefas
  add column data_inicio date;

create table tarefa_membros (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tarefa_id uuid not null references tarefas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (tarefa_id, user_id)
);

alter table tarefa_membros enable row level security;

create policy "tarefa_membros: isolado por workspace"
  on tarefa_membros for all
  using (tenant_id in (select current_tenant_ids()))
  with check (tenant_id in (select current_tenant_ids()));

create index tarefa_membros_tarefa_id_idx on tarefa_membros (tarefa_id);
create index tarefa_membros_tenant_id_idx on tarefa_membros (tenant_id);

create table tarefa_checklist_itens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tarefa_id uuid not null references tarefas (id) on delete cascade,
  texto text not null,
  concluido boolean not null default false,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

alter table tarefa_checklist_itens enable row level security;

create policy "tarefa_checklist_itens: isolado por workspace"
  on tarefa_checklist_itens for all
  using (tenant_id in (select current_tenant_ids()))
  with check (tenant_id in (select current_tenant_ids()));

create index tarefa_checklist_itens_tarefa_id_idx on tarefa_checklist_itens (tarefa_id);
create index tarefa_checklist_itens_tenant_id_idx on tarefa_checklist_itens (tenant_id);
