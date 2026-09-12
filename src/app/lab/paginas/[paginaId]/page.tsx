import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { garantirTenantLab } from "@/lib/ecc/lab/tenant";
import { semearCafeMangue } from "@/lib/ecc/lab/seed-cafe-mangue";
import { obterPaginaLivre } from "@/lib/ecc/paginas-livres";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { EditorPaginaLivreLabLazy } from "@/components/lab/editor-pagina-livre-lab-lazy";
import type { PartialBlock } from "@blocknote/core";

export default async function PaginaPaginaLivreLab({
  params,
}: {
  params: Promise<{ paginaId: string }>;
}) {
  const { paginaId } = await params;
  const tenantId = await garantirWorkspace();
  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  const user = await obterUsuarioAtual();
  if (!user) {
    redirect("/auth");
  }

  const [totalMetasSmart, papelAtual, tenantIdLab] = await Promise.all([
    contarMetasSmart(tenantId),
    obterPapelAtual(tenantId),
    garantirTenantLab(),
  ]);

  const projetoId = await semearCafeMangue(tenantIdLab, user.id);

  const pagina = await obterPaginaLivre(paginaId, projetoId);

  if (!pagina) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart)} souOwner={papelAtual === "owner"} />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-10">
        <Link href="/lab/paginas" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Páginas
        </Link>

        <div className="mt-4">
          <EditorPaginaLivreLabLazy
            paginaId={pagina.id}
            projetoId={projetoId}
            tituloInicial={pagina.titulo}
            conteudoInicial={pagina.conteudo as PartialBlock[]}
            atualizadoEmInicial={pagina.atualizado_em}
          />
        </div>
      </main>
    </div>
  );
}
