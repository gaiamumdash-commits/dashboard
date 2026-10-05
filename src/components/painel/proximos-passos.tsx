import Link from "next/link";
import { prazoRelativo } from "@/lib/ecc/painel-geral";
import type { Tarefa } from "@/lib/ecc/tipos";

export type PassoUnificado = {
  tarefa: Pick<Tarefa, "id" | "titulo" | "data_limite" | "projeto_id">;
  nomeProjeto: string;
  atrasada: boolean;
};

/** Checklist unificado entre projetos — substitui as 2 seções antigas
 * ("Atrasadas" / "Vencendo em 48h") por uma lista só, ordenada por prazo,
 * com `prazoRelativo` (Hoje/Amanhã/Sex) em vez da data crua. Navegação, não
 * interativo — mesmo padrão da home anterior (clica, vai pro quadro); o
 * checkbox é só visual, não marca a tarefa como concluída daqui. */
export function ProximosPassos({ passos }: { passos: PassoUnificado[] }) {
  if (passos.length === 0) {
    return <p className="text-sm text-gaiamum-text-muted">Nenhuma tarefa com prazo nos próximos dias.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-gaiamum-border rounded-2xl border border-gaiamum-border bg-gaiamum-surface">
      {passos.map(({ tarefa, nomeProjeto, atrasada }) => (
        <Link
          key={tarefa.id}
          href={`/projetos/${tarefa.projeto_id}/tarefas`}
          className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-gaiamum-surface-raised"
        >
          <span aria-hidden className="h-4 w-4 shrink-0 rounded border border-gaiamum-border-forte" />
          <span className="min-w-0 flex-1 truncate text-gaiamum-text">{tarefa.titulo}</span>
          <span className="shrink-0 text-xs text-gaiamum-text-muted">{nomeProjeto}</span>
          <span
            className={`shrink-0 flex items-center gap-1 text-xs ${atrasada ? "font-semibold text-gaiamum-danger" : "text-gaiamum-text-muted"}`}
          >
            📅 {prazoRelativo(tarefa.data_limite as string)}
          </span>
        </Link>
      ))}
    </div>
  );
}
