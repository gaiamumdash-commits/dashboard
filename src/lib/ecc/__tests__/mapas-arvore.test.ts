import { describe, it, expect } from "vitest";
import {
  caminhoAte,
  contarDescendentes,
  filhosPorPai,
  lerListaIndentada,
  ordemEntre,
  ordemParaNovo,
  planoMovimento,
} from "@/lib/ecc/mapas/arvore";

// raiz
// ├─ a (1)
// │  ├─ a1 (1)
// │  └─ a2 (2)
// ├─ b (2)
// └─ c (3)
const nos = [
  { id: "raiz", pai_id: null, ordem: 0 },
  { id: "c", pai_id: "raiz", ordem: 3 },
  { id: "a", pai_id: "raiz", ordem: 1 },
  { id: "b", pai_id: "raiz", ordem: 2 },
  { id: "a2", pai_id: "a", ordem: 2 },
  { id: "a1", pai_id: "a", ordem: 1 },
];

describe("árvore do mapa", () => {
  it("ordena os filhos e conta o que está dentro de cada ramo", () => {
    const filhos = filhosPorPai(nos);
    expect(filhos.get("raiz")!.map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(contarDescendentes(filhos, "raiz")).toBe(5);
    expect(contarDescendentes(filhos, "a")).toBe(2);
    expect(contarDescendentes(filhos, "b")).toBe(0);
  });

  it("caminho de volta do modo foco vai da ideia central até o ramo", () => {
    expect(caminhoAte(nos, "a2").map((n) => n.id)).toEqual(["raiz", "a", "a2"]);
    expect(caminhoAte(nos, "nao-existe")).toEqual([]);
  });

  it("ordem nova fica entre os vizinhos, sem renumerar", () => {
    expect(ordemEntre(1, 2)).toBe(1.5);
    expect(ordemEntre(3, null)).toBe(4);
    expect(ordemEntre(null, 1)).toBe(0);
    expect(ordemEntre(null, null)).toBe(1);
    expect(ordemParaNovo(nos, "raiz", "a")).toBe(1.5);
    expect(ordemParaNovo(nos, "raiz")).toBe(4);
    expect(ordemParaNovo(nos, "b")).toBe(1);
  });

  it("subir, descer, entrar e sair", () => {
    expect(planoMovimento(nos, "b", "cima")).toEqual({ pai_id: "raiz", ordem: 0 });
    expect(planoMovimento(nos, "a", "cima")).toBeNull();
    expect(planoMovimento(nos, "a", "baixo")).toEqual({ pai_id: "raiz", ordem: 2.5 });
    expect(planoMovimento(nos, "c", "baixo")).toBeNull();
    // b entra em a: vira o último filho de a
    expect(planoMovimento(nos, "b", "dentro")).toEqual({ pai_id: "a", ordem: 3 });
    expect(planoMovimento(nos, "a", "dentro")).toBeNull();
    // a1 sai de a: vira irmão de a, logo depois dele
    expect(planoMovimento(nos, "a1", "fora")).toEqual({ pai_id: "raiz", ordem: 1.5 });
    expect(planoMovimento(nos, "a", "fora")).toBeNull();
    expect(planoMovimento(nos, "raiz", "baixo")).toBeNull();
  });

  it("lista colada vira ramos, respeitando o recuo e tirando marcadores", () => {
    const texto = ["Lançamento", "  - Copy", "  - Anúncios", "\t1. Meta", "  • Data: sexta", "", "Orçamento", "## Equipe"].join("\r\n");
    expect(lerListaIndentada(texto)).toEqual({
      itens: [
        { texto: "Lançamento", pai: -1 },
        { texto: "Copy", pai: 0 },
        { texto: "Anúncios", pai: 0 },
        { texto: "Meta", pai: 2 },
        { texto: "Data: sexta", pai: 0 },
        { texto: "Orçamento", pai: -1 },
        { texto: "Equipe", pai: -1 },
      ],
      cortados: 0,
    });
  });

  it("lista colada respeita o limite de ramos", () => {
    const r = lerListaIndentada("a\nb\nc\nd", 2);
    expect(r.itens.map((i) => i.texto)).toEqual(["a", "b"]);
    expect(r.cortados).toBe(2);
  });
});
