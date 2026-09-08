import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { obterProdutoDigital, obterPerfilNegocio, obterAvatarComItens } from "@/lib/ecc/marketing";
import {
  listarPecasDoProduto,
  obterPaginaVenda,
  obterPromptDePaginaVenda,
  salvarPaginaVendaColada,
} from "@/lib/ecc/pagina-venda";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { GeradorPromptColavel } from "@/components/marketing/gerador-prompt-colavel";
import { BotaoCopiar } from "@/components/marketing/botao-copiar";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PaginaDeVendaDoProduto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ peca?: string }>;
}) {
  const { id: produtoId } = await params;
  const { peca: pecaNaUrl } = await searchParams;
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const produto = await obterProdutoDigital(produtoId);
  if (!produto || produto.tenant_id !== tenantId) {
    notFound();
  }

  const paginaVenda = await obterPaginaVenda(produtoId);

  const perfil = await obterPerfilNegocio(tenantId);
  const avatarComItens = await obterAvatarComItens(produtoId);
  const preRequisitoOk = Boolean(perfil) && Boolean(avatarComItens) && (avatarComItens?.itens.length ?? 0) > 0;

  const pecas = paginaVenda ? [] : await listarPecasDoProduto(produtoId);
  const semPecas = pecas.length === 0;
  const escolhaValida = pecaNaUrl === "nenhuma" || pecas.some((p) => p.id === pecaNaUrl);
  const precisaEscolherPeca = !paginaVenda && !semPecas && !escolhaValida;
  const pecaReferenciaId = pecaNaUrl === "nenhuma" ? null : escolhaValida ? (pecaNaUrl ?? null) : null;

  const prontoParaGerar = !paginaVenda && preRequisitoOk && (semPecas || escolhaValida);
  const prompt = prontoParaGerar ? await obterPromptDePaginaVenda(produtoId, pecaReferenciaId) : null;

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link href={`/marketing/produtos/${produtoId}`} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← {produto.nome}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Página de venda</h1>

        <div className="mt-8">
          {paginaVenda ? (
            <div className="flex flex-col gap-6">
              {paginaVenda.checklist_avisos && (
                <div className="rounded-lg border border-gaiamum-warning bg-gaiamum-warning/10 p-4">
                  <p className="text-xs font-semibold text-gaiamum-warning">Avisos do checklist</p>
                  <p className="mt-1 text-sm text-gaiamum-text">{paginaVenda.checklist_avisos}</p>
                  <p className="mt-1 text-xs text-gaiamum-text-muted">
                    Peça pro Claude corrigir e gere a página de novo se quiser — colar de novo atualiza esta página.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
                <p className="text-2xl font-semibold text-gaiamum-text">{paginaVenda.headline}</p>
                <p className="mt-2 text-base text-gaiamum-text-muted">{paginaVenda.subheadline}</p>
                <p className="mt-5 whitespace-pre-wrap text-sm text-gaiamum-text">{paginaVenda.introducao}</p>

                <div className="mt-6">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">Benefícios</h2>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {paginaVenda.beneficios.split("|").map((item, i) => (
                      <li key={i} className="text-sm text-gaiamum-text">
                        • {item.trim()}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">Oferta</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gaiamum-text">{paginaVenda.oferta}</p>
                </div>

                {produto.preco !== null && (
                  <p className="mt-6 text-lg font-semibold text-gaiamum-text">{formatarMoeda(produto.preco)}</p>
                )}

                {paginaVenda.prova_social && (
                  <div className="mt-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">Prova social</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gaiamum-text">{paginaVenda.prova_social}</p>
                  </div>
                )}

                {paginaVenda.garantia && (
                  <div className="mt-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">Garantia</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gaiamum-text">{paginaVenda.garantia}</p>
                  </div>
                )}

                <p className="mt-8 rounded-lg bg-gaiamum-primary px-5 py-3 text-center text-base font-medium text-white">
                  {paginaVenda.cta_final}
                </p>
              </div>

              <BotaoCopiar
                label="Copiar página completa"
                texto={[
                  paginaVenda.headline,
                  paginaVenda.subheadline,
                  "",
                  paginaVenda.introducao,
                  "",
                  "Benefícios:",
                  ...paginaVenda.beneficios.split("|").map((item) => `- ${item.trim()}`),
                  "",
                  "Oferta:",
                  paginaVenda.oferta,
                  produto.preco !== null ? `\nPreço: ${formatarMoeda(produto.preco)}` : "",
                  paginaVenda.prova_social ? `\nProva social:\n${paginaVenda.prova_social}` : "",
                  paginaVenda.garantia ? `\nGarantia:\n${paginaVenda.garantia}` : "",
                  "",
                  paginaVenda.cta_final,
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
                {(!avatarComItens || avatarComItens.itens.length === 0) && "o Avatar do Cliente Ideal"} antes de gerar a
                página — o prompt precisa desse contexto pra não sair genérico.
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
          ) : precisaEscolherPeca ? (
            <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
              <p className="text-sm text-gaiamum-text">
                Quer usar alguma peça de conteúdo já gerada como referência de tom e argumento? É opcional.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {pecas.map((peca) => (
                  <Link
                    key={peca.id}
                    href={`?peca=${peca.id}`}
                    className="rounded-lg border border-gaiamum-border px-3 py-2 text-sm text-gaiamum-text transition hover:border-gaiamum-primary"
                  >
                    {peca.gancho}
                  </Link>
                ))}
                <Link
                  href="?peca=nenhuma"
                  className="rounded-lg border border-dashed border-gaiamum-border px-3 py-2 text-sm text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text"
                >
                  Nenhuma, criar do zero
                </Link>
              </div>
            </div>
          ) : (
            prompt && (
              <GeradorPromptColavel
                tituloPrompt="Prompt — página de venda"
                prompt={prompt}
                labelBotaoSalvar="Salvar página de venda"
                aoSalvar={salvarPaginaVendaColada.bind(null, produtoId, pecaReferenciaId)}
              />
            )
          )}
        </div>
      </main>
    </div>
  );
}
