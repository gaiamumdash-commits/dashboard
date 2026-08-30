-- Gaiamum — Corrige bug real encontrado ao testar o convite geral (workspace
-- inteiro) de ponta a ponta pela UI: a função `tem_acesso_ao_projeto`,
-- criada na migration 0003, só libera acesso a um projeto pro owner do
-- tenant ou pra quem está explicitamente em `projeto_membros` — nunca
-- considera quem tem `memberships.escopo = 'completo'` (convite geral, sem
-- projeto específico). Resultado: quem aceita um convite geral fica sem
-- ver nenhum projeto, porque nunca é adicionado em `projeto_membros`.
--
-- `tem_acesso_completo` já existe (criada mais abaixo na própria 0003), por
-- isso essa correção só é possível numa migration separada, depois dela.

create or replace function tem_acesso_ao_projeto(p_id uuid, t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    current_papel(t_id) = 'owner'
    or tem_acesso_completo(t_id)
    or exists (select 1 from projeto_membros where projeto_id = p_id and user_id = auth.uid());
$$;
