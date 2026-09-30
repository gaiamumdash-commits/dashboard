import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Regressão do achado central do P0 (handoff canônico, seção 11/21): "Editar"
 * meta SMART não levava a lugar nenhum porque a única escrita era um
 * `insert` puro. Cobre exatamente o cenário do critério de aceite 5.4:
 * "criar → editar → recarregar funciona; ID e vínculos permanecem; clique
 * duplo não duplica".
 *
 * Testa o upsert direto contra o índice único (migration 0045) — é a MESMA
 * operação que `salvarMetasSmart` (actions.ts) faz, sem passar pela Server
 * Action em si (que depende de garantirWorkspace()/cookies do Next, fora
 * do escopo de um teste de integração puro contra o banco).
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("metas_smart — upsert real por (tenant_id, horizonte)", () => {
  let service: SupabaseClient;
  let owner: { userId: string; cliente: SupabaseClient };
  let tenantId: string;

  beforeAll(async () => {
    service = clienteServico();
    owner = await criarUsuarioDeTeste(service, "metas-owner");
    tenantId = await criarTenantDeTeste(service, owner.userId);
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, owner.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  function linhaMeta(overrides: Partial<Record<string, string>> = {}) {
    return {
      tenant_id: tenantId,
      horizonte: "medio_prazo",
      visao_macro: "Visão original",
      specific: "S original",
      measurable: "M original",
      attainable: "A original",
      relevant: "R original",
      time_bound: "T original",
      ...overrides,
    };
  }

  it("criar → editar preserva o mesmo id (upsert, não insert+insert)", async () => {
    const { data: criada } = await owner.cliente
      .from("metas_smart")
      .upsert([linhaMeta()], { onConflict: "tenant_id,horizonte" })
      .select("id")
      .single();
    const idOriginal = criada!.id;

    const { data: editada } = await owner.cliente
      .from("metas_smart")
      .upsert([linhaMeta({ visao_macro: "Visão editada" })], { onConflict: "tenant_id,horizonte" })
      .select("id, visao_macro")
      .single();

    expect(editada!.id).toBe(idOriginal);
    expect(editada!.visao_macro).toBe("Visão editada");

    const { data: todas } = await service.from("metas_smart").select("id").eq("tenant_id", tenantId);
    expect(todas).toHaveLength(1); // nunca duplicou.
  });

  it("editar preserva vínculos existentes (projetos.meta_smart_id continua válido)", async () => {
    const { data: meta } = await service.from("metas_smart").select("id").eq("tenant_id", tenantId).single();

    const { data: projeto } = await service
      .from("projetos")
      .insert({ tenant_id: tenantId, nome: "Projeto vinculado", meta_smart_id: meta!.id })
      .select("id")
      .single();

    await owner.cliente
      .from("metas_smart")
      .upsert([linhaMeta({ visao_macro: "Visão editada de novo" })], { onConflict: "tenant_id,horizonte" });

    const { data: projetoDepois } = await service
      .from("projetos")
      .select("meta_smart_id")
      .eq("id", projeto!.id)
      .single();
    expect(projetoDepois!.meta_smart_id).toBe(meta!.id); // FK nunca quebrou.

    await service.from("projetos").delete().eq("id", projeto!.id);
  });

  it("dois upserts concorrentes pro mesmo horizonte nunca duplicam a linha (índice único no banco)", async () => {
    await Promise.all([
      owner.cliente.from("metas_smart").upsert([linhaMeta({ visao_macro: "Concorrente 1" })], {
        onConflict: "tenant_id,horizonte",
      }),
      owner.cliente.from("metas_smart").upsert([linhaMeta({ visao_macro: "Concorrente 2" })], {
        onConflict: "tenant_id,horizonte",
      }),
    ]);

    const { data: todas } = await service.from("metas_smart").select("id").eq("tenant_id", tenantId);
    expect(todas).toHaveLength(1);
  });
});
