import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Concluído" é uma coluna só de chegada — pedido do Fabio, 2026-10-01:
 * nunca se cria cartão novo diretamente nela, só se recebe por
 * movimentação (arrasto ou "Mover para..."). Pra criar, cria-se em outra
 * coluna e transporta-se pra cá.
 *
 * O reforço real é o trigger `tarefas_bloqueia_criacao_em_concluido`
 * (migration 0050) — roda no nível do banco, então vale até contornando a
 * Server Action `criarTarefa`. Por isso o teste usa o client AUTENTICADO
 * do owner (sujeito a RLS real), não o service client: prova que a regra
 * protege mesmo quem tem permissão de escrever na tabela.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)('Coluna "Concluído" não aceita criação direta de cartão', () => {
  let service: SupabaseClient;
  let owner: { userId: string; cliente: SupabaseClient };
  let tenantId: string;
  let projetoId: string;
  let colunaConcluidaId: string;
  let colunaNormalId: string;

  beforeAll(async () => {
    service = clienteServico();
    owner = await criarUsuarioDeTeste(service, "concluido-owner");
    tenantId = await criarTenantDeTeste(service, owner.userId);

    const { data: projeto, error: eProjeto } = await service
      .from("projetos")
      .insert({ tenant_id: tenantId, nome: "Projeto concluído-sem-criação" })
      .select("id")
      .single();
    if (eProjeto || !projeto) throw new Error(`Falha ao criar projeto de teste: ${eProjeto?.message}`);
    projetoId = projeto.id as string;

    const { data: colunaConcluida, error: eColunaC } = await service
      .from("colunas_kanban")
      .insert({ tenant_id: tenantId, projeto_id: projetoId, nome: "Concluído", ordem: 99, concluido: true })
      .select("id")
      .single();
    if (eColunaC || !colunaConcluida) throw new Error(`Falha ao criar coluna Concluído: ${eColunaC?.message}`);
    colunaConcluidaId = colunaConcluida.id as string;

    const { data: colunaNormal, error: eColunaN } = await service
      .from("colunas_kanban")
      .insert({ tenant_id: tenantId, projeto_id: projetoId, nome: "Hoje", ordem: 0, hoje: true })
      .select("id")
      .single();
    if (eColunaN || !colunaNormal) throw new Error(`Falha ao criar coluna Hoje: ${eColunaN?.message}`);
    colunaNormalId = colunaNormal.id as string;
  });

  afterAll(async () => {
    await service.from("tarefas").delete().eq("projeto_id", projetoId);
    await service.from("colunas_kanban").delete().eq("projeto_id", projetoId);
    await service.from("projetos").delete().eq("id", projetoId);
    await apagarUsuarioDeTeste(service, owner.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  it("INSERT direto numa coluna com concluido=true é rejeitado, com mensagem em português", async () => {
    const { error } = await owner.cliente.from("tarefas").insert({
      tenant_id: tenantId,
      projeto_id: projetoId,
      coluna_id: colunaConcluidaId,
      titulo: "Não deveria existir",
      prioridade: "P3",
      ordem: 1000,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/só recebe cartões movidos/);

    const { count } = await service
      .from("tarefas")
      .select("id", { count: "exact", head: true })
      .eq("coluna_id", colunaConcluidaId);
    expect(count).toBe(0);
  });

  it("INSERT numa coluna normal continua funcionando normalmente (regra é exclusiva de Concluído)", async () => {
    const { data, error } = await owner.cliente
      .from("tarefas")
      .insert({
        tenant_id: tenantId,
        projeto_id: projetoId,
        coluna_id: colunaNormalId,
        titulo: "Cartão criado normalmente",
        prioridade: "P3",
        ordem: 1000,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it('mover (UPDATE) um cartão já existente PARA "Concluído" continua funcionando — só a criação direta é bloqueada', async () => {
    const { data: tarefa } = await owner.cliente
      .from("tarefas")
      .insert({
        tenant_id: tenantId,
        projeto_id: projetoId,
        coluna_id: colunaNormalId,
        titulo: "Cartão que vai ser movido pra Concluído",
        prioridade: "P3",
        ordem: 2000,
      })
      .select("id")
      .single();
    expect(tarefa).not.toBeNull();

    const { error } = await owner.cliente.from("tarefas").update({ coluna_id: colunaConcluidaId }).eq("id", tarefa!.id);
    expect(error).toBeNull();

    const { data: depois } = await owner.cliente.from("tarefas").select("coluna_id").eq("id", tarefa!.id).single();
    expect(depois!.coluna_id).toBe(colunaConcluidaId);
  });
});
