import Link from "next/link";
import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { listarProdutosDigitais } from "@/lib/ecc/marketing";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { FormularioNovoProduto } from "@/components/marketing/formulario-novo-produto";

const ROTULO_STATUS: Record<string, string> = {
  rascunho: "Rascunho",
  validando: "Validando",
  ativo: "Ativo",
  pausado: "Pausado",
};

export default async function PaginaProdutosDigitais() {
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const produtos = await listarProdutosDigitais(tenantId);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-12">
        <Link href="/marketing" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          ← Marketing
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Produtos digitais</h1>
        <p className="mt-1 text-gaiamum-text-muted">Cada produto tem seu próprio Avatar do Cliente Ideal.</p>

        <div className="mt-8">
          <FormularioNovoProduto />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {produtos.map((produto) => (
            <Link
              key={produto.id}
              href={`/marketing/produtos/${produto.id}`}
              className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 transition hover:border-gaiamum-primary"
            >
              <p className="font-semibold text-gaiamum-text">{produto.nome}</p>
              <p className="mt-1 text-sm text-gaiamum-text-muted">
                {ROTULO_STATUS[produto.status]}
                {produto.preco !== null ? ` · ${produto.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}
              </p>
              {produto.promessa && <p className="mt-2 text-sm text-gaiamum-text-muted">{produto.promessa}</p>}
            </Link>
          ))}
          {produtos.length === 0 && (
            <p className="col-span-full text-gaiamum-text-muted">Nenhum produto ainda. Crie o primeiro acima.</p>
          )}
        </div>
      </main>
    </div>
  );
}
