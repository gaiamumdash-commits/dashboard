import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Financeiro invisível para não owner, inclusive por acessos indiretos" —
 * critério de aceite 5.1. Cobre o caso mais sutil: um member com acesso ao
 * MESMO projeto de uma tarefa que gerou uma conta a pagar (ponte
 * Kanban->Financeiro, `gerarContaAPagarDaTarefa`) continua sem enxergar
 * essa conta — o vínculo `contas_a_pagar.tarefa_id` não é uma porta lateral
 * de acesso.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("RLS — Financeiro é owner-only, mesmo por acesso indireto", () => {
  let service: SupabaseClient;
  let owner: { userId: string; email: string; cliente: SupabaseClient };
  let member: { userId: string; email: string; cliente: SupabaseClient };
  let tenantId: string;
  let projetoId: string;
  let tarefaId: string;
  let contaId: string;

  beforeAll(async () => {
    service = clienteServico();
    owner = await criarUsuarioDeTeste(service, "financeiro-owner");
    member = await criarUsuarioDeTeste(service, "financeiro-member");
    tenantId = await criarTenantDeTeste(service, owner.userId);

    // Member entra no MESMO tenant, com acesso completo (não só a um
    // projeto) — o caso mais favorável possível pro member enxergar algo
    // que não devia; se RLS bloqueia mesmo aqui, bloqueia em qualquer
    // configuração mais restrita também.
    await service.from("memberships").insert({
      user_id: member.userId,
      tenant_id: tenantId,
      papel: "member",
      escopo: "completo",
    });

    const { data: projeto } = await service
      .from("projetos")
      .insert({ tenant_id: tenantId, nome: "Projeto com despesa" })
      .select("id")
      .single();
    projetoId = projeto!.id as string;

    await service.from("projeto_membros").insert({
      tenant_id: tenantId,
      projeto_id: projetoId,
      user_id: member.userId,
      papel: "usuario",
    });

    const { data: coluna } = await service
      .from("colunas_kanban")
      .insert({ tenant_id: tenantId, projeto_id: projetoId, nome: "Em Aberto", ordem: 0 })
      .select("id")
      .single();

    const { data: tarefa } = await service
      .from("tarefas")
      .insert({
        tenant_id: tenantId,
        projeto_id: projetoId,
        coluna_id: coluna!.id,
        titulo: "Comprar servidor",
        prioridade: "P2",
        ordem: 1000,
      })
      .select("id")
      .single();
    tarefaId = tarefa!.id as string;

    const { data: conta } = await service
      .from("contas_a_pagar")
      .insert({
        tenant_id: tenantId,
        tarefa_id: tarefaId,
        nome: "Servidor novo",
        valor: 5000,
        categoria: "investimento",
        mes_referencia: "2026-10-01",
        data_vencimento: "2026-10-15",
      })
      .select("id")
      .single();
    contaId = conta!.id as string;
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, owner.userId);
    await apagarUsuarioDeTeste(service, member.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  it("owner enxerga a conta a pagar normalmente", async () => {
    const { data } = await owner.cliente.from("contas_a_pagar").select("id").eq("id", contaId);
    expect(data).toHaveLength(1);
  });

  it("member com acesso completo ao workspace e à tarefa de origem NÃO enxerga a conta a pagar", async () => {
    const { data, error } = await member.cliente.from("contas_a_pagar").select("id").eq("id", contaId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("member não lista nenhuma linha de contas_a_pagar do workspace (não só a específica)", async () => {
    const { data } = await member.cliente.from("contas_a_pagar").select("id").eq("tenant_id", tenantId);
    expect(data).toEqual([]);
  });

  it("member não enxerga contas_fixas_modelo do workspace", async () => {
    await service.from("contas_fixas_modelo").insert({
      tenant_id: tenantId,
      nome: "Aluguel",
      valor_esperado: 2000,
      dia_vencimento: 5,
      categoria: "despesa",
    });
    const { data } = await member.cliente.from("contas_fixas_modelo").select("id").eq("tenant_id", tenantId);
    expect(data).toEqual([]);
  });

  it("a Agenda (leitura de contas_a_pagar usada por listarAgendaUnificada) também não vaza pro member", async () => {
    // Mesma query de base que agenda.ts usa pra contas do owner — aqui
    // rodada pelo client do member, que deve ver 0 linhas.
    const { data } = await member.cliente
      .from("contas_a_pagar")
      .select("id, nome, valor, data_vencimento")
      .eq("tenant_id", tenantId)
      .eq("pago", false);
    expect(data).toEqual([]);
  });
});
