import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Stub de IA nos testes automatizados (nunca chama o Gemini de verdade) —
 * mesmo padrão de bloqueio-nao-chama-provedor.test.ts. Cobre os critérios de
 * aceite do pedido do Fabio: usuário sem permissão não usa IA, limite
 * bloqueado não chama o provedor, e resposta inválida gera erro recuperável
 * (nunca lança exceção não tratada — Next.js redigiria a mensagem real em
 * produção, ver src/lib/erro-cliente.ts).
 */

const garantirWorkspaceMock = vi.fn().mockResolvedValue("tenant-1");
vi.mock("@/lib/ecc/workspace", () => ({ garantirWorkspace: garantirWorkspaceMock }));

const obterUsuarioAtualMock = vi.fn().mockResolvedValue({ id: "user-1", email: "user@teste.invalid" });
const createClientMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  obterUsuarioAtual: obterUsuarioAtualMock,
  createClient: createClientMock,
}));

const obterPapelAtualMock = vi.fn().mockResolvedValue("owner");
vi.mock("@/lib/ecc/equipe", () => ({ obterPapelAtual: obterPapelAtualMock }));

const verificarRateLimitIAMock = vi.fn();
vi.mock("@/lib/ecc/ia-rate-limit", () => ({ verificarRateLimitIA: verificarRateLimitIAMock }));

const registrarConsumoIAMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/ecc/ia-consumo", () => ({ registrarConsumoIA: registrarConsumoIAMock }));

const gerarJsonComGeminiMock = vi.fn();
vi.mock("@/lib/ecc/gemini", () => ({
  gerarJsonComGemini: gerarJsonComGeminiMock,
  mensagemDeErroGemini: (erro: unknown) => (erro instanceof Error ? erro.message : "erro"),
  MODELO_GEMINI_PADRAO: "gemini-3.1-flash-lite",
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  garantirWorkspaceMock.mockResolvedValue("tenant-1");
  obterUsuarioAtualMock.mockResolvedValue({ id: "user-1", email: "user@teste.invalid" });
  obterPapelAtualMock.mockResolvedValue("owner");
});

describe("gerarSugestoesProjetoIA", () => {
  it("usuário sem permissão (não-owner) → erro, Gemini nunca é chamado", async () => {
    obterPapelAtualMock.mockResolvedValue("member");
    const { gerarSugestoesProjetoIA } = await import("@/lib/ecc/planejamento-ia-actions");

    const resultado = await gerarSugestoesProjetoIA("festa de aniversário");

    expect(resultado.status).toBe("erro");
    expect(gerarJsonComGeminiMock).not.toHaveBeenCalled();
  });

  it("rate limit bloqueado → erro, Gemini nunca é chamado", async () => {
    verificarRateLimitIAMock.mockResolvedValue({ permitido: false, motivo: "Muitos pedidos — espere um minuto." });
    const { gerarSugestoesProjetoIA } = await import("@/lib/ecc/planejamento-ia-actions");

    const resultado = await gerarSugestoesProjetoIA("festa de aniversário");

    expect(resultado.status).toBe("erro");
    if (resultado.status === "erro") expect(resultado.mensagem).toMatch(/minuto/i);
    expect(gerarJsonComGeminiMock).not.toHaveBeenCalled();
  });

  it("contexto vazio → erro, Gemini nunca é chamado (nem o rate limit é consultado)", async () => {
    verificarRateLimitIAMock.mockResolvedValue({ permitido: true });
    const { gerarSugestoesProjetoIA } = await import("@/lib/ecc/planejamento-ia-actions");

    const resultado = await gerarSugestoesProjetoIA("   ");

    expect(resultado.status).toBe("erro");
    expect(gerarJsonComGeminiMock).not.toHaveBeenCalled();
  });

  it("liberado → chama o Gemini e devolve a prévia interpretada", async () => {
    verificarRateLimitIAMock.mockResolvedValue({ permitido: true });
    gerarJsonComGeminiMock.mockResolvedValue({
      texto: JSON.stringify({ status: "ok", sugestoes: [{ titulo: "Definir data", recomendacao: "essencial" }] }),
      provedor: "gemini",
      modelo: "gemini-3.1-flash-lite",
      uso: { promptTokens: 10, candidatesTokens: 5, totalTokens: 15 },
    });
    const { gerarSugestoesProjetoIA } = await import("@/lib/ecc/planejamento-ia-actions");

    const resultado = await gerarSugestoesProjetoIA("festa de aniversário de 8 anos");

    expect(gerarJsonComGeminiMock).toHaveBeenCalledTimes(1);
    expect(resultado.status).toBe("ok");
    expect(registrarConsumoIAMock).toHaveBeenCalledWith(expect.objectContaining({ sucesso: true }));
  });

  it("resposta do Gemini num formato inválido → erro recuperável, não lança exceção", async () => {
    verificarRateLimitIAMock.mockResolvedValue({ permitido: true });
    gerarJsonComGeminiMock.mockResolvedValue({ texto: "não é json {{{", provedor: "gemini", modelo: "gemini-3.1-flash-lite" });
    const { gerarSugestoesProjetoIA } = await import("@/lib/ecc/planejamento-ia-actions");

    const resultado = await gerarSugestoesProjetoIA("contexto qualquer");

    expect(resultado.status).toBe("erro");
  });

  it("falha do provedor (exceção do SDK) → erro recuperável, registra consumo como falha", async () => {
    verificarRateLimitIAMock.mockResolvedValue({ permitido: true });
    gerarJsonComGeminiMock.mockRejectedValue(new Error("Falha de rede"));
    const { gerarSugestoesProjetoIA } = await import("@/lib/ecc/planejamento-ia-actions");

    const resultado = await gerarSugestoesProjetoIA("contexto qualquer");

    expect(resultado.status).toBe("erro");
    expect(registrarConsumoIAMock).toHaveBeenCalledWith(expect.objectContaining({ sucesso: false }));
  });
});

describe("criarProjetoComPlanejamentoIA", () => {
  it("usuário sem permissão (não-owner) → erro, RPC nunca é chamada", async () => {
    obterPapelAtualMock.mockResolvedValue("member");
    const { criarProjetoComPlanejamentoIA } = await import("@/lib/ecc/planejamento-ia-actions");

    const resultado = await criarProjetoComPlanejamentoIA({
      nome: "Projeto",
      idempotencyKey: "abcdefgh",
      tarefas: [],
    });

    expect(resultado.status).toBe("erro");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("payload fora do schema (ex.: sem idempotencyKey) → erro recuperável, RPC nunca é chamada", async () => {
    const { criarProjetoComPlanejamentoIA } = await import("@/lib/ecc/planejamento-ia-actions");

    const resultado = await criarProjetoComPlanejamentoIA({ nome: "Projeto", tarefas: [] });

    expect(resultado.status).toBe("erro");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("payload válido → chama a RPC com os campos resolvidos no servidor (tenant via garantirWorkspace, nunca do input)", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: "projeto-123", error: null });
    createClientMock.mockResolvedValue({ rpc: rpcMock });
    const { criarProjetoComPlanejamentoIA } = await import("@/lib/ecc/planejamento-ia-actions");

    const resultado = await criarProjetoComPlanejamentoIA({
      nome: "Aniversário do João",
      descricao: "30 pessoas, salão",
      idempotencyKey: "abcdefgh",
      tarefas: [{ titulo: "Definir data", checklist: ["Confirmar salão"] }],
    });

    expect(resultado).toEqual({ status: "ok", projetoId: "projeto-123" });
    expect(rpcMock).toHaveBeenCalledWith(
      "criar_projeto_planejado_ia",
      expect.objectContaining({ p_tenant_id: "tenant-1", p_idempotency_key: "abcdefgh" }),
    );
  });

  it("erro da RPC (ex.: falha de rede) → erro recuperável, nunca lança exceção", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    createClientMock.mockResolvedValue({ rpc: rpcMock });
    const { criarProjetoComPlanejamentoIA } = await import("@/lib/ecc/planejamento-ia-actions");

    const resultado = await criarProjetoComPlanejamentoIA({ nome: "Projeto", idempotencyKey: "abcdefgh", tarefas: [] });

    expect(resultado.status).toBe("erro");
  });
});
