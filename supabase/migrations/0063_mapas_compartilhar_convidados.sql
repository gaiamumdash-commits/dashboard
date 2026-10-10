-- Gaiamum — Mapa mental: o dono escolhe COM QUEM compartilha (2026-10-10).
-- Pedido do Fabio: decidir na hora entre "Só eu", "Equipe" e "Equipe e
-- convidados".
--
-- Antes desta migration, `compartilhado = true` liberava a leitura pra
-- QUALQUER membership do workspace — inclusive quem entrou convidado só pra
-- um quadro (`memberships.escopo = 'projeto'`). Agora:
--
--   compartilhado | inclui_convidados | quem lê (além do dono)
--   false         | false             | ninguém
--   true          | false             | membros com acesso completo (tem_acesso_completo)
--   true          | true              | membros e convidados de quadro
--
-- A regra fica MAIS restrita do que antes: nenhum mapa existente passa a
-- ser visto por mais gente (todos começam com inclui_convidados = false).
-- `mapa_compartilhado_comigo` também é usada pela policy de `mapa_envios`
-- (0062), que acompanha a mesma regra automaticamente.
--
-- Reversão:
--   (recriar a policy e a função como na 0059) e depois
--   alter table mapas drop column inclui_convidados;

alter table mapas
  add column inclui_convidados boolean not null default false,
  add constraint mapas_convidados_so_se_compartilhado check (not inclui_convidados or compartilhado);

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
      and (m.inclui_convidados or tem_acesso_completo(m.tenant_id))
  );
$$;

drop policy "mapas: equipe le os compartilhados" on mapas;

create policy "mapas: equipe le os compartilhados" on mapas for select
  using (
    compartilhado
    and tenant_id in (select current_tenant_ids())
    and (inclui_convidados or tem_acesso_completo(tenant_id))
  );

notify pgrst, 'reload schema';
