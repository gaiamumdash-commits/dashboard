-- Gaiamum — Mapa mental, fase 3 (2026-10-10): limite do "Resumo por
-- e-mail". Cada envio vira uma linha; a Server Action conta as linhas da
-- própria pessoa antes de mandar (1 por minuto, 20 por dia). O e-mail vai
-- SÓ pra quem pediu (o endereço sai da sessão, nunca do navegador).
--
-- Só a própria pessoa vê/grava as próprias linhas. Nada de conteúdo do
-- mapa fica aqui — só quando e qual mapa.
--
-- Reversão: drop table mapa_envios;

create table mapa_envios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mapa_id uuid not null references mapas (id) on delete cascade,
  enviado_em timestamptz not null default now()
);

create index mapa_envios_dono_idx on mapa_envios (user_id, enviado_em desc);

alter table mapa_envios enable row level security;

-- Pode registrar envio de mapa que a pessoa consegue LER (dela ou
-- compartilhado com ela) — a mesma regra de quem vê o mapa.
create policy "mapa_envios: a propria pessoa" on mapa_envios for all
  using (planner_eh_meu(user_id, tenant_id))
  with check (
    planner_eh_meu(user_id, tenant_id)
    and (mapa_e_meu(mapa_id, tenant_id) or mapa_compartilhado_comigo(mapa_id))
  );

revoke all on mapa_envios from anon;
grant select, insert on mapa_envios to authenticated;

notify pgrst, 'reload schema';
