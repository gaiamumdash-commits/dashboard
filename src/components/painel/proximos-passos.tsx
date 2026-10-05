import Link from "next/link";
import { prazoRelativo } from "@/lib/ecc/painel-geral";
import type { Tarefa } from "@/lib/ecc/tipos";

export type PassoUnificado = {
  tarefa: Pick<Tarefa, "id" | "titulo" | "data_limite" | "projeto_id">;
  nomeProjeto: string;
  atrasada: boolean;
};

/** Checklist unificado entre projetos — substitui as 2 seções antigas
 * ("Atrasadas" / "Vencendo em 48h") por uma lista só, ordenada por prazo, com
 * `prazoRelativo` (Hoje/Amanhã/Sex) em vez da data crua. Navegação, não
 * interativo — mesmo padrão da home anterior (clica, vai pro quadro). */
export function ProximosPassos({ passos }: { passos: PassoUnificado[] }) {
  if (passos.length === 0) {
    return <p className="text-sm text-gaiamum-text-muted">Nenhuma tarefa com prazo nos próximos dias.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {passos.map(({ tarefa, nomeProjeto, atrasada }) => (
        <Link
          key={tarefa.id}
          href={`/projetos/${tarefa.projeto_id}/tarefas`}
          className={`flex items-center justify-between gap-3 rounded-lg border bg-gaiamum-surface px-4 py-2.5 text-sm transition ${
            atrasada
              ? "border-gaiamum-danger/40 hover:border-gaiamum-danger"
              : "border-gaiamum-border hover:border-gaiamum-primary"
          }`}
        >
          <span className="text-gaiamum-text">{tarefa.titulo}</span>
          <span className="flex shrink-0 items-center gap-2 text-xs">
            <span className="text-gaiamum-text-muted">{nomeProjeto}</span>
            <span className={atrasada ? "font-semibold text-gaiamum-danger" : "text-gaiamum-text-muted"}>
              {prazoRelativo(tarefa.data_limite as string)}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
