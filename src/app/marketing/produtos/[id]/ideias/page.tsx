import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { obterProdutoDigital, obterPerfilNegocio, obterAvatarComItens } from "@/lib/ecc/marketing";
import { listarLotesDeIdeias, obterPromptDeIdeias, salvarLoteIdeias } from "@/lib/ecc/mandala";
import { ROTULO_TIPO_ANUNCIO } from "@/lib/ecc/prompt-mandala";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { GeradorPromptColavel } from "@/components/marketing/gerador-prompt-colavel";
import type { IdeiaConteudo, TipoAnuncio } from "@/lib/ecc/tipos";

const TIPOS: TipoAnuncio[] = ["ultra_segmentado", "problema_solucao", "pesquisa_cientifica", "atualidades_trend"];

export default async function PaginaIdeiasDeConteudo({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { id: produtoId } = await params;
  const { tipo: tipoNaUrl } = await searchParams;
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const produto = await obterProdutoDigital(produtoId);
  if (!produto || produto.tenant_id !== tenantId) {
    notFound();
  }

  const perfil = await obterPerfilNegocio(tenantId);
  const avatarComItens = await obterAvatarComItens(produtoId);
  const preRequisitoOk = Boolean(perfil) && Boolean(avatarComItens) && (avatarComItens?.itens.length ?? 0) > 0;

  const tipo = TIPOS.includes(tipoNaUrl as TipoAnuncio) ? (tipoNaUrl as TipoAnuncio) : null;
  const prompt = tipo && preRequisitoOk ? await obterPromptDeIdeias(produtoId, tipo) : null;

  const lotes = await listarLotesDeIdeias(produtoId);
  const lotesAgrupados = new Map<string, IdeiaConteudo[]>();
  for (const ideia of lotes) {
    const grupo = lotesAgrupados.get(ideia.lote_id) ?? [];
    grupo.push(ideia);
    lotesAgrupados.set(ideia.lote_id, grupo);
  }

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link href={`/marketing/produtos/${produtoId}`} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← {produto.nome}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Ideias de conteúdo</h1>

        {!preRequisitoOk ? (
          <div className="mt-8 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6">
            <p className="text-sm text-gaiamum-text">
              Preencha {!perfil && "o Perfil do Negócio"}
              {!perfil && !avatarComItens && " e "}
              {(!avatarComItens || avatarComItens.itens.length === 0) && "o Avatar do Cliente Ideal"} antes de gerar
              ideias — o prompt precisa desse contexto pra não sair genérico.
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
        ) : (
          <>
            <div className="mt-8 flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <Link
                  key={t}
                  href={`?tipo=${t}`}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    tipo === t
                      ? "border-gaiamum-primary bg-gaiamum-primary/10 text-gaiamum-primary"
                      : "border-gaiamum-border text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
                  }`}
                >
                  {ROTULO_TIPO_ANUNCIO[t]}
                </Link>
              ))}
            </div>

            {prompt && (
              <div className="mt-6">
                <GeradorPromptColavel
                  tituloPrompt={`Prompt — 12 ideias (${ROTULO_TIPO_ANUNCIO[tipo!]})`}
                  prompt={prompt}
                  labelBotaoSalvar="Salvar ideias"
                  aoSalvar={salvarLoteIdeias.bind(null, produtoId, tipo!)}
                />
              </div>
            )}
          </>
        )}

        {lotesAgrupados.size > 0 && (
          <div className="mt-10 flex flex-col gap-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">Ideias geradas</h2>
            {Array.from(lotesAgrupados.entries()).map(([loteId, ideias]) => (
              <div key={loteId} className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
                <p className="text-xs font-medium text-gaiamum-text-muted">{ROTULO_TIPO_ANUNCIO[ideias[0].tipo_anuncio]}</p>
                <div className="mt-3 flex flex-col gap-2">
                  {ideias
                    .sort((a, b) => a.numero - b.numero)
                    .map((ideia) => (
                      <Link
                        key={ideia.id}
                        href={`/marketing/ideias/${ideia.id}/copy`}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-gaiamum-text transition hover:bg-gaiamum-surface-raised"
                      >
                        <span>
                          {ideia.numero}. {ideia.titulo_gancho}
                          {ideia.checklist_avisos && <span className="ml-2 text-xs text-gaiamum-warning">⚠ revisar</span>}
                        </span>
                        <span className="shrink-0 text-xs text-gaiamum-text-muted">Desenvolver →</span>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
