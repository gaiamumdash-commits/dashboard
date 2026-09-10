-- Gaiamum — trava colunas sensíveis de `convites` contra UPDATE, pra que a
-- policy "gestor do projeto cancela do proprio projeto" (migration 0014) não
-- vire uma porta pra reescrever papel/email/tenant_id/projeto_id do convite.
-- RLS puro não resolve isso: `using`/`with check` não comparam OLD x NEW da
-- mesma linha — só um trigger BEFORE UPDATE vê as duas versões ao mesmo
-- tempo. Aplicado pra qualquer papel (owner incluso): hoje nenhum código
-- legítimo muda essas colunas via UPDATE, só INSERT define elas — só
-- `status` (cancelar) e `expira_em` (reenviar) são de fato mutáveis.

create or replace function convites_bloqueia_colunas_imutaveis()
returns trigger
language plpgsql
as $$
begin
  if new.tenant_id is distinct from old.tenant_id
    or new.projeto_id is distinct from old.projeto_id
    or new.email is distinct from old.email
    or new.papel is distinct from old.papel
    or new.convidado_por is distinct from old.convidado_por
    or new.token is distinct from old.token
    or new.criado_em is distinct from old.criado_em
  then
    raise exception 'Não é permitido alterar tenant_id, projeto_id, email, papel, convidado_por, token ou criado_em de um convite existente.';
  end if;

  return new;
end;
$$;

create trigger convites_bloqueia_colunas_imutaveis_trigger
  before update on convites
  for each row
  execute function convites_bloqueia_colunas_imutaveis();

-- Gaiamum — restaura a policy de INSERT que permitia o gestor de um projeto
-- convidar gente pro próprio quadro (criada na migration 0003, removida na
-- 0007 com o argumento de que "a tela de convite só existe em /equipe,
-- restrita a owner"). Isso ficou desatualizado: a migration 0014 construiu
-- a tela "Equipe do quadro" (dentro de /projetos/[id]/configuracoes) e a
-- Server Action `convidarParaProjeto`, os dois já assumindo que um gestor
-- (não-owner) pode convidar — mas sem essa policy o insert trava na RLS pra
-- qualquer gestor que não seja também owner do tenant. Achado real durante
-- a auditoria desta sessão: o teste original (sessão de 2026-08-31) usou a
-- própria conta do Fabio, que já é owner do tenant, mascarando o bug.

create policy "convites: gestor do projeto convida para o proprio projeto"
  on convites for insert
  with check (
    tenant_id in (select current_tenant_ids())
    and projeto_id is not null
    and eh_gestor_do_projeto(projeto_id)
  );
