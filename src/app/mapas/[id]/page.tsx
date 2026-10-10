import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarMapa, contextoMapas } from "@/lib/ecc/mapas/dados";
import { EstruturaMapas } from "@/components/mapas/estrutura-mapas";
import { EditorLista } from "@/components/mapas/editor-lista";
import { EditorMapa } from "@/components/mapas/editor-mapa";

export const metadata: Metadata = { title: "Mapa mental · Gaiamum" };

/** Um mapa, em duas visões da MESMA árvore: `?modo=mapa` (padrão) ou
 * `?modo=lista`. `?foco=<id>` abre a lista focada num ramo. Mapa de outra
 * pessoa (compartilhado) abre só pra leitura. */
export default async function PaginaMapa({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ foco?: string; modo?: string }>;
}) {
  const [{ id }, { foco, modo: modoBruto }] = await Promise.all([params, searchParams]);
  const ctx = await contextoMapas();
  const dados = await carregarMapa(ctx.tenantId, id);
  if (!dados) notFound();
  const somenteLeitura = dados.mapa.user_id !== ctx.userId;
  const focoId = typeof foco === "string" ? foco : null;
  // Com foco na URL, é a lista (o foco é um recurso da lista).
  const modo = modoBruto === "lista" || (focoId && modoBruto !== "mapa") ? "lista" : "mapa";

  const aba = (valor: "mapa" | "lista", rotulo: string, icone: string) => (
    <Link
      href={`/mapas/${id}?modo=${valor}`}
      aria-current={modo === valor ? "page" : undefined}
      className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        modo === valor ? "bg-gaiamum-primary text-white" : "text-gaiamum-text-muted hover:text-gaiamum-text"
      }`}
    >
      <span aria-hidden>{icone}</span>
      {rotulo}
    </Link>
  );

  return (
    <EstruturaMapas ctx={ctx} titulo={dados.mapa.titulo}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-2xl font-semibold text-gaiamum-text">{dados.mapa.titulo}</h1>
        <nav aria-label="Visão do mapa" className="flex rounded-full border border-gaiamum-border bg-gaiamum-surface p-1">
          {aba("mapa", "Mapa", "🧠")}
          {aba("lista", "Lista", "☰")}
        </nav>
      </div>
      {somenteLeitura && (
        <p className="rounded-xl bg-gaiamum-surface-raised px-4 py-2 text-sm text-gaiamum-text-muted">
          Mapa compartilhado pela equipe — você pode ler, recolher e navegar, mas não editar.
        </p>
      )}
      {modo === "mapa" ? (
        <EditorMapa key={id} mapaId={id} nos={dados.nos} somenteLeitura={somenteLeitura} posicoesDisponiveis={dados.posicoesDisponiveis} />
      ) : (
        <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4 sm:p-6">
          <EditorLista key={id} mapaId={id} nos={dados.nos} focoId={focoId} somenteLeitura={somenteLeitura} />
        </section>
      )}
    </EstruturaMapas>
  );
}
