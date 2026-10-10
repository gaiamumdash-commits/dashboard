import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { carregarMapa, contextoMapas } from "@/lib/ecc/mapas/dados";
import { EstruturaMapas } from "@/components/mapas/estrutura-mapas";
import { EditorLista } from "@/components/mapas/editor-lista";

export const metadata: Metadata = { title: "Mapa · Gaiamum" };

/** Um mapa. `?foco=<id>` abre focado num ramo (caminho de volta no topo).
 * Mapa de outra pessoa (compartilhado) abre só pra leitura. */
export default async function PaginaMapa({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ foco?: string }>;
}) {
  const [{ id }, { foco }] = await Promise.all([params, searchParams]);
  const ctx = await contextoMapas();
  const dados = await carregarMapa(ctx.tenantId, id);
  if (!dados) notFound();
  const somenteLeitura = dados.mapa.user_id !== ctx.userId;

  return (
    <EstruturaMapas ctx={ctx} titulo={dados.mapa.titulo}>
      {somenteLeitura && (
        <p className="rounded-xl bg-gaiamum-surface-raised px-4 py-2 text-sm text-gaiamum-text-muted">
          Mapa compartilhado pela equipe — você pode ler, recolher e focar nos ramos, mas não editar.
        </p>
      )}
      <section className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4 sm:p-6">
        <EditorLista key={id} mapaId={id} nos={dados.nos} focoId={typeof foco === "string" ? foco : null} somenteLeitura={somenteLeitura} />
      </section>
    </EstruturaMapas>
  );
}
