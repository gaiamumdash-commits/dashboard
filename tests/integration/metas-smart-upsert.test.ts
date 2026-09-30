import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Regressão do achado central do P0 (handoff canônico, seção 11/21): "Editar"
 * meta SMART não levava a lugar nenhum porque a única escrita era um
 * `insert` puro. Cobre o critério de aceite 5.4: "criar → editar →
 * recarregar funciona; ID e vínculos permanecem; clique duplo não duplica".
 *
 * `salvarMetaSmartComoAApp` abaixo reproduz EXATAMENTE a lógica de
 * `salvarMetasSmart` (src/lib/ecc/actions.ts): busca o id existente,
 * UPDATE explícito por id quando existe, INSERT quando não existe, com
 * fallback de corrida em cima do erro 23505 do índice único (migration
 * 0045) — não um `.upsert()` genérico (trocado nesta mesma revisão do P0
 * porque o prompt de consolidação pediu explicitamente "update explícito
 * autorizado, não upsert genérico"). Reimplementada aqui (em vez de
 * importar a Server Action real) porque `salvarMetasSmart` depende de
 * `garantirWorkspace()`/cookies do Next, fora do alcance de um teste de
 * integração puro contra o banco — mas a lógica de escrita é a mesma,
 * linha por linha, então prova o comportamento real, não uma versão
 * simplificada dele.
 */
async function salvarMetaSmartComoAApp(
  cliente: SupabaseClient,
  tenantId: string,
  horizonte: string,
  campos: Record<string, string>,
): Promise<{ id: string }> {
  const { data: existente } = await cliente
    .from("metas_smart")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("horizonte", horizonte)
    .maybeSingle();

  if (existente) {
    const { data, error } = await cliente
      .from("metas_smart")
      .update(campos)
      .eq("id", existente.id)
      .eq("tenant_id", tenantId)
      .select("id")
      .single();
    if (error) throw error;
    return data as { id: string };
  }

  const { data, error } = await cliente
    .from("metas_smart")
    .insert({ tenant_id: tenantId, horizonte, ...campos })
    .select("id")
    .single();

  if (!error) return data as { id: string };
  if (error.code !== "23505") throw error;

  // Corrida: outro request criou entre o SELECT e o INSERT — resolve
  // como edição.
  const { data: criadaPeloOutro } = await cliente
    .from("metas_smart")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("horizonte", horizonte)
    .single();
  const { data: atualizada, error: erroUpdate } = await cliente
    .from("metas_smart")
    .update(campos)
    .eq("id", criadaPeloOutro!.id)
    .select("id")
    .single();
  if (erroUpdate) throw erroUpdate;
  return atualizada as { id: string };
}

describe.skipIf(!TEM_BANCO_DE_TESTE)("metas_smart — update explícito por id (não upsert genérico)", () => {
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

  function campos(overrides: Partial<Record<string, string>> = {}) {
    return {
      visao_macro: "Visão original",
      specific: "S original",
      measurable: "M original",
      attainable: "A original",
      relevant: "R original",
      time_bound: "T original",
      ...overrides,
    };
  }

  it("criar → editar preserva o mesmo id (UPDATE por id, nunca insert+insert)", async () => {
    const criada = await salvarMetaSmartComoAApp(owner.cliente, tenantId, "medio_prazo", campos());
    const editada = await salvarMetaSmartComoAApp(
      owner.cliente,
      tenantId,
      "medio_prazo",
      campos({ visao_macro: "Visão editada" }),
    );

    expect(editada.id).toBe(criada.id);

    const { data: linha } = await service.from("metas_smart").select("visao_macro").eq("id", criada.id).single();
    expect(linha!.visao_macro).toBe("Visão editada");

    const { data: todas } = await service.from("metas_smart").select("id").eq("tenant_id", tenantId);
    expect(todas).toHaveLength(1); // nunca duplicou.
  });

  it("editar preserva vínculos existentes (projetos.meta_smart_id continua válido)", async () => {
    const { data: meta } = await service
      .from("metas_smart")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("horizonte", "medio_prazo")
      .single();

    const { data: projeto } = await service
      .from("projetos")
      .insert({ tenant_id: tenantId, nome: "Projeto vinculado", meta_smart_id: meta!.id })
      .select("id")
      .single();

    await salvarMetaSmartComoAApp(owner.cliente, tenantId, "medio_prazo", campos({ visao_macro: "Visão editada de novo" }));

    const { data: projetoDepois } = await service
      .from("projetos")
      .select("meta_smart_id")
      .eq("id", projeto!.id)
      .single();
    expect(projetoDepois!.meta_smart_id).toBe(meta!.id); // FK nunca quebrou.

    await service.from("projetos").delete().eq("id", projeto!.id);
  });

  it("não autorizado (usuário de outro tenant) não consegue editar a meta por UPDATE direto", async () => {
    const intruso = await criarUsuarioDeTeste(service, "metas-intruso");
    const { data: meta } = await service
      .from("metas_smart")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("horizonte", "medio_prazo")
      .single();

    const { data, error } = await intruso.cliente
      .from("metas_smart")
      .update({ visao_macro: "Sequestrada" })
      .eq("id", meta!.id)
      .select();

    expect(error).toBeNull(); // RLS filtra a linha, não devolve erro de permissão.
    expect(data).toEqual([]); // 0 linhas afetadas.

    const { data: aindaOriginal } = await service.from("metas_smart").select("visao_macro").eq("id", meta!.id).single();
    expect(aindaOriginal!.visao_macro).not.toBe("Sequestrada");

    await apagarUsuarioDeTeste(service, intruso.userId);
  });

  it("dois 'cliques duplos' concorrentes na criação do mesmo horizonte nunca duplicam a linha", async () => {
    // Tenant novo e limpo pra este teste (o de cima já tem 'medio_prazo').
    const outroUsuario = await criarUsuarioDeTeste(service, "metas-concorrencia");
    const outroTenant = await criarTenantDeTeste(service, outroUsuario.userId);

    await Promise.all([
      salvarMetaSmartComoAApp(outroUsuario.cliente, outroTenant, "medio_prazo", campos({ visao_macro: "Clique 1" })),
      salvarMetaSmartComoAApp(outroUsuario.cliente, outroTenant, "medio_prazo", campos({ visao_macro: "Clique 2" })),
    ]);

    const { data: todas } = await service.from("metas_smart").select("id").eq("tenant_id", outroTenant);
    expect(todas).toHaveLength(1);

    await apagarUsuarioDeTeste(service, outroUsuario.userId);
    await service.from("tenants").delete().eq("id", outroTenant);
  });
});
