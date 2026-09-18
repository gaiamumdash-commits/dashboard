import type { ItemAgenda } from "@/lib/ecc/tipos";

export type ItemComHorario = { item: ItemAgenda; inicioMin: number; fimMin: number };
export type ItemPosicionado = ItemComHorario & { coluna: number; totalColunas: number };

/** Aloca cada item na primeira coluna cujo último item já terminou antes do
 * início deste — estratégia clássica e simples de layout de agenda pra
 * eventos sobrepostos. Largura uniforme por dia (não por cluster local):
 * suficiente pra V1, sem sofisticar. Compartilhada entre a grade semanal e
 * a grade de um único dia — mesma regra de sobreposição nas duas. */
export function distribuirColunas(itens: ItemComHorario[]): ItemPosicionado[] {
  const ordenados = [...itens].sort((a, b) => a.inicioMin - b.inicioMin);
  const ultimoFimPorColuna: number[] = [];

  const comColuna = ordenados.map((it) => {
    let coluna = ultimoFimPorColuna.findIndex((fim) => fim <= it.inicioMin);
    if (coluna === -1) {
      coluna = ultimoFimPorColuna.length;
      ultimoFimPorColuna.push(it.fimMin);
    } else {
      ultimoFimPorColuna[coluna] = it.fimMin;
    }
    return { ...it, coluna };
  });

  const totalColunas = Math.max(ultimoFimPorColuna.length, 1);
  return comColuna.map((it) => ({ ...it, totalColunas }));
}
