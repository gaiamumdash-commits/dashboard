import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { obterEntrevista, registrarRespostaEtapa, finalizarComExtracaoColada } from "@/lib/ecc/entrevista";
import { gerarPromptEtapa, gerarPromptExtracaoFinal, ROTULO_ETAPA } from "@/lib/ecc/prompt-entrevista";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { GeradorPromptColavel } from "@/components/marketing/gerador-prompt-colavel";
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
  const aoSalvar =
    modo === "extracao"
      ? finalizarComExtracaoColada.bind(null, entrevistaId)
      : registrarRespostaEtapa.bind(null, entrevistaId);

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link href="/marketing/entrevista" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Entrevistas
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Entrevista guiada</h1>

        <div className="mt-8 flex flex-col gap-6">
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
            <>
              {entrevista.transcript.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">
                    Etapas já respondidas
                  </h2>
                  {entrevista.transcript.map((e, i) => (
                    <details key={i} className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium text-gaiamum-text">
                        {ROTULO_ETAPA[e.estagio]}
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gaiamum-text-muted">{e.texto_colado}</p>
                    </details>
                  ))}
                </div>
              )}

              <GeradorPromptColavel
                tituloPrompt={modo === "extracao" ? "Prompt final — resumo estruturado" : `Prompt da etapa: ${ROTULO_ETAPA[etapaAtual]}`}
                prompt={prompt}
                labelBotaoSalvar={modo === "extracao" ? "Concluir entrevista" : "Salvar e continuar"}
                aoSalvar={aoSalvar}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
