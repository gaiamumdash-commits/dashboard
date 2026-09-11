-- Gaiamum — Oferta do Lab antes do onboarding real: tela de escolha ("Fazer
-- o Lab" vs "Ir direto pro app") mostrada uma única vez pro owner de um
-- workspace, antes das Metas SMART. Duas colunas nullable em `tenants`,
-- mesmo padrão aditivo de 0032/0035 — null = ainda não viu / ainda não
-- decidiu. Owner é por workspace; conclusão do Lab é por CONTA (ver
-- patentes_usuario.user_id em 0027) — por isso a elegibilidade cruza as
-- duas coisas na aplicação, não aqui.

alter table tenants
  add column oferta_lab_decisao text check (oferta_lab_decisao in ('lab', 'pular')),
  add column oferta_lab_vista_em timestamptz;

-- Não existia nenhuma policy de UPDATE em tenants até aqui (só select, ver
-- 0001) — o owner precisa gravar a própria decisão/visualização como ação
-- de self-service sobre o próprio workspace, sem depender de service client
-- (mesmo raciocínio de "ação real do usuário" usado em paginas_livres).
-- Deliberadamente não restrita a essas 2 colunas (RLS não faz gate por
-- coluna) — dá ao owner a capacidade geral de editar o próprio tenant, o
-- que é aceitável e provavelmente útil no futuro (ex.: renomear workspace).
create policy "tenants: owner atualiza o proprio workspace"
  on tenants for update
  using (id in (select current_tenant_ids()) and current_papel(id) = 'owner')
  with check (id in (select current_tenant_ids()) and current_papel(id) = 'owner');
