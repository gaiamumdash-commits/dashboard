import Link from "next/link";
import { notFound } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { eSouGestorDoProjeto, obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import type { Projeto } from "@/lib/ecc/tipos";
import { listarPaginasLivresDoProjeto } from "@/lib/ecc/paginas-livres";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ListaPaginasLivres } from "@/components/projetos/lista-paginas-livres";

export default async function PaginaPaginasLivres({ params }: { params: Promise<{ id: string }> }) {
  const { id: projetoId } = await params;
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const user = await obterUsuarioAtual();

  const { data: projeto } = await supabase
    .from("projetos")
    .select("*")
    .eq("id", projetoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!projeto) {
    notFound();
  }

  const [paginas, totalMetasSmart, acessoCompleto, papelAtual, souGestor] = await Promise.all([
    listarPaginasLivresDoProjeto(projetoId),
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
          href={`/projetos/${projetoId}/tarefas`}
          className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text"
        >
          ← {(projeto as Projeto).nome}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Páginas</h1>

        <div className="mt-8">
          <ListaPaginasLivres projetoId={projetoId} paginasIniciais={paginas} podeExcluir={podeExcluir} />
        </div>
      </main>
    </div>
  );
}
