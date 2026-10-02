import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Achado real (2026-10-01, reportado pelo Fabio em teste físico no
 * celular): criar um projeto novo falhava com "null value in column 'hoje'
 * of relation 'colunas_kanban' violates not-null constraint". Causa: o
 * INSERT em lote do PostgREST monta as colunas pela UNIÃO das chaves de
 * TODOS os objetos do array — como só o objeto da coluna "Hoje" tinha a
 * chave `hoje`, os outros 2 ("Em Desenvolvimento", "Concluído") recebiam
 * `null` EXPLÍCITO nessa coluna em vez de cair no `default false` do banco,
 * violando o `not null` da migration 0048. Nunca foi pego antes porque
 * todo seed desta sessão inseria direto via service client com objetos já
 * explícitos — esta foi a 1ª vez que a Server Action `criarProjeto` em si
 * foi exercitada de ponta a ponta. Reproduz a MESMA operação (não chama a
 * Server Action, que depende de cookies/contexto do Next).
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("criarProjeto — colunas padrão não violam not-null de 'hoje'", () => {
  let service: SupabaseClient;
  let owner: { userId: string; cliente: SupabaseClient };
  let tenantId: string;

  beforeAll(async () => {
    service = clienteServico();
    owner = await criarUsuarioDeTeste(service, "criar-projeto-owner");
    tenantId = await criarTenantDeTeste(service, owner.userId);
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, owner.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  it("as 4 colunas padrão são criadas sem erro, com 'hoje' correto em cada uma", async () => {
    const { data: projeto, error: eProjeto } = await owner.cliente
      .from("projetos")
      .insert({ tenant_id: tenantId, nome: "Projeto novo de teste" })
      .select("id")
      .single();
    expect(eProjeto).toBeNull();

    // Mesma operação (mesma forma de objeto em TODAS as linhas) que
    // criarProjeto faz depois da correção — inclui "Tarefas" (pedido do
    // Fabio, 2026-10-01: Hoje → Tarefas → Em Desenvolvimento → Concluído
    // como padrão de fábrica de todo projeto novo).
    const { error: erroColunas } = await owner.cliente.from("colunas_kanban").insert([
      { tenant_id: tenantId, projeto_id: projeto!.id, nome: "Hoje", ordem: 0, concluido: false, hoje: true },
      { tenant_id: tenantId, projeto_id: projeto!.id, nome: "Tarefas", ordem: 1, concluido: false, hoje: false },
      { tenant_id: tenantId, projeto_id: projeto!.id, nome: "Em Desenvolvimento", ordem: 2, concluido: false, hoje: false },
      { tenant_id: tenantId, projeto_id: projeto!.id, nome: "Concluído", ordem: 0, concluido: true, hoje: false },
    ]);
    expect(erroColunas).toBeNull();

    const { data: colunas } = await owner.cliente
      .from("colunas_kanban")
      .select("nome, hoje, concluido")
      .eq("projeto_id", projeto!.id)
      .order("ordem");

    expect(colunas).toHaveLength(4);
    const porNome = Object.fromEntries(colunas!.map((c) => [c.nome, c]));
    expect(porNome["Hoje"].hoje).toBe(true);
    expect(porNome["Tarefas"].hoje).toBe(false);
    expect(porNome["Em Desenvolvimento"].hoje).toBe(false);
    expect(porNome["Concluído"].hoje).toBe(false);
    expect(porNome["Concluído"].concluido).toBe(true);
  });

  it("[REGRESSÃO] reproduz o bug original: insert em lote com formas diferentes falha com not-null em 'hoje'", async () => {
    const { data: projeto } = await owner.cliente
      .from("projetos")
      .insert({ tenant_id: tenantId, nome: "Projeto que reproduz o bug" })
      .select("id")
      .single();

    // Mesma forma do bug original: só o 1º objeto tem a chave `hoje`.
    const { error } = await owner.cliente.from("colunas_kanban").insert([
      { tenant_id: tenantId, projeto_id: projeto!.id, nome: "Hoje", ordem: 0, concluido: false, hoje: true },
      { tenant_id: tenantId, projeto_id: projeto!.id, nome: "Em Desenvolvimento", ordem: 1, concluido: false },
    ]);

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/null value in column "hoje"/);
  });
});
