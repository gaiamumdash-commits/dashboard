import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Migration 0055 — "Planejar com IA" por prompt copiável, Fase 1:
 * marcos na criação do projeto e `adicionar_tarefas_planejadas` num projeto
 * que já existe (permissão, destino, ordem, idempotência, limite).
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("planejamento por prompt copiável (migration 0055)", () => {
  let service: SupabaseClient;
  let owner: { userId: string; cliente: SupabaseClient };
  let gestor: { userId: string; cliente: SupabaseClient };
  let membro: { userId: string; cliente: SupabaseClient };
  let tenantId: string;
  let projetoId: string;

  const item = (titulo: string, extra: Record<string, unknown> = {}) => ({ titulo, descricao: null, checklist: [], ...extra });

  beforeAll(async () => {
    service = clienteServico();
    owner = await criarUsuarioDeTeste(service, "prompt-owner");
    gestor = await criarUsuarioDeTeste(service, "prompt-gestor");
    membro = await criarUsuarioDeTeste(service, "prompt-membro");
    tenantId = await criarTenantDeTeste(service, owner.userId);
    await service.from("memberships").insert([
      { user_id: gestor.userId, tenant_id: tenantId, papel: "member", escopo: "completo" },
      { user_id: membro.userId, tenant_id: tenantId, papel: "member", escopo: "completo" },
    ]);

    const { data } = await owner.cliente.rpc("criar_projeto_planejado_ia", {
      p_tenant_id: tenantId,
      p_nome: "Curso online",
      p_descricao: null,
      p_idempotency_key: crypto.randomUUID(),
      p_tarefas: [item("Preparação", { marco: true }), item("Gravar aulas", { checklist: ["Roteiro"] })],
    });
    projetoId = data as string;

    await service.from("projeto_membros").insert([
      { tenant_id: tenantId, projeto_id: projetoId, user_id: gestor.userId, papel: "gestor" },
      { tenant_id: tenantId, projeto_id: projetoId, user_id: membro.userId, papel: "usuario" },
    ]);
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, owner.userId);
    await apagarUsuarioDeTeste(service, gestor.userId);
    await apagarUsuarioDeTeste(service, membro.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  async function tarefasDoProjeto() {
    const { data } = await service.from("tarefas").select("titulo, is_marco, ordem, coluna_id").eq("projeto_id", projetoId).order("ordem");
    return data ?? [];
  }

  it("criação: o item marcado como marco vira cartão com is_marco", async () => {
    const tarefas = await tarefasDoProjeto();
    expect(tarefas.map((t) => [t.titulo, t.is_marco])).toEqual([
      ["Preparação", true],
      ["Gravar aulas", false],
    ]);
  });

  it("projeto existente: owner adiciona no FIM da coluna Tarefas, com marco e checklist", async () => {
    const { data: criadas, error } = await owner.cliente.rpc("adicionar_tarefas_planejadas", {
      p_tenant_id: tenantId,
      p_projeto_id: projetoId,
      p_idempotency_key: crypto.randomUUID(),
      p_tarefas: [item("Lançamento", { marco: true }), item("Abrir carrinho", { checklist: ["Página", "Pix"] })],
    });
    expect(error).toBeNull();
    expect(criadas).toBe(2);

    const tarefas = await tarefasDoProjeto();
    expect(tarefas.map((t) => t.titulo)).toEqual(["Preparação", "Gravar aulas", "Lançamento", "Abrir carrinho"]);
    expect(tarefas[2].is_marco).toBe(true);
    const { data: coluna } = await service.from("colunas_kanban").select("id").eq("projeto_id", projetoId).eq("nome", "Tarefas").single();
    expect(new Set(tarefas.map((t) => t.coluna_id))).toEqual(new Set([coluna!.id]));
  });

  it("mesma chave duas vezes (clique duplo) não duplica nada", async () => {
    const chave = crypto.randomUUID();
    const chamada = () =>
      owner.cliente.rpc("adicionar_tarefas_planejadas", {
        p_tenant_id: tenantId,
        p_projeto_id: projetoId,
        p_idempotency_key: chave,
        p_tarefas: [item("Item idempotente")],
      });
    const [a, b] = await Promise.all([chamada(), chamada()]);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    const tarefas = await tarefasDoProjeto();
    expect(tarefas.filter((t) => t.titulo === "Item idempotente")).toHaveLength(1);
  });

  it("gestor do projeto (não owner) também pode planejar", async () => {
    const { error } = await gestor.cliente.rpc("adicionar_tarefas_planejadas", {
      p_tenant_id: tenantId,
      p_projeto_id: projetoId,
      p_idempotency_key: crypto.randomUUID(),
      p_tarefas: [item("Do gestor")],
    });
    expect(error).toBeNull();
  });

  it("membro comum do projeto NÃO pode planejar", async () => {
    const { error } = await membro.cliente.rpc("adicionar_tarefas_planejadas", {
      p_tenant_id: tenantId,
      p_projeto_id: projetoId,
      p_idempotency_key: crypto.randomUUID(),
      p_tarefas: [item("Do membro")],
    });
    expect(error).not.toBeNull();
    expect((await tarefasDoProjeto()).some((t) => t.titulo === "Do membro")).toBe(false);
  });

  it("mais de 30 itens é rejeitado", async () => {
    const { error } = await owner.cliente.rpc("adicionar_tarefas_planejadas", {
      p_tenant_id: tenantId,
      p_projeto_id: projetoId,
      p_idempotency_key: crypto.randomUUID(),
      p_tarefas: Array.from({ length: 31 }, (_, i) => item(`Excesso ${i}`)),
    });
    expect(error).not.toBeNull();
  });

  it("coluna 'Tarefas' renomeada: cai na 1ª coluna comum (nunca em Hoje, foco ou Concluído)", async () => {
    await service.from("colunas_kanban").update({ nome: "Backlog" }).eq("projeto_id", projetoId).eq("nome", "Tarefas");
    const { error } = await owner.cliente.rpc("adicionar_tarefas_planejadas", {
      p_tenant_id: tenantId,
      p_projeto_id: projetoId,
      p_idempotency_key: crypto.randomUUID(),
      p_tarefas: [item("Depois de renomear")],
    });
    expect(error).toBeNull();
    const { data: backlog } = await service.from("colunas_kanban").select("id").eq("projeto_id", projetoId).eq("nome", "Backlog").single();
    const { data: tarefa } = await service.from("tarefas").select("coluna_id").eq("projeto_id", projetoId).eq("titulo", "Depois de renomear").single();
    expect(tarefa!.coluna_id).toBe(backlog!.id);
  });
});
