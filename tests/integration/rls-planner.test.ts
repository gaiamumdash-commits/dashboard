import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Planner (migration 0057): dado PESSOAL. Decisão do Fabio (2026-10-07) —
 * nem o owner do workspace enxerga o Planner de um membro. Cobre
 * USER_A × USER_B no MESMO workspace (o caso que a RLS do resto do app
 * permitiria) e entre workspaces diferentes, em select/insert/update/delete.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("RLS — Planner é privado de cada pessoa", () => {
  let service: SupabaseClient;
  let userA: { userId: string; email: string; cliente: SupabaseClient };
  let userB: { userId: string; email: string; cliente: SupabaseClient };
  let estranho: { userId: string; email: string; cliente: SupabaseClient };
  let tenantId: string;
  let tenantEstranhoId: string;
  let habitoA: string;
  let petA: string;

  beforeAll(async () => {
    service = clienteServico();
    userA = await criarUsuarioDeTeste(service, "planner-a");
    userB = await criarUsuarioDeTeste(service, "planner-b");
    estranho = await criarUsuarioDeTeste(service, "planner-estranho");
    // A é owner; B é membro com acesso completo do MESMO workspace.
    tenantId = await criarTenantDeTeste(service, userA.userId);
    tenantEstranhoId = await criarTenantDeTeste(service, estranho.userId);
    await service.from("memberships").insert({ user_id: userB.userId, tenant_id: tenantId, papel: "member", escopo: "completo" });

    const { data: habito, error } = await userA.cliente
      .from("planner_habitos")
      .insert({ tenant_id: tenantId, nome: "Leitura", area: "estudos", dias_semana: [1, 3, 5] })
      .select("id, user_id")
      .single();
    if (error) throw error;
    habitoA = habito!.id as string;
    // user_id veio do default auth.uid(), não do cliente.
    expect(habito!.user_id).toBe(userA.userId);

    const { data: pet } = await userA.cliente
      .from("planner_pets")
      .insert({ tenant_id: tenantId, nome: "Thor" })
      .select("id")
      .single();
    petA = pet!.id as string;
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, userA.userId);
    await apagarUsuarioDeTeste(service, userB.userId);
    await apagarUsuarioDeTeste(service, estranho.userId);
    await service.from("tenants").delete().in("id", [tenantId, tenantEstranhoId]);
  });

  it("A enxerga o próprio hábito", async () => {
    const { data } = await userA.cliente.from("planner_habitos").select("id").eq("id", habitoA);
    expect(data).toHaveLength(1);
  });

  it("B, do MESMO workspace, não lista nem lê o hábito de A", async () => {
    const { data: lista } = await userB.cliente.from("planner_habitos").select("id").eq("tenant_id", tenantId);
    expect(lista).toEqual([]);
    const { data: porId } = await userB.cliente.from("planner_habitos").select("id").eq("id", habitoA);
    expect(porId).toEqual([]);
  });

  it("B não altera nem apaga o hábito de A", async () => {
    const { data: alterado } = await userB.cliente.from("planner_habitos").update({ nome: "invadido" }).eq("id", habitoA).select("id");
    expect(alterado ?? []).toEqual([]);
    await userB.cliente.from("planner_habitos").delete().eq("id", habitoA);
    const { data: depois } = await service.from("planner_habitos").select("nome").eq("id", habitoA).single();
    expect(depois!.nome).toBe("Leitura");
  });

  it("B não consegue marcar o hábito de A como feito", async () => {
    const { error } = await userB.cliente
      .from("planner_habito_registros")
      .insert({ tenant_id: tenantId, habito_id: habitoA, data: "2026-10-06" });
    expect(error).not.toBeNull();
  });

  it("A marca e desmarca o próprio hábito; marcar duas vezes o mesmo dia é recusado", async () => {
    const { error } = await userA.cliente
      .from("planner_habito_registros")
      .insert({ tenant_id: tenantId, habito_id: habitoA, data: "2026-10-06" });
    expect(error).toBeNull();
    const { error: duplicado } = await userA.cliente
      .from("planner_habito_registros")
      .insert({ tenant_id: tenantId, habito_id: habitoA, data: "2026-10-06" });
    expect(duplicado).not.toBeNull();

    const { data: visto } = await userB.cliente.from("planner_habito_registros").select("id").eq("habito_id", habitoA);
    expect(visto).toEqual([]);

    await userA.cliente.from("planner_habito_registros").delete().eq("habito_id", habitoA).eq("data", "2026-10-06");
    const { data: restante } = await service.from("planner_habito_registros").select("id").eq("habito_id", habitoA);
    expect(restante).toEqual([]);
  });

  it("ninguém grava linha em nome de outra pessoa (user_id forjado)", async () => {
    const { error } = await userB.cliente
      .from("planner_objetivos")
      .insert({ tenant_id: tenantId, user_id: userA.userId, titulo: "forjado", area: "pessoal" });
    expect(error).not.toBeNull();
  });

  it("ninguém grava no workspace de outro (tenant de fora)", async () => {
    const { error } = await userA.cliente
      .from("planner_compras")
      .insert({ tenant_id: tenantEstranhoId, nome: "Pão" });
    expect(error).not.toBeNull();
  });

  it("owner de outro workspace não vê nada do Planner de A", async () => {
    const { data } = await estranho.cliente.from("planner_habitos").select("id").eq("id", habitoA);
    expect(data).toEqual([]);
  });

  it("compromisso de B não pode apontar pro pet de A", async () => {
    const { error } = await userB.cliente.from("planner_compromissos").insert({
      tenant_id: tenantId,
      titulo: "Vacina",
      area: "casa",
      tipo: "pet",
      inicio: "2026-10-10T13:00:00Z",
      pet_id: petA,
    });
    expect(error).not.toBeNull();
  });

  it("A cria compromisso ligado ao próprio pet; B não vê", async () => {
    const { data, error } = await userA.cliente
      .from("planner_compromissos")
      .insert({ tenant_id: tenantId, titulo: "Vacina do Thor", area: "casa", tipo: "pet", inicio: "2026-10-10T13:00:00Z", pet_id: petA })
      .select("id")
      .single();
    expect(error).toBeNull();
    const { data: visto } = await userB.cliente.from("planner_compromissos").select("id").eq("id", data!.id);
    expect(visto).toEqual([]);
  });

  it("quem sai do workspace perde acesso ao próprio Planner de lá", async () => {
    const { data: objetivo } = await userB.cliente
      .from("planner_objetivos")
      .insert({ tenant_id: tenantId, titulo: "Correr 5 km", area: "saude" })
      .select("id")
      .single();
    expect(objetivo).not.toBeNull();

    await service.from("memberships").delete().eq("user_id", userB.userId).eq("tenant_id", tenantId);
    const { data } = await userB.cliente.from("planner_objetivos").select("id").eq("id", objetivo!.id);
    expect(data).toEqual([]);
  });

  it("banco recusa dados inválidos mesmo pra dona", async () => {
    const { error: semDias } = await userA.cliente
      .from("planner_habitos")
      .insert({ tenant_id: tenantId, nome: "Sem dias", area: "pessoal", dias_semana: [] });
    expect(semDias).not.toBeNull();
    const { error: diaInvalido } = await userA.cliente
      .from("planner_habitos")
      .insert({ tenant_id: tenantId, nome: "Dia 8", area: "pessoal", dias_semana: [8] });
    expect(diaInvalido).not.toBeNull();
    const { error: areaFinanceira } = await userA.cliente
      .from("planner_notas")
      .insert({ tenant_id: tenantId, titulo: "x", area: "financeiro" });
    expect(areaFinanceira).not.toBeNull();
    const { error: semanaNaoSegunda } = await userA.cliente
      .from("planner_cardapio")
      .insert({ tenant_id: tenantId, semana: "2026-10-07", dia_semana: 1, refeicao: "almoco", descricao: "Arroz" });
    expect(semanaNaoSegunda).not.toBeNull();
    const { error: linkRuim } = await userA.cliente
      .from("planner_cursos")
      .insert({ tenant_id: tenantId, nome: "Curso", link: "javascript:alert(1)" });
    expect(linkRuim).not.toBeNull();
  });

  it("anônimo não lê nada", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anonimo = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_ANON_KEY ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await anonimo.from("planner_habitos").select("id");
    expect(data ?? []).toEqual([]);
  });
});
