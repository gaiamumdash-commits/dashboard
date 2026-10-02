import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Quando clico em dividir em Manhã/Tarde/Noite não deveria desaparecer os
 * cartões daquela coluna — todos entrariam em Manhã e a pessoa organiza
 * depois" — pedido do Fabio, 2026-10-01 (correção do achado incidental
 * registrado como P2-C no backlog). Reproduz a MESMA operação que
 * `alternarDivisaoEmTurnos` (actions.ts) faz via service client — não chama
 * a Server Action em si (depende de cookies/contexto do Next), mas exercita
 * a mesma escrita contra o banco real.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("Dividir em turnos não esconde cartões já existentes sem turno", () => {
  let service: SupabaseClient;
  let owner: { userId: string; cliente: SupabaseClient };
  let tenantId: string;
  let projetoId: string;
  let colunaHojeId: string;

  beforeAll(async () => {
    service = clienteServico();
    owner = await criarUsuarioDeTeste(service, "turnos-owner");
    tenantId = await criarTenantDeTeste(service, owner.userId);

    const { data: projeto } = await service
      .from("projetos")
      .insert({ tenant_id: tenantId, nome: "Projeto divisão de turnos" })
      .select("id")
      .single();
    projetoId = projeto!.id as string;

    const { data: colunaHoje } = await service
      .from("colunas_kanban")
      .insert({ tenant_id: tenantId, projeto_id: projetoId, nome: "Hoje", ordem: 0, hoje: true })
      .select("id")
      .single();
    colunaHojeId = colunaHoje!.id as string;

    // 3 cartões já existentes, criados ANTES de a coluna virar dividida —
    // exatamente o cenário do achado (uma coluna populada sendo dividida
    // pela 1ª vez).
    await service.from("tarefas").insert([
      { tenant_id: tenantId, projeto_id: projetoId, coluna_id: colunaHojeId, titulo: "Já existia 1", prioridade: "P3", ordem: 1000 },
      { tenant_id: tenantId, projeto_id: projetoId, coluna_id: colunaHojeId, titulo: "Já existia 2", prioridade: "P3", ordem: 2000 },
      { tenant_id: tenantId, projeto_id: projetoId, coluna_id: colunaHojeId, titulo: "Já existia 3", prioridade: "P3", ordem: 3000 },
    ]);
  });

  afterAll(async () => {
    await service.from("tarefas").delete().eq("projeto_id", projetoId);
    await service.from("colunas_kanban").delete().eq("projeto_id", projetoId);
    await service.from("projetos").delete().eq("id", projetoId);
    await apagarUsuarioDeTeste(service, owner.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  it('dividir pela 1ª vez move todo cartão sem turno para "manha" (nenhum fica invisível)', async () => {
    const { count: antesSemTurno } = await owner.cliente
      .from("tarefas")
      .select("id", { count: "exact", head: true })
      .eq("coluna_id", colunaHojeId)
      .is("turno", null);
    expect(antesSemTurno).toBe(3);

    // Mesma operação que alternarDivisaoEmTurnos(colunaId, projetoId, true) faz:
    await owner.cliente.from("colunas_kanban").update({ dividida_em_turnos: true }).eq("id", colunaHojeId);
    await owner.cliente.from("tarefas").update({ turno: "manha" }).eq("coluna_id", colunaHojeId).is("turno", null);

    const { data: tarefas } = await owner.cliente.from("tarefas").select("titulo, turno").eq("coluna_id", colunaHojeId);
    expect(tarefas).toHaveLength(3);
    for (const t of tarefas!) {
      expect(t.turno).toBe("manha");
    }
  });

  it("desfazer a divisão depois volta a limpar o turno de todos (comportamento já existente, preservado)", async () => {
    await owner.cliente.from("colunas_kanban").update({ dividida_em_turnos: false }).eq("id", colunaHojeId);
    await owner.cliente.from("tarefas").update({ turno: null }).eq("coluna_id", colunaHojeId);

    const { data: tarefas } = await owner.cliente.from("tarefas").select("turno").eq("coluna_id", colunaHojeId);
    for (const t of tarefas!) {
      expect(t.turno).toBeNull();
    }
  });
});
