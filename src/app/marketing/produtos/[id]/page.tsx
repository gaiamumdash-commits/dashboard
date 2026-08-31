import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { obterProdutoDigital } from "@/lib/ecc/marketing";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { FormularioEditarProduto } from "@/components/marketing/formulario-editar-produto";

export default async function PaginaProdutoDigital({ params }: { params: Promise<{ id: string }> }) {
  const { id: produtoId } = await params;
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const produto = await obterProdutoDigital(produtoId);

  if (!produto || produto.tenant_id !== tenantId) {
    notFound();
  }

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link href="/marketing/produtos" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Produtos digitais
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-gaiamum-text">{produto.nome}</h1>
          <Link
            href={`/marketing/produtos/${produto.id}/avatar`}
            className="rounded-lg border border-gaiamum-border px-4 py-2 text-sm text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text"
          >
            Avatar do Cliente Ideal →
          </Link>
        </div>

        <div className="mt-8">
          <FormularioEditarProduto produto={produto} />
        </div>
      </main>
    </div>
  );
}
