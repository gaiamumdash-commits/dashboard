import { describe, it, expect } from "vitest";
import { calcularAlinhamentoGaiamum, alinhamentoTemDadosReais } from "@/lib/ecc/visao-360";

describe("calcularAlinhamentoGaiamum — score 100% determinístico (sem IA)", () => {
  it("sem nenhum dado (projeto vazio, sem meta), o único fator computável é meta_smart=0 — score fecha em 0", () => {
    const r = calcularAlinhamentoGaiamum({
      metaSmartId: null,
      tarefas: [],
      colunasConcluidoIds: new Set(),
      indicadores: [],
    });
    expect(r.score).toBe(0);
    const fatorMeta = r.fatores.find((f) => f.chave === "meta_smart")!;
    expect(fatorMeta.pesoEfetivo).toBe(100);
  });

  it("com meta SMART vinculada e nada mais, o score é 100 (único fator com dado)", () => {
    const r = calcularAlinhamentoGaiamum({
      metaSmartId: "meta-1",
      tarefas: [],
      colunasConcluidoIds: new Set(),
      indicadores: [],
    });
    expect(r.score).toBe(100);
  });

  it("redistribui peso: indicador na meta some do denominador quando não há indicador (só 3 fatores contam)", () => {
    const r = calcularAlinhamentoGaiamum({
      metaSmartId: "meta-1",
      tarefas: [{ data_limite: null, coluna_id: "c1" }],
      colunasConcluidoIds: new Set(["c-concluido"]),
      indicadores: [],
    });
    const fatorIndicadores = r.fatores.find((f) => f.chave === "indicadores")!;
    expect(fatorIndicadores.valor).toBeNull();
    expect(fatorIndicadores.pesoEfetivo).toBeNull();
  });

  it("tarefa atrasada reduz o fator de atraso proporcionalmente", () => {
    const r = calcularAlinhamentoGaiamum({
      metaSmartId: null,
      tarefas: [
        { data_limite: "2020-01-01", coluna_id: "aberta" },
        { data_limite: "2099-01-01", coluna_id: "aberta" },
      ],
      colunasConcluidoIds: new Set(),
      indicadores: [],
    });
    const fatorAtraso = r.fatores.find((f) => f.chave === "atraso")!;
    // 1 de 2 tarefas com prazo está atrasada -> 100 * (1 - 1/2) = 50
    expect(fatorAtraso.valor).toBe(50);
  });

  it("indicador acima da meta é limitado a 100% (nunca conta acima disso a favor do score)", () => {
    const r = calcularAlinhamentoGaiamum({
      metaSmartId: null,
      tarefas: [],
      colunasConcluidoIds: new Set(),
      indicadores: [{ valor_atual: 200, meta: 100 }],
    });
    const fatorIndicadores = r.fatores.find((f) => f.chave === "indicadores")!;
    expect(fatorIndicadores.valor).toBe(100);
  });
});

describe("alinhamentoTemDadosReais — decide se vale a pena gastar uma chamada de IA pra explicar o score", () => {
  it("projeto totalmente vazio, sem meta SMART: não vale a pena chamar IA", () => {
    const r = calcularAlinhamentoGaiamum({
      metaSmartId: null,
      tarefas: [],
      colunasConcluidoIds: new Set(),
      indicadores: [],
    });
    expect(alinhamentoTemDadosReais(r)).toBe(false);
  });

  it("com meta SMART vinculada, já vale a pena (fator meta_smart sempre computável)", () => {
    const r = calcularAlinhamentoGaiamum({
      metaSmartId: "meta-1",
      tarefas: [],
      colunasConcluidoIds: new Set(),
      indicadores: [],
    });
    expect(alinhamentoTemDadosReais(r)).toBe(true);
  });

  it("sem meta SMART, mas com tarefas reais, também vale a pena", () => {
    const r = calcularAlinhamentoGaiamum({
      metaSmartId: null,
      tarefas: [{ data_limite: null, coluna_id: "c1" }],
      colunasConcluidoIds: new Set(),
      indicadores: [],
    });
    expect(alinhamentoTemDadosReais(r)).toBe(true);
  });
});
