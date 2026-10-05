import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Receitas (migration 0054) seguem a mesma regra do resto do Financeiro:
 * owner-only. Além disso, o `with check` da policy impede ligar uma receita a
 * um projeto de OUTRO workspace — o FK sozinho aceitaria qualquer UUID.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("RLS — receitas são owner-only e só ligam a projeto do próprio workspace", () => {
  let service: SupabaseClient;
  let owner: { userId: string; email: string; cliente: SupabaseClient };
  let member: { userId: string; email: string; cliente: SupabaseClient };
  let estranho: { userId: string; email: string; cliente: SupabaseClient };
  let tenantId: string;
  let tenantEstranhoId: string;
  let projetoId: string;
  let projetoEstranhoId: string;
  let receitaId: string;

  const RECEITA_BASE = {
    descricao: "Site do cliente",
    valor: 3000,
    mes_referencia: "2026-10-01",
    data_prevista: "2026-10-20",
  };

  beforeAll(async () => {
    service = clienteServico();
    owner = await criarUsuarioDeTeste(service, "receitas-owner");
    member = await criarUsuarioDeTeste(service, "receitas-member");
    estranho = await criarUsuarioDeTeste(service, "receitas-estranho");
    tenantId = await criarTenantDeTeste(service, owner.userId);
    tenantEstranhoId = await criarTenantDeTeste(service, estranho.userId);

    await service.from("memberships").insert({
      user_id: member.userId,
      tenant_id: tenantId,
      papel: "member",
      escopo: "completo",
    });

    const { data: projeto } = await service.from("projetos").insert({ tenant_id: tenantId, nome: "Projeto do owner" }).select("id").single();
    projetoId = projeto!.id as string;

    const { data: projetoEstranho } = await service
      .from("projetos")
      .insert({ tenant_id: tenantEstranhoId, nome: "Projeto de outro workspace" })
      .select("id")
      .single();
    projetoEstranhoId = projetoEstranho!.id as string;

    const { data: receita } = await service
      .from("receitas")
      .insert({ ...RECEITA_BASE, tenant_id: tenantId, projeto_id: projetoId })
      .select("id")
      .single();
    receitaId = receita!.id as string;
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, owner.userId);
    await apagarUsuarioDeTeste(service, member.userId);
    await apagarUsuarioDeTeste(service, estranho.userId);
    await service.from("tenants").delete().in("id", [tenantId, tenantEstranhoId]);
  });

  it("owner enxerga a receita do workspace", async () => {
    const { data } = await owner.cliente.from("receitas").select("id").eq("id", receitaId);
    expect(data).toHaveLength(1);
  });

  it("owner lança receita sem projeto", async () => {
    const { error } = await owner.cliente.from("receitas").insert({ ...RECEITA_BASE, tenant_id: tenantId });
    expect(error).toBeNull();
  });

  it("owner lança receita ligada a projeto do próprio workspace", async () => {
    const { error } = await owner.cliente.from("receitas").insert({ ...RECEITA_BASE, tenant_id: tenantId, projeto_id: projetoId });
    expect(error).toBeNull();
  });

  it("owner NÃO consegue ligar receita a projeto de outro workspace", async () => {
    const { error } = await owner.cliente
      .from("receitas")
      .insert({ ...RECEITA_BASE, tenant_id: tenantId, projeto_id: projetoEstranhoId });
    expect(error).not.toBeNull();
  });

  it("owner NÃO consegue mudar uma receita existente pra projeto de outro workspace", async () => {
    const { data } = await owner.cliente.from("receitas").update({ projeto_id: projetoEstranhoId }).eq("id", receitaId).select("id");
    // RLS barra o update: ou erro, ou nenhuma linha alterada.
    expect(data ?? []).toEqual([]);
    const { data: depois } = await service.from("receitas").select("projeto_id").eq("id", receitaId).single();
    expect(depois!.projeto_id).toBe(projetoId);
  });

  it("member com acesso completo NÃO enxerga receitas do workspace", async () => {
    const { data, error } = await member.cliente.from("receitas").select("id").eq("tenant_id", tenantId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("member NÃO consegue lançar receita no workspace", async () => {
    const { error } = await member.cliente.from("receitas").insert({ ...RECEITA_BASE, tenant_id: tenantId });
    expect(error).not.toBeNull();
  });

  it("owner de outro workspace NÃO enxerga nem apaga a receita", async () => {
    const { data } = await estranho.cliente.from("receitas").select("id").eq("id", receitaId);
    expect(data).toEqual([]);
    await estranho.cliente.from("receitas").delete().eq("id", receitaId);
    const { data: aindaExiste } = await service.from("receitas").select("id").eq("id", receitaId);
    expect(aindaExiste).toHaveLength(1);
  });

  it("banco recusa valor zero ou descrição vazia mesmo pro owner", async () => {
    const { error: erroValor } = await owner.cliente.from("receitas").insert({ ...RECEITA_BASE, tenant_id: tenantId, valor: 0 });
    expect(erroValor).not.toBeNull();
    const { error: erroDescricao } = await owner.cliente.from("receitas").insert({ ...RECEITA_BASE, tenant_id: tenantId, descricao: "  " });
    expect(erroDescricao).not.toBeNull();
  });
});
