import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Temporizador de hiperfoco (migration 0052) — pedido do Fabio: só 1
 * cronômetro ativo por PESSOA (não por workspace), pra manter o foco único.
 * Cobre o que só faz sentido contra RLS/banco real: a trava de unicidade
 * é um índice no banco, não só uma checagem em TypeScript — "o navegador
 * não é fonte de autorização". Reproduz a MESMA operação que as Server
 * Actions fazem (não chama `iniciarHiperfoco` em si, que depende de
 * cookies/contexto do Next — mesmo padrão dos outros testes desta pasta).
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("timer de hiperfoco — índice único por pessoa (migration 0052)", () => {
  let service: SupabaseClient;
  let pessoaA: { userId: string; cliente: SupabaseClient };
  let pessoaB: { userId: string; cliente: SupabaseClient };
  let tenantId: string;
  let colunaId: string;
  let tarefa1Id: string;
  let tarefa2Id: string;
  let tarefa3Id: string;

  beforeAll(async () => {
    service = clienteServico();
    pessoaA = await criarUsuarioDeTeste(service, "hiperfoco-a");
    pessoaB = await criarUsuarioDeTeste(service, "hiperfoco-b");
    tenantId = await criarTenantDeTeste(service, pessoaA.userId);
    // Pessoa B também precisa de acesso ao mesmo tenant pra atualizar
    // tarefas dele (RLS de `tarefas` exige acesso ao projeto).
    await service.from("memberships").insert({ user_id: pessoaB.userId, tenant_id: tenantId, papel: "member", escopo: "completo" });

    const { data: projeto } = await service.from("projetos").insert({ tenant_id: tenantId, nome: "Projeto de teste" }).select("id").single();
    const { data: coluna } = await service
      .from("colunas_kanban")
      .insert({ tenant_id: tenantId, projeto_id: projeto!.id, nome: "Em Desenvolvimento", ordem: 0, concluido: false, hoje: false, dispara_hiperfoco: true })
      .select("id")
      .single();
    colunaId = coluna!.id as string;

    const { data: tarefas } = await service
      .from("tarefas")
      .insert([
        { tenant_id: tenantId, projeto_id: projeto!.id, coluna_id: colunaId, titulo: "Tarefa 1", ordem: 1000 },
        { tenant_id: tenantId, projeto_id: projeto!.id, coluna_id: colunaId, titulo: "Tarefa 2", ordem: 2000 },
        { tenant_id: tenantId, projeto_id: projeto!.id, coluna_id: colunaId, titulo: "Tarefa 3", ordem: 3000 },
      ])
      .select("id");
    [tarefa1Id, tarefa2Id, tarefa3Id] = tarefas!.map((t) => t.id as string);
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, pessoaA.userId);
    await apagarUsuarioDeTeste(service, pessoaB.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  it("inicia um cronômetro de foco normalmente", async () => {
    const { error } = await pessoaA.cliente
      .from("tarefas")
      .update({ hiperfoco_iniciado_em: new Date().toISOString(), hiperfoco_user_id: pessoaA.userId, tempo_estimado_min: 30 })
      .eq("id", tarefa1Id);
    expect(error).toBeNull();

    const { data: tarefa } = await service.from("tarefas").select("hiperfoco_iniciado_em, hiperfoco_user_id").eq("id", tarefa1Id).single();
    expect(tarefa!.hiperfoco_user_id).toBe(pessoaA.userId);
  });

  it("[TRAVA REAL] a mesma pessoa não consegue um 2º cronômetro ativo em outro cartão — viola o índice único, não é só a interface que impede", async () => {
    const { error } = await pessoaA.cliente
      .from("tarefas")
      .update({ hiperfoco_iniciado_em: new Date().toISOString(), hiperfoco_user_id: pessoaA.userId, tempo_estimado_min: 15 })
      .eq("id", tarefa2Id);

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23505");

    // Confirma que a tarefa 2 continua sem timer — a rejeição não deixou
    // meio-escrito nada.
    const { data: tarefa2 } = await service.from("tarefas").select("hiperfoco_iniciado_em").eq("id", tarefa2Id).single();
    expect(tarefa2!.hiperfoco_iniciado_em).toBeNull();
  });

  it("outra pessoa consegue iniciar o cronômetro dela em paralelo — o limite é por pessoa, não por workspace", async () => {
    const { error } = await pessoaB.cliente
      .from("tarefas")
      .update({ hiperfoco_iniciado_em: new Date().toISOString(), hiperfoco_user_id: pessoaB.userId, tempo_estimado_min: 60 })
      .eq("id", tarefa2Id);
    expect(error).toBeNull();
  });

  it("depois de encerrar o cronômetro da pessoa A, ela consegue iniciar um novo em outro cartão", async () => {
    const { error: erroEncerrar } = await pessoaA.cliente
      .from("tarefas")
      .update({ hiperfoco_iniciado_em: null, hiperfoco_user_id: null })
      .eq("id", tarefa1Id);
    expect(erroEncerrar).toBeNull();

    const { error: erroNovo } = await pessoaA.cliente
      .from("tarefas")
      .update({ hiperfoco_iniciado_em: new Date().toISOString(), hiperfoco_user_id: pessoaA.userId, tempo_estimado_min: 45 })
      .eq("id", tarefa3Id);
    expect(erroNovo).toBeNull();
  });

  it("[TRAVA REAL] no máximo 1 coluna por projeto pode disparar hiperfoco — viola o índice único de colunas_kanban", async () => {
    const { data: projeto } = await service.from("colunas_kanban").select("projeto_id").eq("id", colunaId).single();
    const { error } = await service
      .from("colunas_kanban")
      .insert({ tenant_id: tenantId, projeto_id: projeto!.projeto_id, nome: "Outra coluna de foco", ordem: 1, concluido: false, hoje: false, dispara_hiperfoco: true });

    expect(error).not.toBeNull();
    expect(error!.code).toBe("23505");
  });
});
