import Link from "next/link";
import { BarraProgresso } from "@/components/ui/barra-progresso";
import { IconeCircular } from "@/components/painel/icone-circular";
import type { MetaSmart, Tarefa } from "@/lib/ecc/tipos";

/** Card "Meta principal" — reaproveita `BarraProgresso` (já existe, com o
 * caranguejo animado) em vez de uma barra nova. `progresso`/`marco` vêm
 * agregados de todos os projetos vinculados a essa meta (ver
 * `progressoDeTarefas`/`proximoMarco` em `painel-geral.ts`). O prazo exibido
 * é o próprio `time_bound` da meta SMART (texto livre que a pessoa escreveu
 * no onboarding, ex.: "Out/2029") — não um campo de data estruturado. */
export function MetaPrincipal({
  meta,
  progresso,
  marco,
}: {
  meta: MetaSmart | null;
  progresso: number | null;
  marco: Pick<Tarefa, "titulo" | "data_limite"> | null;
}) {
  if (!meta) {
    return (
      <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
        <p className="text-sm text-gaiamum-text-muted">
          Você ainda não definiu suas metas SMART.{" "}
          <Link href="/onboarding" className="text-gaiamum-primary hover:underline">
            Criar agora
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconeCircular cor="roxo">🎯</IconeCircular>
          <p className="text-sm font-semibold text-gaiamum-text">{meta.visao_macro}</p>
        </div>
        <p className="shrink-0 text-xs text-gaiamum-text-muted">Prazo: {meta.time_bound}</p>
      </div>

      <div className="mt-4">
        <BarraProgresso percentual={progresso ?? 0} rotulo="Progresso dos projetos vinculados" />
      </div>

      <p className="mt-3 text-xs text-gaiamum-text-muted">
        {marco ? (
          <>
            Próximo marco: <span className="text-gaiamum-text">{marco.titulo}</span>
            {marco.data_limite && ` — ${new Date(marco.data_limite).toLocaleDateString("pt-BR")}`}
          </>
        ) : (
          "Nenhum marco definido ainda."
        )}
      </p>

      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-gaiamum-text-muted">
        <span aria-hidden>ℹ</span>
        Progresso calculado a partir das tarefas dos projetos vinculados a esta meta.
      </p>
    </div>
  );
}
