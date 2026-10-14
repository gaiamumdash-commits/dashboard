import { describe, it, expect, vi, beforeEach } from "vitest";
import { mimePelaAssinatura, validarMapaDaIA } from "@/lib/ecc/mapas/importar-ia-regras";
import { itensParaLinhas, linhasParaItens, mudarNivel, removerLinha, type LinhaPrevia } from "@/lib/ecc/mapas/importar";
import { MAX_NOS_POR_MAPA } from "@/lib/ecc/mapas/tipos";

/**
 * Importar mapa por foto/PDF: validação da resposta da IA, edição da prévia
 * e a Server Action com o Gemini SEMPRE mockado (nenhuma chamada paga).
 */

const garantirWorkspaceMock = vi.fn().mockResolvedValue("tenant-1");
vi.mock("@/lib/ecc/workspace", () => ({ garantirWorkspace: garantirWorkspaceMock }));

const obterUsuarioAtualMock = vi.fn().mockResolvedValue({ id: "user-1", email: "user@teste.invalid" });
vi.mock("@/lib/supabase/server", () => ({ obterUsuarioAtual: obterUsuarioAtualMock }));

const lerMapaMentalComGeminiMock = vi.fn();
class ErroConfiguracaoIAFalso extends Error {}
vi.mock("@/lib/ecc/gemini", () => ({
  lerMapaMentalComGemini: lerMapaMentalComGeminiMock,
  // Mesma regra do módulo real: configuração ausente vira mensagem genérica.
  mensagemDeErroGemini: (erro: unknown) =>
    erro instanceof ErroConfiguracaoIAFalso
      ? "Os recursos de IA estão indisponíveis no momento. Tente mais tarde."
      : "O Gemini não respondeu (503) — tente de novo.",
  MODELO_GEMINI_PADRAO: "gemini-3.1-flash-lite",
  MODELO_GEMINI_VISAO: "gemini-flash-latest",
}));

const registrarConsumoIAMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/ecc/ia-consumo", () => ({ registrarConsumoIA: registrarConsumoIAMock }));

const verificarRateLimitIAMock = vi.fn();
vi.mock("@/lib/ecc/ia-rate-limit", () => ({ verificarRateLimitIA: verificarRateLimitIAMock }));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function respostaIA(nos: unknown[], status = "ok") {
  return JSON.stringify({ status, nos });
}

describe("validarMapaDaIA", () => {
  it("aceita um mapa válido, mantém a ordem e conta os incertos", () => {
    const r = validarMapaDaIA(
      respostaIA([
        { id: "n1", pai: null, texto: "Viagem" },
        { id: "n2", pai: "n1", texto: "Roteiro" },
        { id: "n3", pai: "n2", texto: "Lis\nboa", incerto: true },
        { id: "n4", pai: "n1", texto: "Orçamento" },
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.raiz.texto).toBe("Viagem");
    expect(r.raiz.filhos.map((f) => f.texto)).toEqual(["Roteiro", "Orçamento"]);
    expect(r.raiz.filhos[0].filhos[0]).toMatchObject({ texto: "Lis boa", incerto: true });
    expect(r.incertos).toBe(1);
  });

  it("lado só nos filhos diretos do centro; cor da paleta; valor estranho vira 'sem' sem invalidar", () => {
    const r = validarMapaDaIA(
      respostaIA([
        { id: "c", pai: null, texto: "AZEVEDO - CV HUNTER", lado: "direita" },
        { id: "d", pai: "c", texto: "13/10/26", lado: "direita", cor: "laranja" },
        { id: "p", pai: "d", texto: "Produto", lado: "esquerda", cor: "amarelo" },
        { id: "x", pai: "d", texto: "Estranho", cor: "magenta" },
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.raiz).not.toHaveProperty("lado");
    expect(r.raiz.filhos[0]).toMatchObject({ texto: "13/10/26", lado: 1, cor: "laranja" });
    expect(r.raiz.filhos[0].filhos[0]).not.toHaveProperty("lado"); // neto não tem lado
    expect(r.raiz.filhos[0].filhos[0].cor).toBe("amarelo");
    expect(r.raiz.filhos[0].filhos[1]).not.toHaveProperty("cor");
  });

  it("sem_mapa ou lista vazia → motivo sem_mapa", () => {
    expect(validarMapaDaIA(respostaIA([], "sem_mapa"))).toMatchObject({ ok: false, motivo: "sem_mapa" });
    expect(validarMapaDaIA(respostaIA([]))).toMatchObject({ ok: false, motivo: "sem_mapa" });
  });

  it.each([
    ["JSON quebrado", "{nos: ["],
    ["fora do schema", JSON.stringify({ status: "ok", nos: [{ id: 1, pai: null, texto: "x" }] })],
    ["dois centros", respostaIA([{ id: "a", pai: null, texto: "A" }, { id: "b", pai: null, texto: "B" }])],
    ["nenhum centro (ciclo a↔b)", respostaIA([{ id: "a", pai: "b", texto: "A" }, { id: "b", pai: "a", texto: "B" }])],
    ["ciclo fora do centro", respostaIA([{ id: "c", pai: null, texto: "C" }, { id: "a", pai: "b", texto: "A" }, { id: "b", pai: "a", texto: "B" }])],
    ["pai inexistente", respostaIA([{ id: "c", pai: null, texto: "C" }, { id: "a", pai: "zz", texto: "A" }])],
    ["pai de si mesmo", respostaIA([{ id: "c", pai: null, texto: "C" }, { id: "a", pai: "a", texto: "A" }])],
    ["id repetido", respostaIA([{ id: "c", pai: null, texto: "C" }, { id: "c", pai: "c", texto: "A" }])],
    ["texto vazio", respostaIA([{ id: "c", pai: null, texto: "C" }, { id: "a", pai: "c", texto: "   " }])],
    ["texto acima de 200", respostaIA([{ id: "c", pai: null, texto: "x".repeat(201) }])],
  ])("rejeita: %s", (_, json) => {
    expect(validarMapaDaIA(json)).toMatchObject({ ok: false, motivo: "invalido" });
  });

  it("rejeita mais de 500 nós e profundidade degenerada", () => {
    const muitos = [{ id: "c", pai: null, texto: "C" }, ...Array.from({ length: MAX_NOS_POR_MAPA }, (_, i) => ({ id: `n${i}`, pai: "c", texto: `R${i}` }))];
    expect(validarMapaDaIA(respostaIA(muitos)).ok).toBe(false);
    const fundo = [{ id: "n0", pai: null, texto: "0" }, ...Array.from({ length: 40 }, (_, i) => ({ id: `n${i + 1}`, pai: `n${i}`, texto: `${i + 1}` }))];
    expect(validarMapaDaIA(respostaIA(fundo)).ok).toBe(false);
  });
});

describe("mimePelaAssinatura", () => {
  it("reconhece PNG, JPEG, WEBP, PDF e HEIC pelos bytes; recusa o resto", () => {
    expect(mimePelaAssinatura(PNG)).toBe("image/png");
    expect(mimePelaAssinatura(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(mimePelaAssinatura(new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]))).toBe("image/webp");
    expect(mimePelaAssinatura(new Uint8Array(Buffer.from("%PDF-1.7")))).toBe("application/pdf");
    expect(mimePelaAssinatura(new Uint8Array([0, 0, 0, 0x18, ...Buffer.from("ftypheic")]))).toBe("image/heic");
    expect(mimePelaAssinatura(new Uint8Array(Buffer.from("<html><script>")))).toBeNull();
  });
});

describe("prévia editável", () => {
  const base: LinhaPrevia[] = [
    { texto: "A", nota: null, nivel: 0 },
    { texto: "A1", nota: "n", nivel: 1 },
    { texto: "A1a", nota: null, nivel: 2 },
    { texto: "B", nota: null, nivel: 0 },
  ];

  it("itens ↔ linhas ida e volta preservam a árvore", () => {
    const itens = linhasParaItens(base);
    expect(itens.map((i) => i.pai)).toEqual([-1, 0, 1, -1]);
    expect(itensParaLinhas(itens).map((l) => l.nivel)).toEqual([0, 1, 2, 0]);
  });

  it("recuar leva os filhos; não dá pra recuar o primeiro nem pular nível", () => {
    expect(mudarNivel(base, 3, 1).map((l) => l.nivel)).toEqual([0, 1, 2, 1]);
    expect(mudarNivel(base, 0, 1)).toBe(base);
    expect(mudarNivel(base, 2, 1)).toBe(base);
  });

  it("avançar leva os filhos; nível 0 não avança", () => {
    expect(mudarNivel(base, 1, -1).map((l) => l.nivel)).toEqual([0, 0, 1, 0]);
    expect(mudarNivel(base, 0, -1)).toBe(base);
  });

  it("excluir remove o ramo com tudo o que está dentro", () => {
    expect(removerLinha(base, 1).map((l) => l.texto)).toEqual(["A", "B"]);
  });

  it("lado e cor atravessam a prévia; ramo que sobe pro topo herda o lado do principal de cima", () => {
    const linhas: LinhaPrevia[] = [
      { texto: "A", nota: null, nivel: 0, lado: -1, cor: "azul" },
      { texto: "A1", nota: null, nivel: 1, cor: "verde" },
    ];
    expect(linhasParaItens(linhas)).toEqual([
      { texto: "A", nota: null, pai: -1, lado: -1, cor: "azul" },
      { texto: "A1", nota: null, pai: 0, cor: "verde" },
    ]);
    expect(linhasParaItens(mudarNivel(linhas, 1, -1))[1]).toMatchObject({ pai: -1, lado: -1, cor: "verde" });
  });

  it("linhas com salto de nível são corrigidas (pai sempre válido)", () => {
    const itens = linhasParaItens([{ texto: "A", nota: null, nivel: 3 }, { texto: "B", nota: null, nivel: 5 }]);
    expect(itens.map((i) => i.pai)).toEqual([-1, 0]);
  });
});

describe("lerMapaDeArquivoComIA (Gemini mockado)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    garantirWorkspaceMock.mockResolvedValue("tenant-1");
    obterUsuarioAtualMock.mockResolvedValue({ id: "user-1", email: "user@teste.invalid" });
    verificarRateLimitIAMock.mockResolvedValue({ permitido: true });
  });

  function form(bytes: Uint8Array, tipo = "image/png") {
    const fd = new FormData();
    fd.set("arquivo", new Blob([bytes as BlobPart], { type: tipo }), "mapa.png");
    return fd;
  }

  it("arquivo que não é imagem/PDF (mesmo declarado como PNG) é recusado sem chamar a IA", async () => {
    const { lerMapaDeArquivoComIA } = await import("@/lib/ecc/mapas/importar-ia");
    const r = await lerMapaDeArquivoComIA(form(new Uint8Array(Buffer.from("<svg onload=alert(1)>"))));
    expect(r.erro).toMatch(/não é uma imagem/);
    expect(verificarRateLimitIAMock).not.toHaveBeenCalled();
    expect(lerMapaMentalComGeminiMock).not.toHaveBeenCalled();
  });

  it("limite de uso atingido → provedor nunca é chamado", async () => {
    verificarRateLimitIAMock.mockResolvedValue({ permitido: false, motivo: "Limite de uso de IA atingido — espere um minuto." });
    const { lerMapaDeArquivoComIA } = await import("@/lib/ecc/mapas/importar-ia");
    const r = await lerMapaDeArquivoComIA(form(PNG));
    expect(r.erro).toMatch(/minuto/);
    expect(lerMapaMentalComGeminiMock).not.toHaveBeenCalled();
  });

  it("chave ausente → mensagem genérica, sem nome de variável nem segredo", async () => {
    lerMapaMentalComGeminiMock.mockRejectedValue(new ErroConfiguracaoIAFalso("GEMINI_API_KEY não está configurada"));
    const { lerMapaDeArquivoComIA } = await import("@/lib/ecc/mapas/importar-ia");
    const r = await lerMapaDeArquivoComIA(form(PNG));
    expect(r.erro).toMatch(/indisponíveis/);
    expect(r.erro).not.toMatch(/GEMINI|API_KEY|chave/i);
  });

  it("provedor fora do ar → erro tratado e consumo registrado como falha", async () => {
    lerMapaMentalComGeminiMock.mockRejectedValue(new Error("503"));
    const { lerMapaDeArquivoComIA } = await import("@/lib/ecc/mapas/importar-ia");
    const r = await lerMapaDeArquivoComIA(form(PNG));
    expect(r.raiz).toBeNull();
    expect(registrarConsumoIAMock).toHaveBeenCalledWith(expect.objectContaining({ sucesso: false }));
  });

  it("resposta estruturalmente inválida da IA (ciclo) → erro, nada de árvore", async () => {
    lerMapaMentalComGeminiMock.mockResolvedValue({
      texto: respostaIA([{ id: "a", pai: "b", texto: "A" }, { id: "b", pai: "a", texto: "B" }]),
      provedor: "gemini",
      modelo: "gemini-3.1-flash-lite",
    });
    const { lerMapaDeArquivoComIA } = await import("@/lib/ecc/mapas/importar-ia");
    const r = await lerMapaDeArquivoComIA(form(PNG));
    expect(r.raiz).toBeNull();
    expect(r.erro).toMatch(/não conseguiu montar/);
  });

  it("resposta válida → árvore pra prévia, usando o MIME real e o schema", async () => {
    lerMapaMentalComGeminiMock.mockResolvedValue({
      texto: respostaIA([{ id: "n1", pai: null, texto: "TCC" }, { id: "n2", pai: "n1", texto: "Capítulo 1", incerto: true }]),
      provedor: "gemini",
      modelo: "gemini-3.1-flash-lite",
    });
    const { lerMapaDeArquivoComIA } = await import("@/lib/ecc/mapas/importar-ia");
    const r = await lerMapaDeArquivoComIA(form(PNG, "application/octet-stream"));
    expect(r.erro).toBeNull();
    expect(r.raiz?.texto).toBe("TCC");
    expect(lerMapaMentalComGeminiMock).toHaveBeenCalledWith(expect.any(String), "image/png", expect.objectContaining({ type: "OBJECT" }));
  });
});
