import Link from "next/link";
import { CLASSE_FUNDO_QUADRO, TEXTO_SOBRE_FUNDO_QUADRO } from "@/lib/ecc/kanban";
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
  tarefasAtrasadas: number;
  proximoPrazoTitulo: string | null;
};

/** Card por projeto do "Projetos em foco" — saúde é calculada
 * (`calcularSaudeProjeto`), não o `Projeto.status` (ciclo de vida
 * ativo/pausado/concluído, outra coisa, controlado em `cartao-projeto.tsx`).
 * A 2ª métrica é a tarefa atrasada (quando há) ou o próximo prazo — o que
 * for mais relevante pro projeto naquele momento. */
export function ProjetosEmFoco({ projetos }: { projetos: ProjetoEmFoco[] }) {
  if (projetos.length === 0) {
    return <p className="text-sm text-gaiamum-text-muted">Nenhum projeto ativo ainda.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {projetos.map(({ projeto, saude, tarefasAbertas, tarefasAtrasadas, proximoPrazoTitulo }) => (
        <Link
          key={projeto.id}
          href={`/projetos/${projeto.id}/tarefas`}
          className="flex flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 transition hover:border-gaiamum-primary"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm ${CLASSE_FUNDO_QUADRO[projeto.cor_fundo]} ${TEXTO_SOBRE_FUNDO_QUADRO[projeto.cor_fundo]}`}
              >
                📁
              </span>
              <p className="font-semibold text-gaiamum-text">{projeto.nome}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${CLASSE_SAUDE[saude]}`}>
              {ROTULO_SAUDE[saude]}
            </span>
          </div>

          {projeto.descricao && <p className="text-sm text-gaiamum-text-muted">{projeto.descricao}</p>}

          <div className="mt-auto flex items-center justify-between gap-2 text-xs text-gaiamum-text-muted">
            <span>
              📋 {tarefasAbertas === 0 ? "Sem tarefas abertas" : tarefasAbertas === 1 ? "1 tarefa aberta" : `${tarefasAbertas} tarefas abertas`}
            </span>
            {tarefasAtrasadas > 0 ? (
              <span className="text-gaiamum-danger">
                ⏱ {tarefasAtrasadas === 1 ? "1 tarefa atrasada" : `${tarefasAtrasadas} tarefas atrasadas`}
              </span>
            ) : proximoPrazoTitulo ? (
              <span className="truncate">⏱ {proximoPrazoTitulo}</span>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
