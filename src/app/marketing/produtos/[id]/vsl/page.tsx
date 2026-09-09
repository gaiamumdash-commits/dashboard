import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { obterProdutoDigital, obterPerfilNegocio, obterAvatarComItens } from "@/lib/ecc/marketing";
import { listarPecasDoProduto, obterPaginaVenda } from "@/lib/ecc/pagina-venda";
import { obterRoteiroVsl, obterPromptDeVsl, salvarVslColado, type ReferenciaVsl } from "@/lib/ecc/vsl";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { GeradorPromptColavel } from "@/components/marketing/gerador-prompt-colavel";
import { BotaoCopiar } from "@/components/marketing/botao-copiar";

function blocoRoteiro(titulo: string, tempo: string | null, texto: string) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">{titulo}</h2>
        {tempo && (
          <span className="rounded-full bg-gaiamum-surface-raised px-2 py-0.5 text-[10px] font-medium text-gaiamum-text-muted">
            {tempo}
          </span>
        )}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-gaiamum-text">{texto}</p>
    </div>
  );
}

export default async function RoteiroVslDoProduto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ referencia?: string }>;
}) {
  const { id: produtoId } = await params;
  const { referencia: referenciaNaUrl } = await searchParams;
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const produto = await obterProdutoDigital(produtoId);
  if (!produto || produto.tenant_id !== tenantId) {
    notFound();
  }

  const roteiro = await obterRoteiroVsl(produtoId);

  const perfil = await obterPerfilNegocio(tenantId);
  const avatarComItens = await obterAvatarComItens(produtoId);
  const preRequisitoOk = Boolean(perfil) && Boolean(avatarComItens) && (avatarComItens?.itens.length ?? 0) > 0;

  const paginaVenda = roteiro ? null : await obterPaginaVenda(produtoId);
  const pecas = roteiro ? [] : await listarPecasDoProduto(produtoId);
  const semOpcoesDeReferencia = !paginaVenda && pecas.length === 0;
  const escolhaValida =
    referenciaNaUrl === "nenhuma" ||
    (referenciaNaUrl === "pagina" && Boolean(paginaVenda)) ||
    pecas.some((p) => p.id === referenciaNaUrl);
  const precisaEscolherReferencia = !roteiro && !semOpcoesDeReferencia && !escolhaValida;

  let referencia: ReferenciaVsl = { tipo: "nenhuma", id: null };
  if (escolhaValida) {
    if (referenciaNaUrl === "pagina") referencia = { tipo: "pagina", id: paginaVenda!.id };
    else if (referenciaNaUrl !== "nenhuma") referencia = { tipo: "peca", id: referenciaNaUrl! };
  }

  const prontoParaGerar = !roteiro && preRequisitoOk && (semOpcoesDeReferencia || escolhaValida);
  const prompt = prontoParaGerar ? await obterPromptDeVsl(produtoId, referencia) : null;

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link href={`/marketing/produtos/${produtoId}`} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← {produto.nome}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Roteiro de VSL</h1>

        <div className="mt-8">
          {roteiro ? (
            <div className="flex flex-col gap-6">
              {roteiro.checklist_avisos && (
                <div className="rounded-lg border border-gaiamum-warning bg-gaiamum-warning/10 p-4">
                  <p className="text-xs font-semibold text-gaiamum-warning">Avisos do checklist</p>
                  <p className="mt-1 text-sm text-gaiamum-text">{roteiro.checklist_avisos}</p>
                  <p className="mt-1 text-xs text-gaiamum-text-muted">
                    Peça pro Claude corrigir e gere o roteiro de novo se quiser — colar de novo atualiza este roteiro.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
                {blocoRoteiro("Gancho", roteiro.tempo_gancho, roteiro.gancho)}
                {blocoRoteiro("Identificação da dor", roteiro.tempo_identificacao_dor, roteiro.identificacao_dor)}
                {blocoRoteiro("Agitação", roteiro.tempo_agitacao, roteiro.agitacao)}
                {blocoRoteiro("Virada / solução", roteiro.tempo_virada, roteiro.virada)}
                {roteiro.prova && blocoRoteiro("Prova", roteiro.tempo_prova, roteiro.prova)}
                {blocoRoteiro("Oferta", roteiro.tempo_oferta, roteiro.oferta)}
                {blocoRoteiro("CTA final", roteiro.tempo_cta_final, roteiro.cta_final)}
              </div>

              <BotaoCopiar
                label="Copiar roteiro completo"
                texto={[
                  roteiro.tempo_gancho ? `[${roteiro.tempo_gancho}] Gancho:` : "Gancho:",
                  roteiro.gancho,
                  "",
                  roteiro.tempo_identificacao_dor ? `[${roteiro.tempo_identificacao_dor}] Identificação da dor:` : "Identificação da dor:",
                  roteiro.identificacao_dor,
                  "",
                  roteiro.tempo_agitacao ? `[${roteiro.tempo_agitacao}] Agitação:` : "Agitação:",
                  roteiro.agitacao,
                  "",
                  roteiro.tempo_virada ? `[${roteiro.tempo_virada}] Virada / solução:` : "Virada / solução:",
                  roteiro.virada,
                  roteiro.prova ? `\n${roteiro.tempo_prova ? `[${roteiro.tempo_prova}] ` : ""}Prova:\n${roteiro.prova}` : "",
                  "",
                  roteiro.tempo_oferta ? `[${roteiro.tempo_oferta}] Oferta:` : "Oferta:",
                  roteiro.oferta,
                  "",
                  roteiro.tempo_cta_final ? `[${roteiro.tempo_cta_final}] CTA final:` : "CTA final:",
                  roteiro.cta_final,
                ]
                  .filter(Boolean)
                  .join("\n")}
              />
            </div>
          ) : !preRequisitoOk ? (
            <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
              <p className="text-sm text-gaiamum-text">
                Preencha {!perfil && "o Perfil do Negócio"}
                {!perfil && !avatarComItens && " e "}
                {(!avatarComItens || avatarComItens.itens.length === 0) && "o Avatar do Cliente Ideal"} antes de gerar o
                roteiro — o prompt precisa desse contexto pra não sair genérico.
              </p>
              <div className="mt-3 flex gap-4">
                {!perfil && (
                  <Link href="/marketing/perfil" className="text-sm text-gaiamum-primary hover:underline">
                    Preencher perfil →
                  </Link>
                )}
                {(!avatarComItens || avatarComItens.itens.length === 0) && (
                  <Link href={`/marketing/produtos/${produtoId}/avatar`} className="text-sm text-gaiamum-primary hover:underline">
                    Preencher avatar →
                  </Link>
                )}
              </div>
            </div>
          ) : precisaEscolherReferencia ? (
            <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
              <p className="text-sm text-gaiamum-text">
                Quer usar algo já gerado como referência de tom e argumento? É opcional.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {paginaVenda && (
                  <Link
                    href="?referencia=pagina"
                    className="rounded-lg border border-gaiamum-border px-3 py-2 text-sm text-gaiamum-text transition hover:border-gaiamum-primary"
                  >
                    Página de venda: {paginaVenda.headline}
                  </Link>
                )}
                {pecas.map((peca) => (
                  <Link
                    key={peca.id}
                    href={`?referencia=${peca.id}`}
                    className="rounded-lg border border-gaiamum-border px-3 py-2 text-sm text-gaiamum-text transition hover:border-gaiamum-primary"
                  >
                    Peça de conteúdo: {peca.gancho}
                  </Link>
                ))}
                <Link
                  href="?referencia=nenhuma"
                  className="rounded-lg border border-dashed border-gaiamum-border px-3 py-2 text-sm text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text"
                >
                  Nenhuma, criar do zero
                </Link>
              </div>
            </div>
          ) : (
            prompt && (
              <GeradorPromptColavel
                tituloPrompt="Prompt — roteiro de VSL"
                prompt={prompt}
                labelBotaoSalvar="Salvar roteiro de VSL"
                aoSalvar={salvarVslColado.bind(null, produtoId, referencia)}
              />
            )
          )}
        </div>
      </main>
    </div>
  );
}
