import Link from "next/link";
import { BarraProgresso } from "@/components/ui/barra-progresso";
import type { MetaSmart, Tarefa } from "@/lib/ecc/tipos";

const ROTULO_HORIZONTE: Record<MetaSmart["horizonte"], string> = {
  medio_prazo: "Médio prazo",
  longo_prazo: "Longo prazo",
};

/** Card "Meta principal" — reaproveita `BarraProgresso` (já existe, com o
 * caranguejo animado) em vez de uma barra nova. `progresso`/`marco` vêm
 * agregados de todos os projetos vinculados a essa meta (ver
 * `progressoDeTarefas`/`proximoMarco` em `painel-geral.ts`). */
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
      <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">{ROTULO_HORIZONTE[meta.horizonte]}</p>
      <p className="mt-1 text-sm text-gaiamum-text">{meta.visao_macro}</p>

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
    </div>
  );
}
