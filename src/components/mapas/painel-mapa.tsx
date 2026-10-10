"use client";

import Link from "next/link";
import { enviarResumoMapa } from "@/lib/ecc/mapas/actions";
import { detectarData, rotuloData } from "@/lib/ecc/mapas/datas";
import { palavrasChave, tagsDoMapa } from "@/lib/ecc/mapas/palavras";
import type { NoMapa } from "@/lib/ecc/mapas/tipos";
import { useAcaoPlanner } from "@/components/planner/uso-acao";
import { CLASSE_BOTAO_SECUNDARIO } from "@/components/planner/estilos";
import { EVENTO_SELECIONAR_RAMO } from "@/components/mapas/editor-mapa";

/**
 * Painel abaixo do mapa: 📅 datas citadas (em ordem), 🔑 palavras-chave e
 * #tags (filtro no mapa por `?palavra=`), e 📬 o resumo por e-mail — só pra
 * quem está vendo (o endereço vem da sessão no servidor).
 */
export function PainelMapa({
  mapaId,
  nos,
  hoje,
  palavraAtiva,
  email,
  modo,
}: {
  mapaId: string;
  nos: NoMapa[];
  hoje: string;
  palavraAtiva: string | null;
  email: string;
  modo: "mapa" | "lista";
}) {
  const { pendente, executar } = useAcaoPlanner();
  const ramos = nos.filter((n) => n.pai_id !== null);
  const datas = ramos
    .map((no) => ({ no, d: detectarData(no.texto, hoje) }))
    .filter((x): x is { no: NoMapa; d: NonNullable<ReturnType<typeof detectarData>> } => x.d !== null)
    .sort((a, b) => (a.d.data + (a.d.hora ?? "")).localeCompare(b.d.data + (b.d.hora ?? "")));
  const textos = nos.map((n) => n.texto);
  const chips = [...tagsDoMapa(textos), ...palavrasChave(textos)];
  const base = `/mapas/${mapaId}?modo=mapa`;
  const classeLinhaData = "flex w-full items-baseline gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-gaiamum-surface-raised";

  return (
    <section className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
      <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
        <h2 className="text-sm font-semibold text-gaiamum-text">📅 Datas do mapa</h2>
        {datas.length === 0 ? (
          <p className="mt-1 text-xs text-gaiamum-text-muted">Escreva datas nos ramos — “sexta 14h”, “15/11”, “dia 20 de novembro” — e elas aparecem aqui.</p>
        ) : (
          <ul className="mt-2 flex flex-col">
            {datas.slice(0, 12).map(({ no, d }) => (
              <li key={no.id}>
                {modo === "mapa" ? (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_SELECIONAR_RAMO, { detail: no.id }))}
                    className={`${classeLinhaData} ${d.data < hoje ? "text-gaiamum-text-muted" : "text-gaiamum-text"}`}
                  >
                    <span className="w-24 shrink-0 text-xs font-semibold tabular-nums text-gaiamum-primary">{rotuloData(d, hoje)}</span>
                    <span className="truncate">{no.texto}</span>
                  </button>
                ) : (
                  <Link href={`/mapas/${mapaId}?modo=lista&foco=${no.id}`} className={`${classeLinhaData} ${d.data < hoje ? "text-gaiamum-text-muted" : "text-gaiamum-text"}`}>
                    <span className="w-24 shrink-0 text-xs font-semibold tabular-nums text-gaiamum-primary">{rotuloData(d, hoje)}</span>
                    <span className="truncate">{no.texto}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
        <h2 className="text-sm font-semibold text-gaiamum-text">🔑 Palavras-chave</h2>
        {chips.length === 0 ? (
          <p className="mt-1 text-xs text-gaiamum-text-muted">As palavras que se repetem nos ramos (e as #tags) aparecem aqui. Toque numa pra destacar no mapa.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((p) => {
              const ativa = palavraAtiva === p.chave;
              return (
                <Link
                  key={p.chave}
                  href={ativa ? base : `${base}&palavra=${encodeURIComponent(p.chave)}`}
                  aria-pressed={ativa}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    ativa ? "border-gaiamum-primary bg-gaiamum-primary text-white" : "border-gaiamum-border text-gaiamum-text hover:border-gaiamum-primary"
                  }`}
                >
                  {p.palavra} <span className="opacity-70">· {p.total}</span>
                </Link>
              );
            })}
          </div>
        )}
        {palavraAtiva && (
          <Link href={base} className="mt-2 inline-block text-xs text-gaiamum-primary hover:underline">
            Limpar destaque
          </Link>
        )}
      </div>

      <div className="flex flex-col justify-between gap-2 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4 md:w-56">
        <div>
          <h2 className="text-sm font-semibold text-gaiamum-text">📬 Resumo por e-mail</h2>
          <p className="mt-1 break-words text-xs text-gaiamum-text-muted">O mapa em tópicos, com datas e palavras-chave, para {email || "o seu e-mail"}.</p>
        </div>
        <button
          type="button"
          disabled={pendente || !email}
          onClick={() => executar(() => enviarResumoMapa(mapaId), { sucesso: "Resumo enviado para o seu e-mail." })}
          className={CLASSE_BOTAO_SECUNDARIO}
        >
          {pendente ? "Enviando..." : "Enviar para mim"}
        </button>
      </div>
    </section>
  );
}
