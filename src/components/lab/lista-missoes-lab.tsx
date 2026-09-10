import type { ColunaKanban, Tarefa } from "@/lib/ecc/tipos";
import type { MissaoQuadroCafeMangue } from "@/lib/ecc/lab/conteudo-cafe-mangue";
import { missoesConcluidas } from "@/lib/ecc/lab/missoes";

/** Checklist sempre visível do quadro do Lab — reaproveita o mesmo idioma
 * visual do checklist real (detalhe-tarefa.tsx) e dos "Marcos" da Visão 360°
 * do Lab (line-through + texto apagado quando concluído). Puramente
 * apresentacional: recebe o estado já resolvido de fora (QuadroLab), nunca
 * lê nem grava nada sozinho. */
export function ListaMissoesLab({
  missoes,
  tarefas,
  colunas,
}: {
  missoes: MissaoQuadroCafeMangue[];
  tarefas: Tarefa[];
  colunas: ColunaKanban[];
}) {
  const concluidas = missoesConcluidas(missoes, tarefas, colunas);

  return (
    <div className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4 lg:w-72">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">Missões</h2>
      <ul className="flex flex-col gap-2.5">
        {missoes.map((missao) => {
          const feita = concluidas.has(missao.id);
          const bloqueada = !feita && missao.criterio.tipo === "dependente";
          return (
            <li key={missao.id} className="flex items-start gap-2 text-sm">
              <span className={feita ? "text-gaiamum-success" : "text-gaiamum-text-muted"}>
                {feita ? "✓" : bloqueada ? "🔒" : "○"}
              </span>
              <span
                className={
                  feita || bloqueada
                    ? "text-gaiamum-text-muted" + (feita ? " line-through" : "")
                    : "text-gaiamum-text"
                }
              >
                {missao.texto}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
