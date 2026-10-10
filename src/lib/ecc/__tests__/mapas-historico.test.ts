import { describe, it, expect } from "vitest";
import { desfazer, devolverAoPassado, historicoVazio, refazer, registrar, LIMITE_HISTORICO, type Operacao } from "@/lib/ecc/mapas/historico";
import { subarvore } from "@/lib/ecc/mapas/arvore";

const texto = (n: number): Operacao => ({ tipo: "texto", id: "a", antes: `v${n}`, depois: `v${n + 1}` });

describe("desfazer/refazer do mapa", () => {
  it("desfaz e refaz na ordem certa; operação nova apaga o refazer", () => {
    let h = registrar(registrar(historicoVazio(), texto(1)), texto(2));
    const d = desfazer(h)!;
    expect(d.op).toEqual(texto(2));
    h = d.historico;
    expect(h.futuro).toEqual([texto(2)]);
    const r = refazer(h)!;
    expect(r.op).toEqual(texto(2));
    h = registrar(desfazer(r.historico)!.historico, texto(9));
    expect(h.futuro).toEqual([]);
    expect(h.passado.at(-1)).toEqual(texto(9));
  });

  it("sem nada pra desfazer/refazer devolve null", () => {
    expect(desfazer(historicoVazio())).toBeNull();
    expect(refazer(historicoVazio())).toBeNull();
  });

  it("guarda só as últimas operações", () => {
    let h = historicoVazio();
    for (let i = 0; i < LIMITE_HISTORICO + 10; i++) h = registrar(h, texto(i));
    expect(h.passado).toHaveLength(LIMITE_HISTORICO);
    expect(h.passado[0]).toEqual(texto(10));
  });

  it("se o desfazer falhar no servidor, a operação volta pro histórico", () => {
    const h = registrar(historicoVazio(), texto(1));
    const d = desfazer(h)!;
    expect(devolverAoPassado(d.historico, d.op)).toEqual({ passado: [texto(1)], futuro: [] });
  });

  it("sub-árvore pra desfazer exclusão: o ramo e tudo dentro, pai antes dos filhos", () => {
    const nos = [
      { id: "r", pai_id: null, ordem: 0 },
      { id: "a", pai_id: "r", ordem: 1 },
      { id: "a2", pai_id: "a", ordem: 2 },
      { id: "a1", pai_id: "a", ordem: 1 },
      { id: "a1x", pai_id: "a1", ordem: 1 },
      { id: "b", pai_id: "r", ordem: 2 },
    ];
    expect(subarvore(nos, "a").map((n) => n.id)).toEqual(["a", "a1", "a2", "a1x"]);
    expect(subarvore(nos, "x")).toEqual([]);
  });
});
