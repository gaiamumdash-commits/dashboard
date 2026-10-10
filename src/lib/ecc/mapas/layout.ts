import { filhosPorPai } from "@/lib/ecc/mapas/arvore";
import type { NoMapa } from "@/lib/ecc/mapas/tipos";

// Layout da visão de mapa — puro (sem DOM, sem React), testado em
// `__tests__/mapas-layout.test.ts`.
//
// Modelo: a ideia central fica em (0,0); os ramos principais se dividem
// entre direita e esquerda (pelo "peso" de cada um, sem embaralhar a
// ordem) e cada lado cresce como árvore horizontal: cada ramo ocupa uma
// faixa vertical própria, então nada se sobrepõe no layout automático.
//
// Posição manual (`pos_x`/`pos_y`, migration 0060) é RELATIVA ao pai: o
// ramo arrastado leva junto o que está dentro dele. Posição é só desenho —
// este arquivo nunca mexe em `pai_id`/`ordem`.

export type NoParaLayout = Pick<NoMapa, "id" | "pai_id" | "ordem" | "texto" | "recolhido"> & {
  pos_x?: number | null;
  pos_y?: number | null;
  /** Altura a mais (px) pra selos embaixo do texto (data, tarefa ligada). */
  extra?: number;
};

export type Caixa = {
  id: string;
  /** Centro do ramo, em coordenadas do mapa. */
  x: number;
  y: number;
  w: number;
  h: number;
  nivel: number;
  /** 1 = cresce pra direita, -1 = pra esquerda, 0 = ideia central. */
  lado: 1 | -1 | 0;
  /** Índice do ramo principal (a cor do ramo inteiro); -1 na ideia central. */
  cor: number;
  /** Posição relativa ao pai em uso (manual ou automática). */
  rx: number;
  ry: number;
  manual: boolean;
};

export type Aresta = { de: string; para: string; cor: number };

export type Limites = { minX: number; minY: number; maxX: number; maxY: number };

export type ResultadoLayout = { caixas: Map<string, Caixa>; arestas: Aresta[]; limites: Limites };

export const ESPACO_X = 56;
export const ESPACO_Y = 14;

/** Medidas por nível — o componente usa as MESMAS (fonte, padding,
 * largura máxima), então a estimativa bate com o que aparece na tela. */
export const ESTILO_NIVEL = [
  { fonte: 17, larguraLetra: 10.4, linha: 24, padX: 20, padY: 14, min: 120, max: 280 },
  { fonte: 15, larguraLetra: 9.2, linha: 21, padX: 14, padY: 9, min: 64, max: 240 },
  { fonte: 14, larguraLetra: 8.2, linha: 19, padX: 12, padY: 7, min: 48, max: 220 },
] as const;

export function estiloDoNivel(nivel: number) {
  return ESTILO_NIVEL[Math.min(nivel, ESTILO_NIVEL.length - 1)];
}

/** Tamanho estimado do ramo pelo texto (quebra em linhas na largura máx.). */
export function tamanhoDoRamo(texto: string, nivel: number): { w: number; h: number } {
  const e = estiloDoNivel(nivel);
  // +12: folga pra fonte proporcional (letras largas) não quebrar a palavra.
  const larguraTexto = Math.ceil(Math.max(texto.length, 1) * e.larguraLetra) + 12;
  const util = e.max - 2 * e.padX;
  const linhas = Math.max(1, Math.ceil(larguraTexto / util));
  const w = Math.min(e.max, Math.max(e.min, larguraTexto + 2 * e.padX));
  return { w, h: linhas * e.linha + 2 * e.padY };
}

/** Divide os ramos principais entre direita e esquerda pelo peso (altura
 * da faixa), mantendo a ordem: os primeiros à direita, o resto à esquerda. */
export function dividirLados(pesos: number[]): (1 | -1)[] {
  const total = pesos.reduce((a, b) => a + b, 0);
  const lados: (1 | -1)[] = [];
  let acumulado = 0;
  for (const peso of pesos) {
    // Vai pra direita enquanto o centro do ramo ainda cai na 1ª metade.
    const direita = lados.length === 0 || acumulado + peso / 2 <= total / 2;
    lados.push(direita && !lados.includes(-1) ? 1 : -1);
    acumulado += peso;
  }
  return lados;
}

export function calcularLayout(nos: NoParaLayout[]): ResultadoLayout {
  const filhos = filhosPorPai(nos);
  const raiz = nos.find((n) => n.pai_id === null);
  const caixas = new Map<string, Caixa>();
  const arestas: Aresta[] = [];
  if (!raiz) return { caixas, arestas, limites: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };

  const tamanhos = new Map<string, { w: number; h: number }>();
  const nivelDe = new Map<string, number>([[raiz.id, 0]]);
  // Ordem de visita (pai antes dos filhos) — iterativa, sem recursão funda.
  const visitados: NoParaLayout[] = [];
  const pilha: NoParaLayout[] = [raiz];
  while (pilha.length > 0) {
    const no = pilha.pop()!;
    visitados.push(no);
    const nivel = nivelDe.get(no.id)!;
    const t = tamanhoDoRamo(no.texto, nivel);
    tamanhos.set(no.id, { w: t.w, h: t.h + (no.extra ?? 0) });
    if (no.recolhido && no.pai_id !== null) continue;
    for (const f of filhos.get(no.id) ?? []) {
      nivelDe.set(f.id, nivel + 1);
      pilha.push(f);
    }
  }
  const visiveis = new Set(visitados.map((n) => n.id));
  const recolhidos = new Set(nos.filter((n) => n.recolhido && n.pai_id !== null).map((n) => n.id));
  const filhosVisiveis = (id: string) => (visiveis.has(id) && !recolhidos.has(id) ? (filhos.get(id) ?? []) : []);
  const ehManual = (n: NoParaLayout) => typeof n.pos_x === "number" && typeof n.pos_y === "number";

  // Altura da faixa de cada ramo (de baixo pra cima). Filho com posição
  // manual não ocupa faixa: ele está onde a pessoa colocou.
  const faixa = new Map<string, number>();
  for (const no of [...visitados].reverse()) {
    const automaticos = filhosVisiveis(no.id).filter((f) => !ehManual(f));
    const soma = automaticos.reduce((t, f) => t + faixa.get(f.id)!, 0) + ESPACO_Y * Math.max(0, automaticos.length - 1);
    faixa.set(no.id, Math.max(tamanhos.get(no.id)!.h, soma));
  }

  /** Posições relativas dos filhos automáticos de um lado, empilhados. */
  function empilhar(pai: NoParaLayout, lista: NoParaLayout[], lado: 1 | -1): Map<string, { rx: number; ry: number }> {
    const r = new Map<string, { rx: number; ry: number }>();
    const total = lista.reduce((t, f) => t + faixa.get(f.id)!, 0) + ESPACO_Y * Math.max(0, lista.length - 1);
    let y = -total / 2;
    const wPai = tamanhos.get(pai.id)!.w;
    for (const f of lista) {
      const banda = faixa.get(f.id)!;
      r.set(f.id, { rx: lado * (wPai / 2 + ESPACO_X + tamanhos.get(f.id)!.w / 2), ry: y + banda / 2 });
      y += banda + ESPACO_Y;
    }
    return r;
  }

  const tRaiz = tamanhos.get(raiz.id)!;
  caixas.set(raiz.id, { id: raiz.id, x: 0, y: 0, ...tRaiz, nivel: 0, lado: 0, cor: -1, rx: 0, ry: 0, manual: false });

  // Ramos principais: lado de cada um (manual = lado pra onde foi arrastado).
  const principais = filhosVisiveis(raiz.id);
  const automaticos = principais.filter((f) => !ehManual(f));
  const ladosAuto = dividirLados(automaticos.map((f) => faixa.get(f.id)!));
  const ladoDe = new Map<string, 1 | -1>();
  automaticos.forEach((f, i) => ladoDe.set(f.id, ladosAuto[i]));
  principais.filter(ehManual).forEach((f) => ladoDe.set(f.id, f.pos_x! < 0 ? -1 : 1));
  const corDe = new Map(principais.map((f, i) => [f.id, i]));

  const relRaiz = new Map<string, { rx: number; ry: number }>([
    ...empilhar(raiz, automaticos.filter((f) => ladoDe.get(f.id) === 1), 1),
    ...empilhar(raiz, automaticos.filter((f) => ladoDe.get(f.id) === -1), -1),
  ]);

  // Pai antes dos filhos: `visitados` já está nessa ordem.
  const relativas = new Map<string, { rx: number; ry: number }>(relRaiz);
  for (const no of visitados) {
    if (no.id === raiz.id) continue;
    const pai = caixas.get(no.pai_id!)!;
    const lado: 1 | -1 = pai.lado === 0 ? ladoDe.get(no.id)! : pai.lado;
    const manual = ehManual(no);
    const rel = manual ? { rx: no.pos_x!, ry: no.pos_y! } : (relativas.get(no.id) ?? { rx: 0, ry: 0 });
    const t = tamanhos.get(no.id)!;
    const caixa: Caixa = {
      id: no.id,
      x: pai.x + rel.rx,
      y: pai.y + rel.ry,
      ...t,
      nivel: pai.nivel + 1,
      lado,
      cor: pai.lado === 0 ? corDe.get(no.id)! : pai.cor,
      rx: rel.rx,
      ry: rel.ry,
      manual,
    };
    caixas.set(no.id, caixa);
    arestas.push({ de: pai.id, para: no.id, cor: caixa.cor });
    const meus = filhosVisiveis(no.id).filter((f) => !ehManual(f));
    for (const [id, r] of empilhar(no, meus, lado)) relativas.set(id, r);
  }

  const limites: Limites = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const c of caixas.values()) {
    limites.minX = Math.min(limites.minX, c.x - c.w / 2);
    limites.maxX = Math.max(limites.maxX, c.x + c.w / 2);
    limites.minY = Math.min(limites.minY, c.y - c.h / 2);
    limites.maxY = Math.max(limites.maxY, c.y + c.h / 2);
  }
  return { caixas, arestas, limites };
}

/** Estilo "linhas" (orgânico): do nível 2 em diante o ramo é texto sobre
 * uma linha. No estilo "caixas", todo ramo tem borda. */
export const NIVEL_SUBLINHADO = 2;

export type EstiloMapa = "caixas" | "linhas";

export function ehSublinhado(nivel: number, estilo: EstiloMapa): boolean {
  return estilo === "linhas" && nivel >= NIVEL_SUBLINHADO;
}

/** Altura onde a conexão encosta: meio da caixa, ou a linha de baixo do
 * ramo sublinhado (a curva continua a linha). */
function alturaDaAncora(c: Pick<Caixa, "y" | "h"> & { nivel?: number; sublinhado?: boolean }, estilo: EstiloMapa): number {
  return (c.sublinhado ?? ehSublinhado(c.nivel ?? 0, estilo)) ? c.y + c.h / 2 : c.y;
}

/** Curva da conexão: sai da borda do pai voltada pro filho e chega na
 * borda do filho voltada pro pai (Bézier com tangentes horizontais). */
export function caminhoDaAresta(
  pai: Pick<Caixa, "x" | "y" | "w"> & { h?: number; nivel?: number; sublinhado?: boolean },
  filho: Pick<Caixa, "x" | "y" | "w"> & { h?: number; nivel?: number; sublinhado?: boolean },
  estilo: EstiloMapa = "linhas",
): string {
  const dir = filho.x >= pai.x ? 1 : -1;
  const sx = pai.x + (dir * pai.w) / 2;
  const ex = filho.x - (dir * filho.w) / 2;
  const sy = alturaDaAncora({ ...pai, h: pai.h ?? 0 }, estilo);
  const ey = alturaDaAncora({ ...filho, h: filho.h ?? 0 }, estilo);
  const meio = (ex - sx) / 2;
  const r = (n: number) => Math.round(n * 10) / 10;
  return `M ${r(sx)} ${r(sy)} C ${r(sx + meio)} ${r(sy)}, ${r(ex - meio)} ${r(ey)}, ${r(ex)} ${r(ey)}`;
}

// ---------------------------------------------------------------------------
// Câmera (zoom/arrasto da tela)
// ---------------------------------------------------------------------------

export type Camera = { x: number; y: number; escala: number };

export const ESCALA_MIN = 0.2;
export const ESCALA_MAX = 2;

const limitarEscala = (e: number) => Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, e));

/** Câmera que mostra o mapa inteiro na área (com margem), sem passar de 100%. */
export function enquadrar(limites: Limites, largura: number, altura: number, margem = 40): Camera {
  const w = Math.max(1, limites.maxX - limites.minX);
  const h = Math.max(1, limites.maxY - limites.minY);
  const escala = limitarEscala(Math.min(1, (largura - 2 * margem) / w, (altura - 2 * margem) / h));
  const cx = (limites.minX + limites.maxX) / 2;
  const cy = (limites.minY + limites.maxY) / 2;
  return { escala, x: largura / 2 - cx * escala, y: altura / 2 - cy * escala };
}

/** Câmera inicial: o mapa inteiro, se ficar legível; senão (mapa grande
 * ou tela de celular), a ideia central no meio em tamanho legível — o ⤢
 * mostra o mapa inteiro quando a pessoa quiser. */
export function cameraInicial(limites: Limites, largura: number, altura: number, legivel = 0.6): Camera {
  const tudo = enquadrar(limites, largura, altura);
  if (tudo.escala >= legivel) return tudo;
  const escala = Math.max(legivel, ESCALA_MIN);
  return { escala, x: largura / 2, y: altura / 2 };
}

/** Zoom mantendo fixo o ponto da tela (px, py) — cursor ou centro da pinça. */
export function zoomEm(camera: Camera, fator: number, px: number, py: number): Camera {
  const escala = limitarEscala(camera.escala * fator);
  const k = escala / camera.escala;
  return { escala, x: px - (px - camera.x) * k, y: py - (py - camera.y) * k };
}
