import { redirect } from "next/navigation";
import Link from "next/link";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { MenuLateral } from "@/components/layout/menu-lateral";

export default async function PaginaConfiguracoes() {
  const tenantId = await garantirWorkspace();

  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  const [totalMetasSmart, papelAtual] = await Promise.all([
    contarMetasSmart(tenantId),
    obterPapelAtual(tenantId),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart)} souOwner={papelAtual === "owner"} />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-semibold text-gaiamum-text">Configurações</h1>
        <p className="mt-1 text-gaiamum-text-muted">Ajustes do workspace.</p>

        <section className="mt-8 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <h2 className="text-lg font-semibold text-gaiamum-text">Aprendizado</h2>
          <Link href="/lab" className="mt-3 inline-block text-sm text-gaiamum-primary hover:underline">
            🎮 Rever o tutorial guiado (Gaiamum Lab)
          </Link>
        </section>
      </main>
    </div>
  );
}
