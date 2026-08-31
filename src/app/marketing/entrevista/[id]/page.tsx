import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { obterEntrevista } from "@/lib/ecc/entrevista";
import { gerarPromptEtapa, gerarPromptExtracaoFinal, ROTULO_ETAPA } from "@/lib/ecc/prompt-entrevista";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { GeradorPromptEntrevista } from "@/components/marketing/gerador-prompt-entrevista";
import type { EstagioEntrevista } from "@/lib/ecc/tipos";

export default async function PaginaEntrevista({ params }: { params: Promise<{ id: string }> }) {
  const { id: entrevistaId } = await params;
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const entrevista = await obterEntrevista(entrevistaId);

  if (!entrevista || entrevista.tenant_id !== tenantId) {
    notFound();
  }

  const concluida = entrevista.status === "concluida";
  const etapaAtual = entrevista.estagio_atual as Exclude<EstagioEntrevista, "concluida">;
  const modo = entrevista.transcript.length >= 4 ? "extracao" : "etapa";
  const prompt = concluida
    ? ""
    : modo === "extracao"
      ? gerarPromptExtracaoFinal(entrevista.transcript)
      : gerarPromptEtapa(etapaAtual, entrevista.transcript);

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link href="/marketing/entrevista" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Entrevistas
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Entrevista guiada</h1>

        <div className="mt-8">
          {concluida ? (
            <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
              <p className="text-sm text-gaiamum-text">
                Entrevista concluída — Perfil, Produto e Avatar foram preenchidos.
              </p>
              {entrevista.produto_digital_id && (
                <Link
                  href={`/marketing/produtos/${entrevista.produto_digital_id}`}
                  className="mt-3 inline-block text-sm text-gaiamum-primary hover:underline"
                >
                  Ver produto criado →
                </Link>
              )}
            </div>
          ) : (
            <GeradorPromptEntrevista
              entrevistaId={entrevista.id}
              modo={modo}
              rotuloEtapaAtual={ROTULO_ETAPA[etapaAtual]}
              prompt={prompt}
              etapasAnteriores={entrevista.transcript}
            />
          )}
        </div>
      </main>
    </div>
  );
}
