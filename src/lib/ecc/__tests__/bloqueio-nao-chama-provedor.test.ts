import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * "Tentativa bloqueada não chega ao provedor, usando stub" — critério de
 * aceite do P0 (5.3/5.5). O ponto central: o custo de uma tentativa
 * bloqueada é sempre ZERO porque o provedor (Gemini) nunca chega a ser
 * chamado quando o rate limit nega — aqui isso é provado com um stub do
 * SDK, não inferido da leitura do código.
 */

const garantirWorkspaceMock = vi.fn().mockResolvedValue("tenant-1");
vi.mock("@/lib/ecc/workspace", () => ({ garantirWorkspace: garantirWorkspaceMock }));

const obterUsuarioAtualMock = vi.fn().mockResolvedValue({ id: "user-1", email: "user@teste.invalid" });
vi.mock("@/lib/supabase/server", () => ({ obterUsuarioAtual: obterUsuarioAtualMock }));

const transcreverAudioComGeminiMock = vi.fn();
const gerarTextoComGeminiMock = vi.fn();
vi.mock("@/lib/ecc/gemini", () => ({
  transcreverAudioComGemini: transcreverAudioComGeminiMock,
  gerarTextoComGemini: gerarTextoComGeminiMock,
  mensagemDeErroGemini: (erro: unknown) => (erro instanceof Error ? erro.message : "erro"),
  MODELO_GEMINI_PADRAO: "gemini-3.1-flash-lite",
}));

const registrarConsumoIAMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/ecc/ia-consumo", () => ({ registrarConsumoIA: registrarConsumoIAMock }));

const verificarRateLimitIAMock = vi.fn();
vi.mock("@/lib/ecc/ia-rate-limit", () => ({ verificarRateLimitIA: verificarRateLimitIAMock }));

describe("Rate limit bloqueado → provedor de IA NUNCA é chamado (stub)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    garantirWorkspaceMock.mockResolvedValue("tenant-1");
    obterUsuarioAtualMock.mockResolvedValue({ id: "user-1", email: "user@teste.invalid" });
  });

  it("transcreverAudioParaTexto: bloqueado pelo rate limit → transcreverAudioComGemini nunca é invocado", async () => {
    verificarRateLimitIAMock.mockResolvedValue({ permitido: false, motivo: "Muitos pedidos — espere um minuto." });

    const { transcreverAudioParaTexto } = await import("@/lib/ecc/transcricao-audio");

    const formData = new FormData();
    formData.set("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }));

    const resultado = await transcreverAudioParaTexto(formData);

    expect(resultado.erro).toMatch(/minuto/i);
    expect(resultado.texto).toBeNull();
    expect(transcreverAudioComGeminiMock).not.toHaveBeenCalled(); // o ponto central do teste.
    expect(registrarConsumoIAMock).not.toHaveBeenCalled(); // nem log de consumo — não houve chamada nenhuma ao provedor.
  });

  it("transcreverAudioParaTexto: liberado pelo rate limit → transcreverAudioComGemini É invocado normalmente", async () => {
    verificarRateLimitIAMock.mockResolvedValue({ permitido: true });
    transcreverAudioComGeminiMock.mockResolvedValue({
      texto: "compromisso amanhã às 10h",
      provedor: "gemini",
      modelo: "gemini-3.1-flash-lite",
      uso: { promptTokens: 10, candidatesTokens: 5, totalTokens: 15 },
    });

    const { transcreverAudioParaTexto } = await import("@/lib/ecc/transcricao-audio");

    const formData = new FormData();
    formData.set("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }));

    const resultado = await transcreverAudioParaTexto(formData);

    expect(resultado.erro).toBeNull();
    expect(transcreverAudioComGeminiMock).toHaveBeenCalledTimes(1); // confirma que o mock não está sempre bloqueando por acidente.
  });
});
