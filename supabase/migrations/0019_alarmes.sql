-- Gaiamum — Alarme configurável por item: conta a pagar, tarefa com prazo
-- ou compromisso manual/voz da Agenda. Polimórfico, mesmo padrão já usado
-- em `anexos` (migration 0008) — evita 3 implementações paralelas de
-- "campo de antecedência + upsert" e deixa a porta aberta pra um 4º tipo de
-- entidade amanhã sem migration nova.
--
-- De propósito, NÃO congela a data de referência do alarme na criação —
-- o cron (fase seguinte) relê a data atual da entidade de origem a cada
-- execução e usa `disparado_para_referencia` só pra saber se já disparou
-- PARA AQUELE VALOR. Editar o vencimento/prazo depois não deixa o alarme
-- desatualizado, e se a data mudar depois de já ter disparado, dispara de
-- novo pra nova data — sem trigger nem migration extra.

create table alarmes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  entidade_tipo text not null check (entidade_tipo in ('conta_a_pagar', 'tarefa', 'evento_agenda')),
  entidade_id uuid not null,
  antecedencia_min integer not null check (antecedencia_min > 0),
  criado_por uuid not null references auth.users (id) on delete cascade,
  disparado_em timestamptz,
  disparado_para_referencia timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (entidade_tipo, entidade_id)
);

alter table alarmes enable row level security;

-- Mesma regra de acesso de cada tipo de entidade: conta_a_pagar é
-- owner-only (mesma regra do Financeiro), tarefa exige acesso ao projeto
-- (tem_acesso_ao_projeto, já existe desde a migration 0003), evento_agenda
-- só exige acesso completo ao workspace (mesma regra da própria Agenda).
create policy "alarmes: conforme acesso a entidade"
  on alarmes for all
  using (
    tenant_id in (select current_tenant_ids())
    and (
      (entidade_tipo = 'conta_a_pagar' and current_papel(tenant_id) = 'owner')
      or (entidade_tipo = 'evento_agenda' and tem_acesso_completo(tenant_id))
      or (entidade_tipo = 'tarefa' and exists (
            select 1 from tarefas t
            where t.id = alarmes.entidade_id
              and tem_acesso_ao_projeto(t.projeto_id, alarmes.tenant_id)
          ))
    )
  )
  with check (
    tenant_id in (select current_tenant_ids())
    and (
      (entidade_tipo = 'conta_a_pagar' and current_papel(tenant_id) = 'owner')
      or (entidade_tipo = 'evento_agenda' and tem_acesso_completo(tenant_id))
      or (entidade_tipo = 'tarefa' and exists (
            select 1 from tarefas t
            where t.id = alarmes.entidade_id
              and tem_acesso_ao_projeto(t.projeto_id, alarmes.tenant_id)
          ))
    )
  );

create index alarmes_entidade_idx on alarmes (entidade_tipo, entidade_id);
create index alarmes_tenant_id_idx on alarmes (tenant_id);

-- "Claim" atômico usado pelo cron de disparo (fase seguinte): o UPDATE
-- só afeta a linha se `disparado_para_referencia` ainda não é este valor —
-- Postgres serializa UPDATEs concorrentes na mesma linha via lock de linha,
-- então rodar o cron da Vercel e o `pg_cron` de reforço ao mesmo tempo não
-- duplica notificação (só quem "ganha" a corrida vê `row_count > 0`).
create or replace function reivindicar_alarme(p_alarme_id uuid, p_referencia timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  linhas_afetadas int;
begin
  update alarmes
  set disparado_em = now(), disparado_para_referencia = p_referencia
  where id = p_alarme_id
    and disparado_para_referencia is distinct from p_referencia;
  get diagnostics linhas_afetadas = row_count;
  return linhas_afetadas > 0;
end;
$$;
