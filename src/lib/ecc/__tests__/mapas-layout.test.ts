import { describe, it, expect } from "vitest";
import {
  caminhoDaAresta,
  calcularLayout,
  dividirLados,
  cameraInicial,
  enquadrar,
  tamanhoDoRamo,
  zoomEm,
  ESCALA_MAX,
  type Caixa,
  type NoParaLayout,
} from "@/lib/ecc/mapas/layout";

function no(id: string, pai: string | null, ordem: number, texto = id, extra: Partial<NoParaLayout> = {}): NoParaLayout {
  return { id, pai_id: pai, ordem, texto, recolhido: false, ...extra };
}

function sobrepoem(a: Caixa, b: Caixa): boolean {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.01 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 0.01;
}

/** Árvore pseudo-aleatória determinística (sem Math.random: teste estável). */
function arvoreGrande(total: number): NoParaLayout[] {
  const nos = [no("r", null, 0, "Ideia central do mapa")];
  let semente = 7;
  const proximo = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 1; i < total; i++) {
    const pai = nos[Math.floor(proximo() * Math.min(nos.length, 1 + i / 3))];
    nos.push(no(`n${i}`, pai.id, i, "palavra ".repeat(1 + Math.floor(proximo() * 12)).trim()));
  }
  return nos;
}

describe("layout do mapa", () => {
  const simples = [no("r", null, 0, "Lançamento"), no("a", "r", 1, "Copy"), no("b", "r", 2), no("c", "r", 3), no("a1", "a", 1), no("a2", "a", 2)];

  it("ideia central em (0,0), ramos principais dos dois lados, filhos do lado do pai", () => {
    const { caixas, arestas } = calcularLayout(simples);
    const raiz = caixas.get("r")!;
    expect([raiz.x, raiz.y, raiz.lado]).toEqual([0, 0, 0]);
    const lados = ["a", "b", "c"].map((id) => caixas.get(id)!.lado);
    expect(lados).toContain(1);
    expect(lados).toContain(-1);
    for (const id of ["a1", "a2"]) {
      const f = caixas.get(id)!;
      expect(f.lado).toBe(caixas.get("a")!.lado);
      expect(f.cor).toBe(caixas.get("a")!.cor);
      expect(Math.sign(f.x - caixas.get("a")!.x)).toBe(f.lado);
    }
    // Uma conexão por ramo visível (menos a ideia central), do pai certo.
    expect(arestas).toHaveLength(5);
    expect(arestas.find((a) => a.para === "a1")!.de).toBe("a");
  });

  it("dividir lados mantém a ordem e equilibra pelo peso", () => {
    expect(dividirLados([10])).toEqual([1]);
    expect(dividirLados([10, 10, 10, 10])).toEqual([1, 1, -1, -1]);
    expect(dividirLados([100, 10, 10])).toEqual([1, -1, -1]);
  });

  it("recolhido esconde os ramos de dentro (e as conexões deles)", () => {
    const { caixas, arestas } = calcularLayout(simples.map((n) => (n.id === "a" ? { ...n, recolhido: true } : n)));
    expect(caixas.has("a")).toBe(true);
    expect(caixas.has("a1")).toBe(false);
    expect(arestas.some((x) => x.para === "a1")).toBe(false);
  });

  it("ramo arrastado (posição manual) leva junto o que está dentro, sem mudar a hierarquia", () => {
    const antes = calcularLayout(simples).caixas;
    const movido = simples.map((n) => (n.id === "a" ? { ...n, pos_x: 400, pos_y: 300 } : n));
    const depois = calcularLayout(movido).caixas;
    expect([depois.get("a")!.x, depois.get("a")!.y]).toEqual([400, 300]);
    expect(depois.get("a")!.manual).toBe(true);
    for (const id of ["a1", "a2"]) {
      // Mesmo deslocamento do pai: a sub-árvore foi junto.
      expect(depois.get(id)!.x - depois.get("a")!.x).toBeCloseTo(antes.get(id)!.x - antes.get("a")!.x);
      expect(depois.get(id)!.y - depois.get("a")!.y).toBeCloseTo(antes.get(id)!.y - antes.get("a")!.y);
    }
    // A entrada não foi alterada (pai_id e ordem continuam os mesmos).
    expect(movido.find((n) => n.id === "a1")).toMatchObject({ pai_id: "a", ordem: 1 });
  });

  it("ramo principal arrastado pro outro lado faz os filhos crescerem pra lá", () => {
    const { caixas } = calcularLayout(simples.map((n) => (n.id === "a" ? { ...n, pos_x: -500, pos_y: 0 } : n)));
    expect(caixas.get("a")!.lado).toBe(-1);
    expect(caixas.get("a1")!.x).toBeLessThan(caixas.get("a")!.x);
  });

  it("500 ramos com textos de tamanhos diferentes: nenhum se sobrepõe, e é rápido", () => {
    const nos = arvoreGrande(500);
    const inicio = performance.now();
    const { caixas, arestas } = calcularLayout(nos);
    const ms = performance.now() - inicio;
    expect(caixas.size).toBe(500);
    expect(arestas).toHaveLength(499);
    const lista = [...caixas.values()];
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        if (sobrepoem(lista[i], lista[j])) throw new Error(`${lista[i].id} sobrepõe ${lista[j].id}`);
      }
    }
    expect(ms).toBeLessThan(200);
  });

  it("depois de criar ou excluir um ramo, o layout continua sem sobreposição", () => {
    const base = arvoreGrande(60);
    const comNovo = [...base, no("novo", "n3", 99, "um ramo novo com um texto mais comprido que os outros")];
    const semUm = base.filter((n) => n.id !== "n5" && n.pai_id !== "n5");
    for (const nos of [comNovo, semUm]) {
      const lista = [...calcularLayout(nos).caixas.values()];
      for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) expect(sobrepoem(lista[i], lista[j])).toBe(false);
    }
  });

  it("mapa antigo (sem posições salvas) e mapa só com a ideia central abrem", () => {
    expect(calcularLayout([no("r", null, 0, "Só a ideia")]).caixas.size).toBe(1);
    expect(calcularLayout([]).caixas.size).toBe(0);
  });

  it("tamanho do ramo cresce com o texto, com largura máxima e mais linhas", () => {
    const curto = tamanhoDoRamo("Oi", 2);
    const longo = tamanhoDoRamo("texto ".repeat(40), 2);
    expect(longo.w).toBeGreaterThan(curto.w);
    expect(longo.w).toBe(220);
    expect(longo.h).toBeGreaterThan(curto.h);
  });

  it("conexão sai da borda do pai e chega na borda do filho", () => {
    const d = caminhoDaAresta({ x: 0, y: 0, w: 100 }, { x: 200, y: 50, w: 60 });
    // Borda direita do pai (50) → borda esquerda do filho (170); tangentes no meio (110).
    expect(d).toBe("M 50 0 C 110 0, 110 50, 170 50");
    const esquerda = caminhoDaAresta({ x: 0, y: 0, w: 100 }, { x: -200, y: 0, w: 60 });
    expect(esquerda.startsWith("M -50 0")).toBe(true);
    // Ramo sublinhado (nível 2+): a curva encosta na linha de baixo.
    const sub = caminhoDaAresta({ x: 0, y: 0, w: 100, h: 40, nivel: 1 }, { x: 200, y: 50, w: 60, h: 20, nivel: 2 });
    expect(sub.endsWith("170 60")).toBe(true);
    // Estilo "caixas": todo ramo tem borda, a curva encosta no meio.
    const caixa = caminhoDaAresta({ x: 0, y: 0, w: 100, h: 40, nivel: 1 }, { x: 200, y: 50, w: 60, h: 20, nivel: 2 }, "caixas");
    expect(caixa.endsWith("170 50")).toBe(true);
  });

  it("câmera: enquadrar centraliza sem passar de 100%; zoom mantém o ponto do cursor", () => {
    const cam = enquadrar({ minX: -100, minY: -50, maxX: 100, maxY: 50 }, 1000, 600);
    expect(cam).toEqual({ escala: 1, x: 500, y: 300 });
    const grande = enquadrar({ minX: -2000, minY: -1000, maxX: 2000, maxY: 1000 }, 1000, 600);
    expect(grande.escala).toBeLessThan(1);

    const z = zoomEm({ x: 100, y: 100, escala: 1 }, 2, 300, 200);
    // O ponto do mapa sob o cursor continua sob o cursor.
    expect((300 - z.x) / z.escala).toBeCloseTo((300 - 100) / 1);
    expect((200 - z.y) / z.escala).toBeCloseTo((200 - 100) / 1);
    expect(zoomEm({ x: 0, y: 0, escala: 1.9 }, 10, 0, 0).escala).toBe(ESCALA_MAX);
    // Celular com mapa grande: abre na ideia central, legível (não em 20%).
    expect(cameraInicial({ minX: -2000, minY: -1000, maxX: 2000, maxY: 1000 }, 375, 600)).toEqual({ escala: 0.6, x: 187.5, y: 300 });
    expect(cameraInicial({ minX: -100, minY: -50, maxX: 100, maxY: 50 }, 1000, 600)).toEqual(cam);
  });
});
