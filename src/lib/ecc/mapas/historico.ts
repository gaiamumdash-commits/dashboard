import type { NoMapa } from "@/lib/ecc/mapas/tipos";

// Desfazer/refazer da visão de mapa — puro, testado em
// `__tests__/mapas-historico.test.ts`. Cada entrada descreve a operação
// com os dados de antes e de depois; quem desfaz/refaz chama as mesmas
// Server Actions de sempre (nada é gravado por fora da RLS). O histórico
// vive só na aba aberta (não sobrevive a recarregar a página).

export type Posicao = { x: number; y: number } | null;

export type Operacao =
  | { tipo: "texto"; id: string; antes: string; depois: string }
  | { tipo: "posicao"; id: string; antes: Posicao; depois: Posicao }
  | { tipo: "recolher"; id: string; antes: boolean; depois: boolean }
  | { tipo: "criar"; no: NoMapa }
  /** `nos` = o ramo e tudo dentro dele, pai antes dos filhos. */
  | { tipo: "excluir"; nos: NoMapa[] }
  | { tipo: "reorganizar"; antes: { id: string; x: number; y: number }[] };

export type Historico = { passado: Operacao[]; futuro: Operacao[] };

export const LIMITE_HISTORICO = 50;

export const historicoVazio = (): Historico => ({ passado: [], futuro: [] });

/** Operação nova: entra no passado e apaga o que dava pra refazer. */
export function registrar(h: Historico, op: Operacao): Historico {
  return { passado: [...h.passado, op].slice(-LIMITE_HISTORICO), futuro: [] };
}

/** Tira a última operação pra desfazer (ou null se não há). */
export function desfazer(h: Historico): { op: Operacao; historico: Historico } | null {
  const op = h.passado.at(-1);
  if (!op) return null;
  return { op, historico: { passado: h.passado.slice(0, -1), futuro: [op, ...h.futuro] } };
}

export function refazer(h: Historico): { op: Operacao; historico: Historico } | null {
  const op = h.futuro[0];
  if (!op) return null;
  return { op, historico: { passado: [...h.passado, op], futuro: h.futuro.slice(1) } };
}

/** Desfazer falhou no servidor: devolve a operação pro lugar (nada some). */
export function devolverAoPassado(h: Historico, op: Operacao): Historico {
  return { passado: [...h.passado, op], futuro: h.futuro.filter((o) => o !== op) };
}

export function devolverAoFuturo(h: Historico, op: Operacao): Historico {
  return { passado: h.passado.filter((o) => o !== op), futuro: [op, ...h.futuro] };
}
