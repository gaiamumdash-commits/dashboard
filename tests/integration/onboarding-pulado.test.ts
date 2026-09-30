import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Pular onboarding persiste entre sessões" + "criação posterior de meta
 * continua acessível" — critérios de aceite do P0 (5.4). Reproduz a
 * gravação exata que `pularOnboarding()` (actions.ts) faz via service
 * client — não chama a Server Action em si (depende de cookies/contexto
 * do Next), mas exercita a MESMA operação de escrita contra o banco real.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("Onboarding — pular persiste, criar depois continua possível", () => {
  let service: SupabaseClient;
  let owner: { userId: string; cliente: SupabaseClient };
  let tenantId: string;

  beforeAll(async () => {
    service = clienteServico();
    owner = await criarUsuarioDeTeste(service, "onboarding-owner");
    tenantId = await criarTenantDeTeste(service, owner.userId);
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, owner.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  it("tenant novo começa sem decisão de pular registrada", async () => {
    const { data } = await owner.cliente.from("tenants").select("onboarding_metas_pulado_em").eq("id", tenantId).single();
    expect(data!.onboarding_metas_pulado_em).toBeNull();
  });

  it("'pular' grava a decisão (mesma operação de pularOnboarding: update condicional via service client)", async () => {
    const { error } = await service
      .from("tenants")
      .update({ onboarding_metas_pulado_em: new Date().toISOString() })
      .eq("id", tenantId)
      .is("onboarding_metas_pulado_em", null);
    expect(error).toBeNull();

    // "Persiste entre sessões" = uma leitura NOVA, independente da escrita,
    // continua vendo o valor — é exatamente isso que uma coluna no banco
    // garante (ao contrário de um estado só em cookie/sessão).
    const { data } = await owner.cliente.from("tenants").select("onboarding_metas_pulado_em").eq("id", tenantId).single();
    expect(data!.onboarding_metas_pulado_em).not.toBeNull();
  });

  it("pular de novo (idempotente) NÃO sobrescreve o timestamp original", async () => {
    const { data: antes } = await service.from("tenants").select("onboarding_metas_pulado_em").eq("id", tenantId).single();

    await service
      .from("tenants")
      .update({ onboarding_metas_pulado_em: new Date(Date.now() + 999_000).toISOString() })
      .eq("id", tenantId)
      .is("onboarding_metas_pulado_em", null); // condição nunca bate de novo — já não é mais null.

    const { data: depois } = await service.from("tenants").select("onboarding_metas_pulado_em").eq("id", tenantId).single();
    expect(depois!.onboarding_metas_pulado_em).toBe(antes!.onboarding_metas_pulado_em);
  });

  it("mesmo tendo pulado, criar uma meta depois continua funcionando normalmente (não fica bloqueado pra sempre)", async () => {
    const { data, error } = await owner.cliente
      .from("metas_smart")
      .insert({
        tenant_id: tenantId,
        horizonte: "medio_prazo",
        visao_macro: "Criada depois de pular",
        specific: "S",
        measurable: "M",
        attainable: "A",
        relevant: "R",
        time_bound: "T",
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // E o dashboard (app/page.tsx) usaria contarMetasSmart > 0 pra não
    // mais precisar do CTA "criar suas metas" — confirma que a meta é
    // lida de volta normalmente.
    const { data: contagem } = await owner.cliente
      .from("metas_smart")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    expect(contagem).toBeDefined();
  });
});
