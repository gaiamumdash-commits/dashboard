import Link from "next/link";
import { CLASSE_FUNDO_QUADRO } from "@/lib/ecc/kanban";
import type { SaudeProjeto } from "@/lib/ecc/painel-geral";
import type { Projeto } from "@/lib/ecc/tipos";

const ROTULO_SAUDE: Record<SaudeProjeto, string> = {
  no_caminho: "No caminho",
  atencao: "Atenção",
};

const CLASSE_SAUDE: Record<SaudeProjeto, string> = {
  no_caminho: "border-gaiamum-success/40 bg-gaiamum-success/10 text-gaiamum-success",
  atencao: "border-gaiamum-danger/40 bg-gaiamum-danger/10 text-gaiamum-danger",
};

export type ProjetoEmFoco = {
  projeto: Projeto;
  saude: SaudeProjeto;
  tarefasAbertas: number;
};

/** Card por projeto do "Projetos em foco" — saúde é calculada
 * (`calcularSaudeProjeto`), não o `Projeto.status` (ciclo de vida
 * ativo/pausado/concluído, outra coisa, controlado em `cartao-projeto.tsx`). */
export function ProjetosEmFoco({ projetos }: { projetos: ProjetoEmFoco[] }) {
  if (projetos.length === 0) {
    return <p className="text-sm text-gaiamum-text-muted">Nenhum projeto ativo ainda.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projetos.map(({ projeto, saude, tarefasAbertas }) => (
        <Link
          key={projeto.id}
          href={`/projetos/${projeto.id}/tarefas`}
          className="flex flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 transition hover:border-gaiamum-primary"
        >
          <div className={`-mx-5 -mt-5 h-1.5 rounded-t-2xl ${CLASSE_FUNDO_QUADRO[projeto.cor_fundo]}`} />
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-gaiamum-text">{projeto.nome}</p>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${CLASSE_SAUDE[saude]}`}>
              {ROTULO_SAUDE[saude]}
            </span>
          </div>
          <p className="text-sm text-gaiamum-text-muted">
            {tarefasAbertas === 0
              ? "Sem tarefas abertas"
              : tarefasAbertas === 1
                ? "1 tarefa aberta"
                : `${tarefasAbertas} tarefas abertas`}
          </p>
        </Link>
      ))}
    </div>
  );
}
