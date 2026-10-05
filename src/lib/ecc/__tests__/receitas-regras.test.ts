import { describe, it, expect } from "vitest";
import {
  agruparReceitasPorPeriodo,
  lerValorMonetario,
  primeiroDiaDoMesDe,
  rotuloDoMes,
  validarNovaReceita,
} from "@/lib/ecc/receitas-regras";

const BASE = { descricao: "Site do cliente X", valor: "1500", dataPrevista: "2026-10-20" };

describe("lerValorMonetario", () => {
  it("lê número com ponto decimal (o que o input type=number manda)", () => {
    expect(lerValorMonetario("1500.5")).toBe(1500.5);
  });

  it("lê o formato brasileiro com milhar e vírgula", () => {
    expect(lerValorMonetario("1.500,50")).toBe(1500.5);
  });

  it("aceita prefixo R$", () => {
    expect(lerValorMonetario("R$ 200")).toBe(200);
  });

  it("devolve NaN pra texto que não é número", () => {
    expect(lerValorMonetario("abc")).toBeNaN();
    expect(lerValorMonetario("")).toBeNaN();
    expect(lerValorMonetario("-10")).toBeNaN();
  });
});

describe("agruparReceitasPorPeriodo", () => {
  const r = (mes_referencia: string, recebida = false, id = mes_referencia) => ({ id, mes_referencia, recebida });

  it("separa mês atual e próximos meses em ordem (parcelas lançadas de uma vez)", () => {
    const g = agruparReceitasPorPeriodo([r("2026-12-01"), r("2026-10-01"), r("2026-11-01")], "2026-10-01");
    expect(g.doMes.map((x) => x.id)).toEqual(["2026-10-01"]);
    expect(g.proximosMeses.map((m) => m.mesReferencia)).toEqual(["2026-11-01", "2026-12-01"]);
  });

  it("junta várias receitas do mesmo mês futuro", () => {
    const g = agruparReceitasPorPeriodo([r("2026-11-01", false, "a"), r("2026-11-01", false, "b")], "2026-10-01");
    expect(g.proximosMeses).toHaveLength(1);
    expect(g.proximosMeses[0].receitas.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("mês anterior não recebido aparece como atrasado; já recebido some", () => {
    const g = agruparReceitasPorPeriodo([r("2026-09-01", false, "pendente"), r("2026-09-01", true, "ok")], "2026-10-01");
    expect(g.atrasadas.map((x) => x.id)).toEqual(["pendente"]);
    expect(g.doMes).toEqual([]);
  });
});

describe("rotuloDoMes", () => {
  it("escreve mês por extenso", () => {
    expect(rotuloDoMes("2026-11-01")).toBe("novembro de 2026");
  });
});

describe("primeiroDiaDoMesDe", () => {
  it("leva a data pro dia 1 do mesmo mês", () => {
    expect(primeiroDiaDoMesDe("2026-10-20")).toBe("2026-10-01");
  });
});

describe("validarNovaReceita", () => {
  it("aceita só os 3 campos obrigatórios e deixa o resto nulo", () => {
    const r = validarNovaReceita(BASE);
    expect(r).toEqual({
      ok: true,
      receita: {
        descricao: "Site do cliente X",
        valor: 1500,
        dataPrevista: "2026-10-20",
        mesReferencia: "2026-10-01",
        categoria: null,
        projetoId: null,
      },
    });
  });

  it("guarda categoria e projeto quando informados", () => {
    const r = validarNovaReceita({ ...BASE, categoria: "servico", projetoId: "abc" });
    expect(r.ok && r.receita.categoria).toBe("servico");
    expect(r.ok && r.receita.projetoId).toBe("abc");
  });

  it("recusa descrição vazia", () => {
    expect(validarNovaReceita({ ...BASE, descricao: "   " }).ok).toBe(false);
  });

  it("recusa descrição longa demais", () => {
    expect(validarNovaReceita({ ...BASE, descricao: "x".repeat(201) }).ok).toBe(false);
  });

  it("recusa valor zero, negativo ou não numérico", () => {
    expect(validarNovaReceita({ ...BASE, valor: "0" }).ok).toBe(false);
    expect(validarNovaReceita({ ...BASE, valor: "-5" }).ok).toBe(false);
    expect(validarNovaReceita({ ...BASE, valor: "muito" }).ok).toBe(false);
  });

  it("arredonda o valor pra centavos", () => {
    const r = validarNovaReceita({ ...BASE, valor: "10.006" });
    expect(r.ok && r.receita.valor).toBe(10.01);
  });

  it("recusa data ausente ou impossível", () => {
    expect(validarNovaReceita({ ...BASE, dataPrevista: "" }).ok).toBe(false);
    expect(validarNovaReceita({ ...BASE, dataPrevista: "2026-02-30" }).ok).toBe(false);
  });

  it("recusa categoria fora da lista", () => {
    expect(validarNovaReceita({ ...BASE, categoria: "salario" }).ok).toBe(false);
  });
});
