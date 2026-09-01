-- Gaiamum — Agenda: compromissos manuais/por voz. Contas a pagar e tarefas
-- com prazo já têm tabela própria (só passaram a aparecer na Agenda via
-- agregação de leitura, sem migration) — esta tabela cobre só o que não
-- tinha origem nenhuma antes: criação rápida pelo botão flutuante e o
-- fluxo de voz→evento (fase seguinte).

create table eventos_agenda (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  titulo text not null,
  inicio timestamptz not null,
  fim timestamptz,
  origem text not null default 'manual' check (origem in ('manual', 'voz')),
  transcricao_bruta text,
  criado_por uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table eventos_agenda enable row level security;

-- Mesmo critério de acesso que a própria página /agenda já usa
-- (temAcessoCompleto) — não é por projeto nem owner-only.
create policy "eventos_agenda: quem tem acesso completo ao workspace"
  on eventos_agenda for all
  using (tenant_id in (select current_tenant_ids()) and tem_acesso_completo(tenant_id))
  with check (tenant_id in (select current_tenant_ids()) and tem_acesso_completo(tenant_id));

create index eventos_agenda_tenant_id_idx on eventos_agenda (tenant_id, inicio);
