import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * RPC `criar_projeto_planejado_ia` (migration 0051) — criação de projeto com
 * planejamento assistido por IA. Cobre os critérios de aceite do pedido do
 * Fabio que só fazem sentido contra RLS/banco real (não dá pra provar com
 * mock): atomicidade, idempotência sob clique duplo/retry, e rejeição de
 * quem não é owner — "o navegador não é fonte de autorização".
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("criar_projeto_planejado_ia", () => {
  let service: SupabaseClient;
  let owner: { userId: string; cliente: SupabaseClient };
  let membro: { userId: string; cliente: SupabaseClient };
  let tenantId: string;

  beforeAll(async () => {
    service = clienteServico();
    owner = await criarUsuarioDeTeste(service, "planejamento-ia-owner");
    membro = await criarUsuarioDeTeste(service, "planejamento-ia-membro");
    tenantId = await criarTenantDeTeste(service, owner.userId);
    await service.from("memberships").insert({ user_id: membro.userId, tenant_id: tenantId, papel: "member", escopo: "completo" });
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, owner.userId);
    await apagarUsuarioDeTeste(service, membro.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  it("cria projeto + 4 colunas padrão + só os cartões enviados (com checklist), tudo na coluna Tarefas", async () => {
    const { data: projetoId, error } = await owner.cliente.rpc("criar_projeto_planejado_ia", {
      p_tenant_id: tenantId,
      p_nome: "Aniversário do João",
      p_descricao: "30 pessoas, salão, R$ 3.000",
      p_idempotency_key: crypto.randomUUID(),
      p_tarefas: [
        { titulo: "Definir data e horário", descricao: null, checklist: [] },
        { titulo: "Solicitar orçamentos de salões", descricao: null, checklist: ["Confirmar capacidade para 30 pessoas", "Verificar disponibilidade"] },
      ],
    });

    expect(error).toBeNull();
    expect(projetoId).toBeTruthy();

    const { data: colunas } = await service.from("colunas_kanban").select("nome, hoje, concluido").eq("projeto_id", projetoId).order("ordem");
    expect(colunas).toHaveLength(4);
    expect(colunas!.map((c) => c.nome)).toEqual(["Hoje", "Tarefas", "Em Desenvolvimento", "Concluído"]);

    const { data: colunaTarefas } = await service.from("colunas_kanban").select("id").eq("projeto_id", projetoId).eq("nome", "Tarefas").single();
    const { data: tarefas } = await service.from("tarefas").select("id, titulo, coluna_id").eq("projeto_id", projetoId).order("ordem");
    expect(tarefas).toHaveLength(2);
    expect(tarefas!.every((t) => t.coluna_id === colunaTarefas!.id)).toBe(true);

    const tarefaComChecklist = tarefas!.find((t) => t.titulo === "Solicitar orçamentos de salões")!;
    const { data: checklist } = await service.from("tarefa_checklist_itens").select("texto, concluido").eq("tarefa_id", tarefaComChecklist.id).order("ordem");
    expect(checklist).toHaveLength(2);
    expect(checklist!.every((c) => c.concluido === false)).toBe(true);

    const { data: membrosDoProjeto } = await service.from("projeto_membros").select("user_id, papel").eq("projeto_id", projetoId);
    expect(membrosDoProjeto).toEqual([{ user_id: owner.userId, papel: "gestor" }]);
  });

  it("idempotência: duas chamadas com a MESMA chave nunca criam um 2º projeto", async () => {
    const chave = crypto.randomUUID();
    const params = {
      p_tenant_id: tenantId,
      p_nome: "Projeto idempotente",
      p_descricao: null,
      p_idempotency_key: chave,
      p_tarefas: [{ titulo: "Tarefa única", descricao: null, checklist: [] }],
    };

    const { data: primeiroId, error: erro1 } = await owner.cliente.rpc("criar_projeto_planejado_ia", params);
    expect(erro1).toBeNull();

    const { data: segundoId, error: erro2 } = await owner.cliente.rpc("criar_projeto_planejado_ia", params);
    expect(erro2).toBeNull();
    expect(segundoId).toBe(primeiroId);

    const { data: projetosComEsseNome } = await service.from("projetos").select("id").eq("tenant_id", tenantId).eq("nome", "Projeto idempotente");
    expect(projetosComEsseNome).toHaveLength(1);
  });

  it("quem não é owner do tenant é rejeitado — não cria projeto nem tarefa", async () => {
    const { data, error } = await membro.cliente.rpc("criar_projeto_planejado_ia", {
      p_tenant_id: tenantId,
      p_nome: "Projeto que não deveria existir",
      p_descricao: null,
      p_idempotency_key: crypto.randomUUID(),
      p_tarefas: [],
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/dono do workspace/i);

    const { data: projetosCriados } = await service.from("projetos").select("id").eq("tenant_id", tenantId).eq("nome", "Projeto que não deveria existir");
    expect(projetosCriados).toHaveLength(0);
  });

  it("tenant_id de outro workspace (o chamador não é owner lá) é rejeitado — isolamento entre tenants", async () => {
    const outroTenantId = await criarTenantDeTeste(service, membro.userId);

    const { data, error } = await owner.cliente.rpc("criar_projeto_planejado_ia", {
      p_tenant_id: outroTenantId,
      p_nome: "Projeto em tenant alheio",
      p_descricao: null,
      p_idempotency_key: crypto.randomUUID(),
      p_tarefas: [],
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();

    await service.from("tenants").delete().eq("id", outroTenantId);
  });

  it("mais de 20 tarefas é rejeitado pela função (defesa em profundidade além do limite já aplicado em TS)", async () => {
    const tarefas = Array.from({ length: 21 }, (_, i) => ({ titulo: `Tarefa ${i}`, descricao: null, checklist: [] }));
    const { data, error } = await owner.cliente.rpc("criar_projeto_planejado_ia", {
      p_tenant_id: tenantId,
      p_nome: "Projeto com tarefas demais",
      p_descricao: null,
      p_idempotency_key: crypto.randomUUID(),
      p_tarefas: tarefas,
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});
