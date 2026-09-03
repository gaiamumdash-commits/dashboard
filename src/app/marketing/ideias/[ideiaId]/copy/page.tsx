import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { obterIdeia, obterPeca, obterPromptDeCopy, salvarCopyColada, escolherCtaDaPeca } from "@/lib/ecc/mandala";
import { enviarPecaParaProducao, obterProjetoIdDaTarefa } from "@/lib/ecc/producao-conteudo";
import { ROTULO_FASE_FUNIL, ROTULO_TIPO_ANUNCIO } from "@/lib/ecc/prompt-mandala";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { GeradorPromptColavel } from "@/components/marketing/gerador-prompt-colavel";
import type { FaseFunil, PecaConteudo } from "@/lib/ecc/tipos";

const FASES: FaseFunil[] = ["descoberta", "relacionamento", "conversao", "remarketing"];

function ctaDaFase(peca: PecaConteudo, fase: FaseFunil): string {
  return {
    descoberta: peca.cta_descoberta,
    relacionamento: peca.cta_relacionamento,
    conversao: peca.cta_conversao,
    remarketing: peca.cta_remarketing,
  }[fase];
}

export default async function PaginaCopyDaIdeia({ params }: { params: Promise<{ ideiaId: string }> }) {
  const { ideiaId } = await params;
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const ideia = await obterIdeia(ideiaId);
  if (!ideia || ideia.tenant_id !== tenantId) {
    notFound();
  }

  const peca = await obterPeca(ideiaId);
  const projetoId = peca?.tarefa_id ? await obterProjetoIdDaTarefa(peca.tarefa_id) : null;
  const prompt = peca ? null : (await obterPromptDeCopy(ideiaId)).prompt;

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link
          href={`/marketing/produtos/${ideia.produto_digital_id}/ideias`}
          className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text"
        >
          ← Ideias de conteúdo
        </Link>
        <p className="mt-2 text-xs font-medium text-gaiamum-text-muted">{ROTULO_TIPO_ANUNCIO[ideia.tipo_anuncio]}</p>
        <h1 className="mt-1 text-2xl font-semibold text-gaiamum-text">{ideia.titulo_gancho}</h1>

        <div className="mt-8">
          {peca ? (
            <div className="flex flex-col gap-6">
              {peca.checklist_avisos && (
                <div className="rounded-lg border border-gaiamum-warning bg-gaiamum-warning/10 p-4">
                  <p className="text-xs font-semibold text-gaiamum-warning">Avisos do checklist</p>
                  <p className="mt-1 text-sm text-gaiamum-text">{peca.checklist_avisos}</p>
                  <p className="mt-1 text-xs text-gaiamum-text-muted">
                    Peça pro Claude corrigir e gere a copy de novo se quiser — colar de novo atualiza esta peça.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
                <p className="whitespace-pre-wrap text-sm text-gaiamum-text">{peca.paragrafo_1}</p>
                <p className="mt-4 whitespace-pre-wrap text-sm text-gaiamum-text">{peca.paragrafo_2}</p>
              </div>

              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">
                  CTA por fase do funil
                </h2>
                <div className="mt-3 flex flex-col gap-2">
                  {FASES.map((fase) => (
                    <div
                      key={fase}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                        peca.cta_escolhida === fase ? "border-gaiamum-primary bg-gaiamum-primary/10" : "border-gaiamum-border"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-medium text-gaiamum-text-muted">{ROTULO_FASE_FUNIL[fase]}</p>
                        <p className="text-sm text-gaiamum-text">{ctaDaFase(peca, fase)}</p>
                      </div>
                      {peca.cta_escolhida !== fase && (
                        <form action={escolherCtaDaPeca.bind(null, peca.id, fase)}>
                          <button
                            type="submit"
                            className="shrink-0 rounded-lg border border-gaiamum-border px-3 py-1.5 text-xs text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
                          >
                            Escolher
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {peca.tarefa_id ? (
                  <Link
                    href={projetoId ? `/projetos/${projetoId}/tarefas` : "/projetos"}
                    className="text-sm text-gaiamum-primary hover:underline"
                  >
                    Ver cartão no quadro de produção →
                  </Link>
                ) : (
                  <form action={enviarPecaParaProducao.bind(null, peca.id)}>
                    <button
                      type="submit"
                      className="rounded-lg bg-gaiamum-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark"
                    >
                      Enviar pra produção
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <GeradorPromptColavel
              tituloPrompt="Prompt — copy completa + CTAs"
              prompt={prompt ?? ""}
              labelBotaoSalvar="Salvar copy"
              aoSalvar={salvarCopyColada.bind(null, ideiaId)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
