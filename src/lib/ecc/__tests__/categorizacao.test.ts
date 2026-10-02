import { describe, it, expect } from "vitest";
import { sugerirCategoria } from "@/lib/ecc/categorizacao";
import type { RegraCategoria } from "@/lib/ecc/tipos";

function regra(palavra: string, categoria: RegraCategoria["categoria"]): RegraCategoria {
  return {
    id: crypto.randomUUID(),
    tenant_id: "t1",
    palavra_chave: palavra,
    categoria,
    criado_em: new Date().toISOString(),
  };
}

describe("sugerirCategoria — categorização financeira 100% determinística (sem IA)", () => {
  it("casa a primeira regra cuja palavra-chave aparece na descrição, case-insensitive", () => {
    const regras = [regra("mercado", "consumo"), regra("aluguel", "despesa")];
    expect(sugerirCategoria("MERCADO LIVRE PAGAMENTOS", regras)).toBe("consumo");
  });

  it("devolve null quando nenhuma regra bate", () => {
    const regras = [regra("mercado", "consumo")];
    expect(sugerirCategoria("posto de gasolina", regras)).toBeNull();
  });

  it("a primeira regra que bate vence, mesmo se outra também bateria (ordem importa)", () => {
    const regras = [regra("conta", "despesa"), regra("conta de luz", "consumo")];
    expect(sugerirCategoria("pagamento conta de luz", regras)).toBe("despesa");
  });

  it("sem regras cadastradas, nunca sugere categoria", () => {
    expect(sugerirCategoria("qualquer coisa", [])).toBeNull();
  });
});
