-- Gaiamum — Mapas mentais V1 (2026-10-09). Plano aprovado pelo Fabio:
-- benchmark MindMeister, modo lista + visão de mapa, focar num ramo,
-- datas/palavras por regra (sem IA paga) e resumo por e-mail só pra própria
-- pessoa (fases 2 e 3).
--
-- Decisões que moldam este schema:
--
-- 1. Mapa é PRIVADO por padrão, como o Planner: `user_id` + `tenant_id`, e
--    só o dono escreve (`planner_eh_meu`, migration 0057). Com
--    `compartilhado = true`, quem é do MESMO workspace pode LER (o mapa e os
--    ramos) — nunca editar nesta versão.
-- 2. O mapa é uma árvore: cada ramo tem `pai_id` (a ideia central tem
--    `pai_id` nulo, exatamente uma por mapa). A FK composta
--    (pai_id, mapa_id) → (id, mapa_id) garante que o pai é do MESMO mapa;
--    excluir um ramo leva junto tudo o que está dentro dele (cascade).
-- 3. `ordem` é double precision: inserir entre dois irmãos é a média das
--    duas ordens, sem renumerar ninguém.
-- 4. Limite de 500 ramos por mapa (trigger) — o app avisa antes; o banco
--    é a garantia.
--
-- Reversão (nenhuma tabela existente é alterada; nada depende destas):
--   drop table mapa_nos, mapas cascade;
--   drop function mapa_nos_limite(), mapa_e_meu(uuid, uuid), mapa_compartilhado_comigo(uuid);

create table mapas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Espelha o texto da ideia central (lista de mapas sem ler os ramos).
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  compartilhado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table mapa_nos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mapa_id uuid not null references mapas (id) on delete cascade,
  pai_id uuid,
  ordem double precision not null default 0,
  texto text not null check (char_length(btrim(texto)) between 1 and 200),
  nota text check (char_length(nota) <= 2000),
  recolhido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, mapa_id),
  foreign key (pai_id, mapa_id) references mapa_nos (id, mapa_id) on delete cascade,
  check (pai_id is null or pai_id <> id)
);

-- Exatamente uma ideia central por mapa.
create unique index mapa_nos_uma_raiz_idx on mapa_nos (mapa_id) where pai_id is null;
create index mapa_nos_mapa_idx on mapa_nos (mapa_id, pai_id, ordem);
create index mapas_dono_idx on mapas (user_id, tenant_id, atualizado_em desc);
create index mapas_compartilhados_idx on mapas (tenant_id) where compartilhado;

-- ==========================================================================
-- Limite de ramos por mapa.
-- ==========================================================================

create or replace function mapa_nos_limite()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from mapa_nos where mapa_id = new.mapa_id) >= 500 then
    raise exception 'Mapa com 500 ramos — limite atingido.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger mapa_nos_limite_trg before insert on mapa_nos
  for each row execute function mapa_nos_limite();

-- ==========================================================================
-- Regras de acesso.
-- ==========================================================================

-- security definer: as policies de mapa_nos consultam `mapas` sem passar
-- de novo pela RLS de `mapas` (evita recursão e custo). Só devolvem
-- booleano, nunca dado.
create or replace function mapa_e_meu(m_id uuid, t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from mapas m
    where m.id = m_id and m.tenant_id = t_id and m.user_id = auth.uid()
      and m.tenant_id in (select current_tenant_ids())
  );
$$;

create or replace function mapa_compartilhado_comigo(m_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from mapas m
    where m.id = m_id and m.compartilhado and m.tenant_id in (select current_tenant_ids())
  );
$$;

revoke all on function mapa_e_meu(uuid, uuid), mapa_compartilhado_comigo(uuid) from public, anon;
grant execute on function mapa_e_meu(uuid, uuid), mapa_compartilhado_comigo(uuid) to authenticated;

alter table mapas enable row level security;
alter table mapa_nos enable row level security;

create policy "mapas: dono faz tudo" on mapas for all
  using (planner_eh_meu(user_id, tenant_id)) with check (planner_eh_meu(user_id, tenant_id));

create policy "mapas: equipe le os compartilhados" on mapas for select
  using (compartilhado and tenant_id in (select current_tenant_ids()));

-- Ramo só entra em mapa do próprio dono, com o mesmo tenant_id do mapa.
create policy "mapa_nos: dono faz tudo" on mapa_nos for all
  using (planner_eh_meu(user_id, tenant_id) and mapa_e_meu(mapa_id, tenant_id))
  with check (planner_eh_meu(user_id, tenant_id) and mapa_e_meu(mapa_id, tenant_id));

create policy "mapa_nos: equipe le os compartilhados" on mapa_nos for select
  using (mapa_compartilhado_comigo(mapa_id));

grant select, insert, update, delete on mapas, mapa_nos to authenticated;
