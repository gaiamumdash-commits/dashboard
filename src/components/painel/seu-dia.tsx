import Link from "next/link";
import { IconeCircular, type CorIcone } from "@/components/painel/icone-circular";
import type { ResultadoCompromissosDoDia } from "@/lib/ecc/agenda";
import type { Tarefa } from "@/lib/ecc/tipos";

function CardSeuDia({
  cor,
  simbolo,
  numero,
  rotulo,
  detalhe,
  href,
}: {
  cor: CorIcone;
  simbolo: string;
  numero: string;
  rotulo: string;
  detalhe?: string;
  href?: string;
}) {
  const conteudo = (
    <div className="flex items-center gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
      <IconeCircular cor={cor}>{simbolo}</IconeCircular>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-semibold text-gaiamum-text">
          {numero} <span className="text-sm font-normal text-gaiamum-text-muted">{rotulo}</span>
        </p>
        {detalhe && <p className="truncate text-xs text-gaiamum-text-muted">{detalhe}</p>}
      </div>
      {href && <span aria-hidden className="shrink-0 text-gaiamum-text-muted">→</span>}
    </div>
  );

  if (!href) return conteudo;
  return (
    <Link href={href} className="block transition hover:opacity-90">
      {conteudo}
    </Link>
  );
}

/** "Seu dia" — 3 cards. Compromissos reaproveita `listarCompromissosDoDia`
 * (`src/lib/ecc/agenda.ts`), já usada na coluna "Compromissos do dia" do
 * Kanban — nenhuma lógica nova de agenda aqui. */
export function SeuDia({
  tarefasHoje,
  compromissos,
  prazoSemana,
}: {
  tarefasHoje: number;
  compromissos: ResultadoCompromissosDoDia;
  prazoSemana: { quantidade: number; maisProximo: Pick<Tarefa, "titulo"> | null };
}) {
  const detalheCompromissos =
    compromissos.status === "conectado"
      ? (compromissos.compromissos[0]?.titulo ?? undefined)
      : compromissos.status === "oculto"
        ? "Conectar agenda"
        : "Não foi possível carregar";

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <CardSeuDia cor="verde" simbolo="✓" numero={String(tarefasHoje)} rotulo="tarefas para hoje" href="/projetos" />
      <CardSeuDia
        cor="azul"
        simbolo="📅"
        numero={compromissos.status === "conectado" ? String(compromissos.compromissos.length) : "—"}
        rotulo="compromissos agendados"
        detalhe={detalheCompromissos}
        href={compromissos.status === "oculto" ? "/agenda" : "/agenda"}
      />
      <CardSeuDia
        cor="amarelo"
        simbolo="⏱"
        numero={String(prazoSemana.quantidade)}
        rotulo="prazo importante nesta semana"
        detalhe={prazoSemana.maisProximo?.titulo}
      />
    </div>
  );
}
