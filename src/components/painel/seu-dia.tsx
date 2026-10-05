import Link from "next/link";
import type { ResultadoCompromissosDoDia } from "@/lib/ecc/agenda";
import type { Tarefa } from "@/lib/ecc/tipos";

function CardSeuDia({
  icone,
  rotulo,
  numero,
  detalhe,
  href,
}: {
  icone: string;
  rotulo: string;
  numero: string;
  detalhe?: string;
  href?: string;
}) {
  const conteudo = (
    <div className="flex h-full flex-col gap-1 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gaiamum-text-muted">
        <span aria-hidden>{icone}</span>
        {rotulo}
      </div>
      <p className="mt-1 text-3xl font-semibold text-gaiamum-text">{numero}</p>
      {detalhe && <p className="text-sm text-gaiamum-text-muted">{detalhe}</p>}
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
      <CardSeuDia icone="✅" rotulo="Tarefas para hoje" numero={String(tarefasHoje)} href="/projetos" />
      <CardSeuDia
        icone="📅"
        rotulo="Compromissos agendados"
        numero={compromissos.status === "conectado" ? String(compromissos.compromissos.length) : "—"}
        detalhe={detalheCompromissos}
        href={compromissos.status === "oculto" ? "/agenda" : undefined}
      />
      <CardSeuDia
        icone="🚩"
        rotulo="Prazo importante da semana"
        numero={String(prazoSemana.quantidade)}
        detalhe={prazoSemana.maisProximo?.titulo}
      />
    </div>
  );
}
