import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mapas (migration 0059): privado por padrão, como o Planner. Com
 * `compartilhado`, a equipe do MESMO workspace lê — nunca escreve. Também
 * cobre a árvore: pai sempre do mesmo mapa e uma só ideia central.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("RLS — Mapas: privado, compartilhado só leitura", () => {
  let service: SupabaseClient;
  let userA: { userId: string; email: string; cliente: SupabaseClient };
  let userB: { userId: string; email: string; cliente: SupabaseClient };
  let estranho: { userId: string; email: string; cliente: SupabaseClient };
  let tenantId: string;
  let tenantEstranhoId: string;
  let mapaA: string;
  let raizA: string;
  let ramoA: string;

  beforeAll(async () => {
    service = clienteServico();
    userA = await criarUsuarioDeTeste(service, "mapas-a");
    userB = await criarUsuarioDeTeste(service, "mapas-b");
    estranho = await criarUsuarioDeTeste(service, "mapas-estranho");
    tenantId = await criarTenantDeTeste(service, userA.userId);
    tenantEstranhoId = await criarTenantDeTeste(service, estranho.userId);
    await service.from("memberships").insert({ user_id: userB.userId, tenant_id: tenantId, papel: "member", escopo: "completo" });

    const { data: mapa, error } = await userA.cliente
      .from("mapas")
      .insert({ tenant_id: tenantId, titulo: "Lançamento" })
      .select("id, user_id")
      .single();
    if (error) throw error;
    mapaA = mapa!.id as string;
    expect(mapa!.user_id).toBe(userA.userId);

    const { data: raiz, error: erroRaiz } = await userA.cliente
      .from("mapa_nos")
      .insert({ tenant_id: tenantId, mapa_id: mapaA, pai_id: null, texto: "Lançamento" })
      .select("id")
      .single();
    if (erroRaiz) throw erroRaiz;
    raizA = raiz!.id as string;

    const { data: ramo, error: erroRamo } = await userA.cliente
      .from("mapa_nos")
      .insert({ tenant_id: tenantId, mapa_id: mapaA, pai_id: raizA, ordem: 1, texto: "Copy" })
      .select("id")
      .single();
    if (erroRamo) throw erroRamo;
    ramoA = ramo!.id as string;
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, userA.userId);
    await apagarUsuarioDeTeste(service, userB.userId);
    await apagarUsuarioDeTeste(service, estranho.userId);
    await service.from("tenants").delete().in("id", [tenantId, tenantEstranhoId]);
  });

  it("B, do MESMO workspace, não vê mapa nem ramos privados de A", async () => {
    const { data: mapas } = await userB.cliente.from("mapas").select("id").eq("id", mapaA);
    expect(mapas).toEqual([]);
    const { data: nos } = await userB.cliente.from("mapa_nos").select("id").eq("mapa_id", mapaA);
    expect(nos).toEqual([]);
  });

  it("árvore: uma só ideia central e pai sempre do mesmo mapa", async () => {
    const { error: segundaRaiz } = await userA.cliente
      .from("mapa_nos")
      .insert({ tenant_id: tenantId, mapa_id: mapaA, pai_id: null, texto: "outra raiz" });
    expect(segundaRaiz).not.toBeNull();

    const { data: outro } = await userA.cliente.from("mapas").insert({ tenant_id: tenantId, titulo: "Outro" }).select("id").single();
    const { error: paiDeOutroMapa } = await userA.cliente
      .from("mapa_nos")
      .insert({ tenant_id: tenantId, mapa_id: outro!.id, pai_id: ramoA, texto: "intruso" });
    expect(paiDeOutroMapa).not.toBeNull();
    await userA.cliente.from("mapas").delete().eq("id", outro!.id);
  });

  it("compartilhado: B lê o mapa e os ramos, mas não escreve", async () => {
    await userA.cliente.from("mapas").update({ compartilhado: true }).eq("id", mapaA);

    const { data: nos } = await userB.cliente.from("mapa_nos").select("id").eq("mapa_id", mapaA);
    expect(nos).toHaveLength(2);

    const { data: alterado } = await userB.cliente.from("mapa_nos").update({ texto: "invadido" }).eq("id", ramoA).select("id");
    expect(alterado ?? []).toEqual([]);
    const { data: mapaAlterado } = await userB.cliente.from("mapas").update({ titulo: "invadido" }).eq("id", mapaA).select("id");
    expect(mapaAlterado ?? []).toEqual([]);

    const { error: inserir } = await userB.cliente
      .from("mapa_nos")
      .insert({ tenant_id: tenantId, mapa_id: mapaA, pai_id: raizA, texto: "de B" });
    expect(inserir).not.toBeNull();

    await userB.cliente.from("mapa_nos").delete().eq("id", ramoA);
    await userB.cliente.from("mapas").delete().eq("id", mapaA);
    const { data: depois } = await service.from("mapa_nos").select("texto").eq("id", ramoA).single();
    expect(depois!.texto).toBe("Copy");
  });

  it("pessoa de outro workspace não vê nem o mapa compartilhado", async () => {
    const { data } = await estranho.cliente.from("mapa_nos").select("id").eq("mapa_id", mapaA);
    expect(data).toEqual([]);
    const { data: mapas } = await estranho.cliente.from("mapas").select("id").eq("id", mapaA);
    expect(mapas).toEqual([]);
  });

  it("ninguém grava mapa em nome de outra pessoa (user_id forjado)", async () => {
    const { error } = await userB.cliente.from("mapas").insert({ tenant_id: tenantId, user_id: userA.userId, titulo: "forjado" });
    expect(error).not.toBeNull();
  });

  it("excluir o ramo leva junto o que está dentro; excluir o mapa leva tudo", async () => {
    const { data: neto } = await userA.cliente
      .from("mapa_nos")
      .insert({ tenant_id: tenantId, mapa_id: mapaA, pai_id: ramoA, texto: "Headline" })
      .select("id")
      .single();
    await userA.cliente.from("mapa_nos").delete().eq("id", ramoA);
    const { data: sobrou } = await service.from("mapa_nos").select("id").eq("id", neto!.id);
    expect(sobrou).toEqual([]);

    await userA.cliente.from("mapas").delete().eq("id", mapaA);
    const { data: nos } = await service.from("mapa_nos").select("id").eq("mapa_id", mapaA);
    expect(nos).toEqual([]);
  });
});
