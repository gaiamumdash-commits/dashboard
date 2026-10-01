import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Testar também limites de projeto dentro do mesmo tenant" (P0) — e, na
 * rodada de fechamento (2026-09-30), a correção do vazamento real
 * encontrado aqui: `membros_do_tenant()` (migration 0047) devolvia e-mail
 * de todo o workspace pra qualquer um com `escopo: 'projeto'`. Este
 * arquivo agora PROVA a correção (antes documentava o achado) e cobre os
 * 5 cenários pedidos explicitamente no fechamento do P0:
 *
 * 1. Convidado do projeto A não enumera pessoas/e-mails do projeto B.
 * 2. Consulta direta à RPC respeita as mesmas restrições da interface.
 * 3. Administrador (owner) e gestores mantêm os acessos legítimos.
 * 4. Seletores de responsáveis continuam funcionando (dentro do projeto).
 * 5. Nenhuma alteração permite acesso entre tenants.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("RLS — limites entre projetos do mesmo tenant + correção de membros_do_tenant()", () => {
  let service: SupabaseClient;
  let owner: { userId: string; email: string; cliente: SupabaseClient };
  let membroProjetoA: { userId: string; email: string; cliente: SupabaseClient };
  let gestorProjetoA: { userId: string; email: string; cliente: SupabaseClient };
  let membroProjetoB: { userId: string; email: string; cliente: SupabaseClient };
  let tenantId: string;
  let projetoAId: string;
  let projetoBId: string;
  let tarefaDoProjetoBId: string;

  beforeAll(async () => {
    service = clienteServico();
    owner = await criarUsuarioDeTeste(service, "limites-owner");
    membroProjetoA = await criarUsuarioDeTeste(service, "limites-membro-a");
    gestorProjetoA = await criarUsuarioDeTeste(service, "limites-gestor-a");
    membroProjetoB = await criarUsuarioDeTeste(service, "limites-membro-b");
    tenantId = await criarTenantDeTeste(service, owner.userId);

    // Os 3 convidados entram com escopo 'projeto' (convite de quadro
    // específico, migration 0003 Grupo 11) — nenhum deles deveria ver
    // "Equipe do workspace inteiro".
    await service.from("memberships").insert([
      { user_id: membroProjetoA.userId, tenant_id: tenantId, papel: "member", escopo: "projeto" },
      { user_id: gestorProjetoA.userId, tenant_id: tenantId, papel: "member", escopo: "projeto" },
      { user_id: membroProjetoB.userId, tenant_id: tenantId, papel: "member", escopo: "projeto" },
    ]);

    const { data: a } = await service.from("projetos").insert({ tenant_id: tenantId, nome: "Projeto A" }).select("id").single();
    projetoAId = a!.id as string;
    const { data: b } = await service.from("projetos").insert({ tenant_id: tenantId, nome: "Projeto B" }).select("id").single();
    projetoBId = b!.id as string;

    await service.from("projeto_membros").insert([
      { tenant_id: tenantId, projeto_id: projetoAId, user_id: membroProjetoA.userId, papel: "usuario" },
      { tenant_id: tenantId, projeto_id: projetoAId, user_id: gestorProjetoA.userId, papel: "gestor" },
      { tenant_id: tenantId, projeto_id: projetoBId, user_id: membroProjetoB.userId, papel: "usuario" },
    ]);

    const { data: colunaB } = await service
      .from("colunas_kanban")
      .insert({ tenant_id: tenantId, projeto_id: projetoBId, nome: "Em Aberto", ordem: 0 })
      .select("id")
      .single();
    const { data: tarefaB } = await service
      .from("tarefas")
      .insert({
        tenant_id: tenantId,
        projeto_id: projetoBId,
        coluna_id: colunaB!.id,
        titulo: "Tarefa do projeto B",
        prioridade: "P3",
        ordem: 1000,
      })
      .select("id")
      .single();
    tarefaDoProjetoBId = tarefaB!.id as string;
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, owner.userId);
    await apagarUsuarioDeTeste(service, membroProjetoA.userId);
    await apagarUsuarioDeTeste(service, gestorProjetoA.userId);
    await apagarUsuarioDeTeste(service, membroProjetoB.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  // ---------------------------------------------------------------------
  // RLS de tabela (pré-existente, reconfirmado) — projeto/tarefa
  // ---------------------------------------------------------------------

  it("membro do Projeto A enxerga o próprio projeto", async () => {
    const { data } = await membroProjetoA.cliente.from("projetos").select("id").eq("id", projetoAId);
    expect(data).toHaveLength(1);
  });

  it("membro do Projeto A NÃO enxerga o Projeto B do MESMO tenant", async () => {
    const { data, error } = await membroProjetoA.cliente.from("projetos").select("id").eq("id", projetoBId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("membro do Projeto A NÃO lê tarefa do Projeto B, mesmo sabendo o UUID exato", async () => {
    const { data } = await membroProjetoA.cliente.from("tarefas").select("*").eq("id", tarefaDoProjetoBId);
    expect(data).toEqual([]);
  });

  it("membro com escopo 'projeto' não enxerga Metas SMART do workspace", async () => {
    await service.from("metas_smart").insert({
      tenant_id: tenantId,
      horizonte: "medio_prazo",
      visao_macro: "x",
      specific: "x",
      measurable: "x",
      attainable: "x",
      relevant: "x",
      time_bound: "x",
    });
    const { data } = await membroProjetoA.cliente.from("metas_smart").select("id").eq("tenant_id", tenantId);
    expect(data).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // 1. Convidado do projeto A não enumera pessoas/e-mails do projeto B
  // 2. Consulta direta à RPC respeita as mesmas restrições da interface
  // ---------------------------------------------------------------------

  it("[CORREÇÃO] membro do Projeto A, chamando a RPC DIRETO (como faria um client malicioso), não recebe o e-mail do membro exclusivo do Projeto B", async () => {
    const { data, error } = await membroProjetoA.cliente.rpc("membros_do_tenant", { t_id: tenantId });
    expect(error).toBeNull();
    const emails = ((data ?? []) as { email: string }[]).map((m) => m.email);
    expect(emails).not.toContain(membroProjetoB.email);
  });

  it("[CORREÇÃO] membro do Projeto B não recebe o e-mail dos membros exclusivos do Projeto A", async () => {
    const { data, error } = await membroProjetoB.cliente.rpc("membros_do_tenant", { t_id: tenantId });
    expect(error).toBeNull();
    const emails = ((data ?? []) as { email: string }[]).map((m) => m.email);
    expect(emails).not.toContain(membroProjetoA.email);
    expect(emails).not.toContain(gestorProjetoA.email);
  });

  it("[CORREÇÃO] membro do Projeto A CONTINUA vendo colegas do MESMO projeto (não é um bloqueio total)", async () => {
    const { data } = await membroProjetoA.cliente.rpc("membros_do_tenant", { t_id: tenantId });
    const emails = ((data ?? []) as { email: string }[]).map((m) => m.email);
    expect(emails).toContain(gestorProjetoA.email); // colega no mesmo Projeto A.
    expect(emails).toContain(membroProjetoA.email); // o próprio.
  });

  // ---------------------------------------------------------------------
  // 3. Administrador (owner) e gestores mantêm os acessos legítimos
  // ---------------------------------------------------------------------

  it("owner continua vendo TODOS os membros do workspace (acesso completo preservado)", async () => {
    const { data } = await owner.cliente.rpc("membros_do_tenant", { t_id: tenantId });
    const emails = ((data ?? []) as { email: string }[]).map((m) => m.email);
    expect(emails).toEqual(
      expect.arrayContaining([owner.email, membroProjetoA.email, gestorProjetoA.email, membroProjetoB.email]),
    );
  });

  it("qualquer membro com escopo='projeto' continua vendo o e-mail do owner (pode precisar @mencionar/atribuir a ele)", async () => {
    const { data: viaA } = await membroProjetoA.cliente.rpc("membros_do_tenant", { t_id: tenantId });
    const { data: viaB } = await membroProjetoB.cliente.rpc("membros_do_tenant", { t_id: tenantId });
    expect(((viaA ?? []) as { email: string }[]).map((m) => m.email)).toContain(owner.email);
    expect(((viaB ?? []) as { email: string }[]).map((m) => m.email)).toContain(owner.email);
  });

  /**
   * [EXPOSIÇÃO RESIDUAL, ACEITA E DOCUMENTADA — revisão do P0, 2026-09-30]
   * O teste acima já provava que o owner aparece pra qualquer convidado de
   * projeto — mas o relatório do P0 chegou a chamar a correção da migration
   * 0047 de "nenhuma exposição residual", o que é impreciso: continua
   * havendo exposição do e-mail do(s) owner(s) do tenant a QUALQUER membro
   * com escopo='projeto', mesmo quando esse owner nunca participou daquele
   * projeto especificamente (nem está em `projeto_membros` dele). Este
   * teste isola exatamente esse cenário com um 2º owner que não tem
   * nenhuma linha em `projeto_membros` — nem no Projeto A nem no B — pra
   * deixar claro que a regra é "todo owner, sempre", não "só o owner que
   * participa deste projeto".
   *
   * Isso é uma decisão de produto ACEITA, não um bug: um owner tem acesso
   * completo/RLS a qualquer projeto do tenant, logo pode legitimamente
   * receber atribuição ou ser @mencionado em qualquer quadro — esconder o
   * e-mail dele quebraria essa funcionalidade sem reduzir nenhum acesso
   * real (ele já pode entrar em qualquer projeto quando quiser). A
   * "exposição dispensável" seria mostrar e-mail de MEMBER de outro
   * projeto (isso a migration 0047 corrigiu); mostrar e-mail de OWNER
   * continua sendo exposição NECESSÁRIA para a função de atribuição/menção
   * existir, não uma sobra do vazamento original.
   */
  it("[DOCUMENTA EXPOSIÇÃO ACEITA] um 2º owner do tenant, sem NENHUMA linha em projeto_membros de nenhum projeto, ainda aparece (com e-mail) pra convidados de escopo='projeto' dos dois projetos", async () => {
    const segundoOwner = await criarUsuarioDeTeste(service, "limites-segundo-owner");
    await service.from("memberships").insert({ user_id: segundoOwner.userId, tenant_id: tenantId, papel: "owner", escopo: "completo" });

    const { data: viaA } = await membroProjetoA.cliente.rpc("membros_do_tenant", { t_id: tenantId });
    const { data: viaB } = await membroProjetoB.cliente.rpc("membros_do_tenant", { t_id: tenantId });

    expect(((viaA ?? []) as { email: string }[]).map((m) => m.email)).toContain(segundoOwner.email);
    expect(((viaB ?? []) as { email: string }[]).map((m) => m.email)).toContain(segundoOwner.email);

    await service.from("memberships").delete().eq("user_id", segundoOwner.userId).eq("tenant_id", tenantId);
    await apagarUsuarioDeTeste(service, segundoOwner.userId);
  });

  it("gestor do Projeto A (papel='gestor' em projeto_membros) mantém acesso legítimo aos colegas do projeto que administra", async () => {
    const { data } = await gestorProjetoA.cliente.rpc("membros_do_tenant", { t_id: tenantId });
    const emails = ((data ?? []) as { email: string }[]).map((m) => m.email);
    expect(emails).toContain(membroProjetoA.email);
    expect(emails).not.toContain(membroProjetoB.email);
  });

  // ---------------------------------------------------------------------
  // 4. Seletores de responsáveis continuam funcionando
  // ---------------------------------------------------------------------

  it("[REGRESSÃO] listarMembrosComAcessoAoProjeto (seletor de responsável/@menção) continua funcionando pro membro do Projeto A, dentro do próprio projeto", async () => {
    // Reproduz a MESMA lógica de src/lib/ecc/equipe.ts:listarMembrosComAcessoAoProjeto
    // — agora alimentada pela function corrigida — pra confirmar que o
    // filtro final continua devolvendo exatamente quem tem acesso ao
    // Projeto A (sem depender da função real, que exige contexto de
    // cookies/Next fora do alcance de um teste de integração puro).
    const { data: membrosDoTenant } = await membroProjetoA.cliente.rpc("membros_do_tenant", { t_id: tenantId });
    const { data: projetoMembros } = await service.from("projeto_membros").select("user_id").eq("projeto_id", projetoAId);
    const { data: memberships } = await service.from("memberships").select("user_id, escopo").eq("tenant_id", tenantId);

    const idsEscopoCompleto = new Set((memberships ?? []).filter((m) => m.escopo === "completo").map((m) => m.user_id));
    const idsProjetoMembros = new Set((projetoMembros ?? []).map((m) => m.user_id));

    const selecionaveis = ((membrosDoTenant ?? []) as { user_id: string; email: string; papel: string }[]).filter(
      (m) => m.papel === "owner" || idsEscopoCompleto.has(m.user_id) || idsProjetoMembros.has(m.user_id),
    );

    const emails = selecionaveis.map((m) => m.email);
    expect(emails).toEqual(expect.arrayContaining([membroProjetoA.email, gestorProjetoA.email, owner.email]));
    expect(emails).not.toContain(membroProjetoB.email); // nunca aparece como opção de responsável no Projeto A.
  });

  // ---------------------------------------------------------------------
  // 5. Nenhuma alteração permite acesso entre tenants
  // ---------------------------------------------------------------------

  it("[REGRESSÃO] membro de escopo='projeto' de OUTRO tenant não recebe nada ao chamar a RPC com o t_id deste tenant", async () => {
    const outroUsuario = await criarUsuarioDeTeste(service, "limites-outro-tenant");
    const outroTenant = await criarTenantDeTeste(service, outroUsuario.userId);
    // outroUsuario é owner do PRÓPRIO tenant, mas não tem membership
    // nenhuma neste tenantId — current_tenant_ids() já deveria bloquear.
    const { data, error } = await outroUsuario.cliente.rpc("membros_do_tenant", { t_id: tenantId });
    expect(error).toBeNull();
    expect(data).toEqual([]); // nada — current_tenant_ids() nem inclui este tenant.

    await apagarUsuarioDeTeste(service, outroUsuario.userId);
    await service.from("tenants").delete().eq("id", outroTenant);
  });
});
