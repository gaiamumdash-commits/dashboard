import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Testar também limites de projeto dentro do mesmo tenant" — pedido
 * explícito da validação do P0. Diferente de rls-isolamento.test.ts (que
 * cobre 2 tenants distintos), aqui os dois usuários estão no MESMO
 * tenant: um convidado só pra um projeto específico (`escopo: 'projeto'`,
 * `projeto_membros`), o outro dono de um segundo projeto do mesmo
 * workspace. Prova que `tem_acesso_ao_projeto()` (migrations 0003/0004)
 * realmente restringe por projeto, não só por tenant.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("RLS — limites entre projetos do mesmo tenant", () => {
  let service: SupabaseClient;
  let owner: { userId: string; email: string; cliente: SupabaseClient };
  let membroDoProjeto1: { userId: string; email: string; cliente: SupabaseClient };
  let tenantId: string;
  let projeto1Id: string;
  let projeto2Id: string;
  let tarefaDoProjeto2: string;

  beforeAll(async () => {
    service = clienteServico();
    owner = await criarUsuarioDeTeste(service, "limites-owner");
    membroDoProjeto1 = await criarUsuarioDeTeste(service, "limites-membro-p1");
    tenantId = await criarTenantDeTeste(service, owner.userId);

    // Membro entra com escopo 'projeto' — convite pra um quadro específico,
    // não pro workspace inteiro (migration 0003, Grupo 11).
    await service.from("memberships").insert({
      user_id: membroDoProjeto1.userId,
      tenant_id: tenantId,
      papel: "member",
      escopo: "projeto",
    });

    const { data: p1 } = await service
      .from("projetos")
      .insert({ tenant_id: tenantId, nome: "Projeto 1 — do membro" })
      .select("id")
      .single();
    projeto1Id = p1!.id as string;
    await service.from("projeto_membros").insert({
      tenant_id: tenantId,
      projeto_id: projeto1Id,
      user_id: membroDoProjeto1.userId,
      papel: "usuario",
    });

    const { data: p2 } = await service
      .from("projetos")
      .insert({ tenant_id: tenantId, nome: "Projeto 2 — sem o membro" })
      .select("id")
      .single();
    projeto2Id = p2!.id as string;
    // Owner também precisa estar em projeto_membros? Não — owner tem
    // acesso via current_papel = 'owner' em tem_acesso_ao_projeto(), sem
    // precisar de linha em projeto_membros.

    const { data: coluna2 } = await service
      .from("colunas_kanban")
      .insert({ tenant_id: tenantId, projeto_id: projeto2Id, nome: "Em Aberto", ordem: 0 })
      .select("id")
      .single();
    const { data: tarefa2 } = await service
      .from("tarefas")
      .insert({
        tenant_id: tenantId,
        projeto_id: projeto2Id,
        coluna_id: coluna2!.id,
        titulo: "Tarefa do projeto 2",
        prioridade: "P3",
        ordem: 1000,
      })
      .select("id")
      .single();
    tarefaDoProjeto2 = tarefa2!.id as string;
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, owner.userId);
    await apagarUsuarioDeTeste(service, membroDoProjeto1.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  it("membro do Projeto 1 enxerga o próprio projeto", async () => {
    const { data } = await membroDoProjeto1.cliente.from("projetos").select("id").eq("id", projeto1Id);
    expect(data).toHaveLength(1);
  });

  it("membro do Projeto 1 NÃO enxerga o Projeto 2 do MESMO tenant", async () => {
    const { data, error } = await membroDoProjeto1.cliente.from("projetos").select("id").eq("id", projeto2Id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("membro do Projeto 1 NÃO lê tarefa do Projeto 2, mesmo sabendo o UUID exato", async () => {
    const { data } = await membroDoProjeto1.cliente.from("tarefas").select("*").eq("id", tarefaDoProjeto2);
    expect(data).toEqual([]);
  });

  it("membro com escopo 'projeto' não enxerga Metas SMART do workspace (só acesso completo vê)", async () => {
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
    const { data } = await membroDoProjeto1.cliente.from("metas_smart").select("id").eq("tenant_id", tenantId);
    expect(data).toEqual([]);
  });

  it("ACHADO REAL (2026-09-30, descoberto nesta validação): membros_do_tenant() vaza e-mail de todo o workspace pra quem tem só escopo 'projeto'", async () => {
    // membros_do_tenant() (migration 0002, usada por listarMembros() em
    // equipe.ts) faz `t_id in (select current_tenant_ids())` — e
    // current_tenant_ids() devolve QUALQUER tenant onde o chamador tem
    // membership, sem checar `escopo`. Resultado real, confirmado contra
    // Postgres de verdade: quem foi convidado só pra 1 projeto consegue
    // chamar essa RPC e recebe user_id + e-mail + papel de TODO MUNDO do
    // workspace, inclusive o owner — mesmo o design pretendido sendo "não
    // vê Equipe do workspace inteiro, só o(s) quadro(s) dele" (comentário
    // da própria migration 0003, Grupo 11). Não é a mesma exposição que
    // Financeiro/Metas SMART (RLS de tabela bloqueia esses dois
    // corretamente, ver outros testes), mas é vazamento real de e-mail —
    // achado de segurança FORA do escopo deste P0 (que não mexeu em
    // equipe.ts), reportado para decisão do Product Owner, não corrigido
    // aqui pra não expandir o escopo da validação.
    const { data, error } = await membroDoProjeto1.cliente.rpc("membros_do_tenant", { t_id: tenantId });
    expect(error).toBeNull();
    const emails = ((data ?? []) as { email: string }[]).map((m) => m.email);
    expect(emails).toContain(owner.email); // confirma o vazamento, não o esconde.
  });

  it("owner continua enxergando os dois projetos normalmente", async () => {
    const { data } = await owner.cliente.from("projetos").select("id").eq("tenant_id", tenantId);
    expect(data).toHaveLength(2);
  });
});
