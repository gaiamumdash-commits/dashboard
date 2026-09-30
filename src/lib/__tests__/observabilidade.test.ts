import { describe, it, expect, vi, afterEach } from "vitest";
import { registrarErro, registrarInfo, gerarIdCorrelacao } from "@/lib/observabilidade";

describe("registrarErro — log estruturado, nunca lança exceção", () => {
  afterEach(() => vi.restoreAllMocks());

  it("devolve um idCorrelacao gerado quando nenhum é informado", () => {
    const id = registrarErro({ operacao: "teste.op", erro: new Error("falhou") });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("preserva o idCorrelacao informado em vez de gerar um novo", () => {
    const meuId = gerarIdCorrelacao();
    const id = registrarErro({ operacao: "teste.op", idCorrelacao: meuId, erro: "algo" });
    expect(id).toBe(meuId);
  });

  it("grava uma única linha JSON válida via console.error, com os campos esperados", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    registrarErro({
      operacao: "cron.teste",
      severidade: "critical",
      contexto: { tentativas: 3, sucesso: false },
      erro: new Error("banco indisponível"),
    });

    expect(spy).toHaveBeenCalledOnce();
    const linha = JSON.parse(spy.mock.calls[0][0] as string);
    expect(linha.operacao).toBe("cron.teste");
    expect(linha.nivel).toBe("critical");
    expect(linha.contexto).toEqual({ tentativas: 3, sucesso: false });
    expect(linha.mensagemErro).toBe("banco indisponível");
    expect(typeof linha.idCorrelacao).toBe("string");
    expect(typeof linha.timestamp).toBe("string");
  });

  it("nunca lança, mesmo se o contexto tivesse algo não serializável (defesa em profundidade)", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() =>
      registrarErro({ operacao: "teste.circular", contexto: { valor: String(circular) } }),
    ).not.toThrow();
  });
});

describe("registrarInfo — mesmo formato, nível 'info', sem campo de erro", () => {
  it("grava nivel info e mensagemErro undefined", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    registrarInfo({ operacao: "cron.ok", contexto: { processados: 10 } });

    const linha = JSON.parse(spy.mock.calls[0][0] as string);
    expect(linha.nivel).toBe("info");
    expect(linha.mensagemErro).toBeUndefined();
    spy.mockRestore();
  });
});
