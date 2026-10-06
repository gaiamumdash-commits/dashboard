import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TEM_BANCO_DE_TESTE, clienteServico, criarUsuarioDeTeste, apagarUsuarioDeTeste, criarTenantDeTeste } from "./helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Auditoria de segurança de 2026-10-06 (migration 0056). Os 2 ataques
 * abaixo FUNCIONAVAM antes da correção (comprovados no Postgres de teste):
 *  1. convidado de um projeto listava/baixava/apagava comprovante do
 *     financeiro e anexo de projeto alheio direto pelo Storage;
 *  2. qualquer conta logada criava workspace chamando a RPC direto,
 *     burlando o cadastro fechado.
 */
describe.skipIf(!TEM_BANCO_DE_TESTE)("segurança — storage de anexos e criação de workspace (migration 0056)", () => {
  let service: SupabaseClient;
  let dono: { userId: string; cliente: SupabaseClient };
  let membroDoProjeto: { userId: string; cliente: SupabaseClient };
  let convidadoDeOutroProjeto: { userId: string; cliente: SupabaseClient };
  let tenantId: string;
  let caminhoFinanceiro: string;
  let caminhoTarefa: string;

  beforeAll(async () => {
    service = clienteServico();
    dono = await criarUsuarioDeTeste(service, "seg-dono");
    membroDoProjeto = await criarUsuarioDeTeste(service, "seg-membro");
    convidadoDeOutroProjeto = await criarUsuarioDeTeste(service, "seg-convidado");
    tenantId = await criarTenantDeTeste(service, dono.userId);
    await service.from("memberships").insert([
      { user_id: membroDoProjeto.userId, tenant_id: tenantId, papel: "member", escopo: "projeto" },
      { user_id: convidadoDeOutroProjeto.userId, tenant_id: tenantId, papel: "member", escopo: "projeto" },
    ]);

    const { data: projeto } = await service.from("projetos").insert({ tenant_id: tenantId, nome: "Projeto A" }).select("id").single();
    const { data: outro } = await service.from("projetos").insert({ tenant_id: tenantId, nome: "Projeto B" }).select("id").single();
    await service.from("projeto_membros").insert([
      { tenant_id: tenantId, projeto_id: projeto!.id, user_id: membroDoProjeto.userId, papel: "usuario" },
      { tenant_id: tenantId, projeto_id: outro!.id, user_id: convidadoDeOutroProjeto.userId, papel: "usuario" },
    ]);
    const { data: coluna } = await service
      .from("colunas_kanban")
      .insert({ tenant_id: tenantId, projeto_id: projeto!.id, nome: "Tarefas", ordem: 1 })
      .select("id")
      .single();
    const { data: tarefa } = await service
      .from("tarefas")
      .insert({ tenant_id: tenantId, projeto_id: projeto!.id, coluna_id: coluna!.id, titulo: "Cartão com anexo", prioridade: "P3", ordem: 1000 })
      .select("id")
      .single();

    caminhoFinanceiro = `${tenantId}/conta_a_pagar/${crypto.randomUUID()}/comprovante.txt`;
    caminhoTarefa = `${tenantId}/tarefa/${tarefa!.id}/anexo.txt`;
    await service.storage.from("anexos").upload(caminhoFinanceiro, new Blob(["extrato sigiloso"]), { contentType: "text/plain" });
    await service.storage.from("anexos").upload(caminhoTarefa, new Blob(["anexo do cartão"]), { contentType: "text/plain" });
  });

  afterAll(async () => {
    await service.storage.from("anexos").remove([caminhoFinanceiro, caminhoTarefa]);
    for (const u of [dono, membroDoProjeto, convidadoDeOutroProjeto]) await apagarUsuarioDeTeste(service, u.userId);
    await service.from("tenants").delete().eq("id", tenantId);
  });

  const pasta = (caminho: string) => caminho.slice(0, caminho.lastIndexOf("/"));

  it("dono baixa o comprovante do financeiro", async () => {
    const { data } = await dono.cliente.storage.from("anexos").download(caminhoFinanceiro);
    expect(await data?.text()).toBe("extrato sigiloso");
  });

  it("convidado de projeto NÃO lista, NÃO baixa e NÃO apaga o comprovante do financeiro", async () => {
    const lista = await convidadoDeOutroProjeto.cliente.storage.from("anexos").list(pasta(caminhoFinanceiro));
    expect(lista.data ?? []).toEqual([]);
    const baixa = await convidadoDeOutroProjeto.cliente.storage.from("anexos").download(caminhoFinanceiro);
    expect(baixa.data).toBeNull();
    await convidadoDeOutroProjeto.cliente.storage.from("anexos").remove([caminhoFinanceiro]);
    const aindaExiste = await service.storage.from("anexos").download(caminhoFinanceiro);
    expect(aindaExiste.data).not.toBeNull();
  });

  it("membro do projeto baixa o anexo do cartão do projeto dele", async () => {
    const { data } = await membroDoProjeto.cliente.storage.from("anexos").download(caminhoTarefa);
    expect(await data?.text()).toBe("anexo do cartão");
  });

  it("convidado de OUTRO projeto não acessa o anexo desse cartão", async () => {
    const baixa = await convidadoDeOutroProjeto.cliente.storage.from("anexos").download(caminhoTarefa);
    expect(baixa.data).toBeNull();
  });

  it("ninguém grava arquivo do financeiro num caminho de outro tipo nem sem ser dono", async () => {
    const r = await membroDoProjeto.cliente.storage
      .from("anexos")
      .upload(`${tenantId}/conta_a_pagar/${crypto.randomUUID()}/x.txt`, new Blob(["x"]), { contentType: "text/plain" });
    expect(r.error).not.toBeNull();
  });

  it("conta logada NÃO cria workspace chamando a RPC direto (cadastro fechado não é mais burlável)", async () => {
    const antiga = await convidadoDeOutroProjeto.cliente.rpc("garantir_workspace_pessoal", { p_nome: "burla" });
    expect(antiga.error).not.toBeNull();
    const nova = await convidadoDeOutroProjeto.cliente.rpc("garantir_workspace_pessoal_para", {
      p_user_id: convidadoDeOutroProjeto.userId,
      p_nome: "burla",
    });
    expect(nova.error).not.toBeNull();
  });

  it("o servidor (service role) ainda cria o workspace de quem foi liberado, sem duplicar", async () => {
    const novo = await criarUsuarioDeTeste(service, "seg-liberado");
    const a = await service.rpc("garantir_workspace_pessoal_para", { p_user_id: novo.userId, p_nome: "Workspace liberado" });
    const b = await service.rpc("garantir_workspace_pessoal_para", { p_user_id: novo.userId, p_nome: "Workspace liberado" });
    expect(a.error).toBeNull();
    expect(b.data).toBe(a.data);
    await service.from("tenants").delete().eq("id", a.data as string);
    await apagarUsuarioDeTeste(service, novo.userId);
  });
});
