import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { obterProdutoDigital, obterAvatarComItens } from "@/lib/ecc/marketing";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { FormularioAvatar } from "@/components/marketing/formulario-avatar";

export default async function PaginaAvatarCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id: produtoId } = await params;
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const produto = await obterProdutoDigital(produtoId);

  if (!produto || produto.tenant_id !== tenantId) {
    notFound();
  }

  const avatarComItens = await obterAvatarComItens(produtoId);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <Link href={`/marketing/produtos/${produtoId}`} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← {produto.nome}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Avatar do Cliente Ideal</h1>
        <p className="mt-1 text-gaiamum-text-muted">
          Calibra qualquer conteúdo que o módulo de Marketing gerar pra este produto.
        </p>

        <div className="mt-8">
          <FormularioAvatar
            produtoId={produtoId}
            avatar={avatarComItens?.avatar ?? null}
            itens={avatarComItens?.itens ?? []}
          />
        </div>
      </main>
    </div>
  );
}
