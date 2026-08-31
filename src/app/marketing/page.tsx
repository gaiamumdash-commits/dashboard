import Link from "next/link";
import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { obterPerfilNegocio, listarProdutosDigitais } from "@/lib/ecc/marketing";
import { MenuLateral } from "@/components/layout/menu-lateral";

export default async function PaginaMarketing() {
  const tenantId = await garantirWorkspace();

  // Estratégia de negócio é dado sensível — só o owner do workspace enxerga,
  // mesma regra do Financeiro.
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const [perfil, produtos] = await Promise.all([obterPerfilNegocio(tenantId), listarProdutosDigitais(tenantId)]);

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral temMetasSmart souOwner />
      <main className="mx-auto max-w-5xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-semibold text-gaiamum-text">Marketing</h1>
        <p className="mt-1 text-gaiamum-text-muted">
          Perfil do negócio, produtos digitais e o público de cada um.
        </p>

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/marketing/perfil"
            className="flex items-center justify-between rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 transition hover:border-gaiamum-primary"
          >
            <div>
              <p className="font-semibold text-gaiamum-text">Perfil do negócio</p>
              <p className="mt-1 text-sm text-gaiamum-text-muted">
                {perfil ? `${perfil.nome_negocio} — ${perfil.nicho}` : "Ainda não preenchido."}
              </p>
            </div>
            <span className="text-sm text-gaiamum-primary">{perfil ? "Editar →" : "Preencher →"}</span>
          </Link>

          <Link
            href="/marketing/entrevista"
            className="flex items-center justify-between rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 transition hover:border-gaiamum-primary"
          >
            <div>
              <p className="font-semibold text-gaiamum-text">Entrevista guiada</p>
              <p className="mt-1 text-sm text-gaiamum-text-muted">
                Prompts prontos pra rodar no Claude Code, sem gastar API.
              </p>
            </div>
            <span className="text-sm text-gaiamum-primary">Começar →</span>
          </Link>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
              Produtos digitais
            </h2>
            <Link href="/marketing/produtos" className="text-sm text-gaiamum-primary hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {produtos.map((produto) => (
              <Link
                key={produto.id}
                href={`/marketing/produtos/${produto.id}`}
                className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 transition hover:border-gaiamum-primary"
              >
                <p className="font-semibold text-gaiamum-text">{produto.nome}</p>
                <p className="mt-1 text-sm text-gaiamum-text-muted">{produto.status}</p>
              </Link>
            ))}
            {produtos.length === 0 && (
              <p className="col-span-full text-sm text-gaiamum-text-muted">
                Nenhum produto digital ainda.{" "}
                <Link href="/marketing/produtos" className="text-gaiamum-primary hover:underline">
                  Cadastre o primeiro
                </Link>
                .
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
