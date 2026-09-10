import Link from "next/link";
import { notFound } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { eSouGestorDoProjeto, obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { obterPaginaLivre } from "@/lib/ecc/paginas-livres";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { EditorPaginaLivreLazy } from "@/components/projetos/editor-pagina-livre-lazy";
import type { PartialBlock } from "@blocknote/core";

export default async function PaginaPaginaLivre({
  params,
}: {
  params: Promise<{ id: string; paginaId: string }>;
}) {
  const { id: projetoId, paginaId } = await params;
  const tenantId = await garantirWorkspace();
  const user = await obterUsuarioAtual();

  const pagina = await obterPaginaLivre(paginaId, projetoId);

  if (!pagina) {
    notFound();
  }

  const [totalMetasSmart, acessoCompleto, papelAtual, souGestor] = await Promise.all([
    contarMetasSmart(tenantId),
    temAcessoCompleto(tenantId),
    obterPapelAtual(tenantId),
    user ? eSouGestorDoProjeto(projetoId, user.id) : Promise.resolve(false),
  ]);

  const podeExcluir = papelAtual === "owner" || souGestor;

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral
        temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)}
        acessoCompleto={acessoCompleto}
        souOwner={papelAtual === "owner"}
      />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-10">
        <Link
          href={`/projetos/${projetoId}/paginas`}
          className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text"
        >
          ← Páginas
        </Link>

        <div className="mt-4">
          <EditorPaginaLivreLazy
            paginaId={pagina.id}
            projetoId={projetoId}
            tituloInicial={pagina.titulo}
            conteudoInicial={pagina.conteudo as PartialBlock[]}
            atualizadoEmInicial={pagina.atualizado_em}
            podeExcluir={podeExcluir}
          />
        </div>
      </main>
    </div>
  );
}
