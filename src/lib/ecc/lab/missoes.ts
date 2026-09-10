import type { ColunaKanban, Tarefa } from "@/lib/ecc/tipos";
import type { MissaoQuadroCafeMangue } from "@/lib/ecc/lab/conteudo-cafe-mangue";

/** Deriva quais missões estão concluídas a partir do estado ATUAL das
 * tarefas — nunca persistido, sempre recalculado. Resolve em ordem de
 * declaração do array (suficiente pro escopo atual: 2 itens, 1 dependência). */
export function missoesConcluidas(
  missoes: MissaoQuadroCafeMangue[],
  tarefas: Tarefa[],
  colunas: ColunaKanban[],
): Set<string> {
  const nomeDaColuna = new Map(colunas.map((c) => [c.id, c.nome]));
  const concluidas = new Set<string>();

  for (const missao of missoes) {
    const { criterio } = missao;
    if (criterio.tipo === "mover_tarefa") {
      const tarefa = tarefas.find((t) => t.titulo === criterio.tarefaTitulo);
      const colunaAtual = tarefa ? nomeDaColuna.get(tarefa.coluna_id) : undefined;
      if (colunaAtual && colunaAtual !== criterio.colunaDiferenteDe) concluidas.add(missao.id);
    } else if (concluidas.has(criterio.dependeDeMissaoId)) {
      concluidas.add(missao.id);
    }
  }
  return concluidas;
}
