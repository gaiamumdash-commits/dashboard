import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Isolamento entre tenants — o teste de segurança mais crítico do P0 (ver
 * critérios de aceite 5.1: "Usuário A não consegue ler ou alterar dados do
 * tenant B por ID conhecido, server action, API e consulta sob RLS").
 *
 * Não roda com mock nenhum: usa 2 usuários reais, 2 tenants reais, e o
 * client do Supabase autenticado como cada um (JWT real, sujeito a RLS) —
 * um mock que sempre autoriza não provaria isolamento nenhum, é exatamente
 * o erro que este arquivo evita.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("RLS — isolamento entre tenants", () => {
  let service: SupabaseClient;
  let usuarioA: { userId: string; email: string; cliente: SupabaseClient };
  let usuarioB: { userId: string; email: string; cliente: SupabaseClient };
  let tenantA: string;
  let tenantB: string;
  let projetoDeA: string;
  let tarefaDeA: string;
  let paginaLivreDeA: string;

  beforeAll(async () => {
    service = clienteServico();
    usuarioA = await criarUsuarioDeTeste(service, "usuario-a");
    usuarioB = await criarUsuarioDeTeste(service, "usuario-b");
    tenantA = await criarTenantDeTeste(service, usuarioA.userId);
    tenantB = await criarTenantDeTeste(service, usuarioB.userId);

    const { data: projeto } = await service
      .from("projetos")
      .insert({ tenant_id: tenantA, nome: "Projeto do tenant A" })
      .select("id")
      .single();
    projetoDeA = projeto!.id as string;

    await service.from("projeto_membros").insert({
      tenant_id: tenantA,
      projeto_id: projetoDeA,
      user_id: usuarioA.userId,
      papel: "gestor",
    });

    const { data: coluna } = await service
      .from("colunas_kanban")
      .insert({ tenant_id: tenantA, projeto_id: projetoDeA, nome: "Em Aberto", ordem: 0 })
      .select("id")
      .single();

    const { data: tarefa } = await service
      .from("tarefas")
      .insert({
        tenant_id: tenantA,
        projeto_id: projetoDeA,
        coluna_id: coluna!.id,
        titulo: "Tarefa sensível do tenant A",
        prioridade: "P3",
        ordem: 1000,
      })
      .select("id")
      .single();
    tarefaDeA = tarefa!.id as string;

    const { data: pagina } = await service
      .from("paginas_livres")
      .insert({
        tenant_id: tenantA,
        projeto_id: projetoDeA,
        titulo: "Nota confidencial de A",
        criado_por: usuarioA.userId,
      })
      .select("id")
      .single();
    paginaLivreDeA = pagina!.id as string;
  });

  afterAll(async () => {
    await apagarUsuarioDeTeste(service, usuarioA.userId);
    await apagarUsuarioDeTeste(service, usuarioB.userId);
    // Tenants ficam órfãos se o cascade de auth.users->memberships->tenants
    // não cobrir a ponta tenants (memberships.tenant_id não é cascade a
    // partir de auth.users) — limpeza explícita por segurança.
    await service.from("tenants").delete().in("id", [tenantA, tenantB]);
  });

  it("usuário B não lista o projeto do tenant A", async () => {
    const { data, error } = await usuarioB.cliente.from("projetos").select("id").eq("id", projetoDeA);
    expect(error).toBeNull();
    expect(data).toEqual([]); // RLS filtra silenciosamente, não devolve erro — é assim que Postgres RLS funciona.
  });

  it("usuário B não lê a tarefa do tenant A mesmo sabendo o UUID exato", async () => {
    const { data, error } = await usuarioB.cliente.from("tarefas").select("*").eq("id", tarefaDeA);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("usuário B não consegue EDITAR a tarefa do tenant A por ID conhecido", async () => {
    const { data, error } = await usuarioB.cliente
      .from("tarefas")
      .update({ titulo: "Sequestrada por B" })
      .eq("id", tarefaDeA)
      .select();
    // RLS bloqueia a linha do UPDATE — 0 linhas afetadas, sem erro de permissão explícito.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: aindaOriginal } = await service.from("tarefas").select("titulo").eq("id", tarefaDeA).single();
    expect(aindaOriginal?.titulo).toBe("Tarefa sensível do tenant A");
  });

  it("usuário B não consegue APAGAR a página livre do tenant A por ID conhecido", async () => {
    await usuarioB.cliente.from("paginas_livres").delete().eq("id", paginaLivreDeA);
    const { data: aindaExiste } = await service.from("paginas_livres").select("id").eq("id", paginaLivreDeA).maybeSingle();
    expect(aindaExiste).not.toBeNull();
  });

  it("usuário B não consegue criar uma tarefa DENTRO do projeto do tenant A", async () => {
    const { data: coluna } = await service
      .from("colunas_kanban")
      .select("id")
      .eq("projeto_id", projetoDeA)
      .limit(1)
      .single();

    const { error } = await usuarioB.cliente.from("tarefas").insert({
      tenant_id: tenantA,
      projeto_id: projetoDeA,
      coluna_id: coluna!.id,
      titulo: "Injetada por B",
      prioridade: "P3",
      ordem: 9999,
    });
    expect(error).not.toBeNull(); // RLS de insert rejeita — with check falha.
  });

  it("usuário A continua enxergando os próprios dados normalmente (não é um bloqueio geral)", async () => {
    const { data } = await usuarioA.cliente.from("tarefas").select("id").eq("id", tarefaDeA);
    expect(data).toHaveLength(1);
  });
});
