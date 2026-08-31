-- Gaiamum — "Coordenador de projeto": não é um papel novo no schema, é a
-- combinação que já existia mas nunca ficou alcançável — alguém convidado só
-- pra um quadro (memberships.escopo = 'projeto', já sem Financeiro/Metas
-- SMART/Equipe) promovido a gestor daquele quadro (projeto_membros.papel =
-- 'gestor', já com poder de apagar cartão/coluna e, por causa do Grupo 8,
-- de convidar gente pro próprio projeto). Faltava só destravar duas coisas:
--
-- 1. Uma forma de promover alguém a gestor de um projeto já existente (isso
--    é feature de aplicação, não de RLS — RLS "projeto_membros: gestor do
--    projeto ou owner do tenant gerencia" já cobre insert/update/delete).
-- 2. O gestor do projeto conseguir CANCELAR um convite do próprio quadro,
--    não só criar — a policy de update de `convites` (migration 0002) era
--    "só owner cancela"; faltava o espelho da policy de insert que a
--    migration 0003 já tinha criado.

create policy "convites: gestor do projeto cancela do proprio projeto"
  on convites for update
  using (
    tenant_id in (select current_tenant_ids())
    and projeto_id is not null
    and eh_gestor_do_projeto(projeto_id)
  )
  with check (
    tenant_id in (select current_tenant_ids())
    and projeto_id is not null
    and eh_gestor_do_projeto(projeto_id)
  );
