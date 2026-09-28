import Link from "next/link";
import { listarCompromissosDoDia } from "@/lib/ecc/agenda";

/** Coluna fixa à esquerda do quadro Kanban com os compromissos de hoje de
 * quem está logado — pra planejar os cartões sabendo quanto do dia já está
 * ocupado. Server Component, montado dentro de `<Suspense>` na página: a
 * chamada ao Google não segura o resto do quadro. Sem Google conectado não
 * renderiza nada. */
export async function ColunaCompromissosDoDia({ tenantId }: { tenantId: string }) {
  const resultado = await listarCompromissosDoDia(tenantId);
  if (resultado.status === "oculto") return null;

  const hoje = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex min-h-[10rem] w-[85vw] shrink-0 flex-col gap-2.5 rounded-xl border border-gaiamum-primary/40 bg-gaiamum-surface p-3 sm:min-h-[16rem] sm:w-64">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
          📅 Compromissos de hoje
          {resultado.status === "conectado" && (
            <span className="text-gaiamum-text"> ({resultado.compromissos.length})</span>
          )}
        </h2>
        <p className="mt-0.5 text-xs capitalize text-gaiamum-text-muted">{hoje}</p>
      </div>

      {resultado.status === "problema" ? (
        <p className="text-sm text-gaiamum-danger">
          Não consegui ler seu Google Calendar.{" "}
          <Link href="/agenda" className="underline">
            Reconecte na Agenda
          </Link>{" "}
          pra ver os compromissos aqui.
        </p>
      ) : resultado.compromissos.length === 0 ? (
        <p className="text-sm text-gaiamum-text-muted">Nada marcado pra hoje. Dia livre pros cartões.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {resultado.compromissos.map((c) => (
            <li key={c.id} className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2">
              <p className="text-xs font-semibold text-gaiamum-primary">{c.horario}</p>
              <p className="text-sm text-gaiamum-text">{c.titulo}</p>
            </li>
          ))}
        </ul>
      )}

      <Link href="/agenda?visao=dia" className="mt-auto text-xs text-gaiamum-text-muted underline hover:text-gaiamum-text">
        Abrir a Agenda
      </Link>
    </div>
  );
}
