import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { deveOferecerLab, registrarVistaOfertaLab, registrarDecisaoOfertaLab } from "@/lib/ecc/lab/oferta";
import { MenuLateral } from "@/components/layout/menu-lateral";

export default async function PaginaOfertaLab() {
  const tenantId = await garantirWorkspace();

  if (!(await deveOferecerLab(tenantId))) {
    redirect("/onboarding");
  }

  await registrarVistaOfertaLab(tenantId);

  const [totalMetasSmart, papelAtual] = await Promise.all([
    contarMetasSmart(tenantId),
    obterPapelAtual(tenantId),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart)} souOwner={papelAtual === "owner"} />
      <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-4 py-12">
        <h1 className="text-3xl font-semibold text-gaiamum-text">Antes de começar...</h1>
        <p className="mt-2 text-gaiamum-text-muted">
          O Gaiamum não é só uma ferramenta pra organizar tarefas — é controle total do seu negócio
          num lugar só, o que te tira do dia a dia puramente operacional e te dá espaço pra pensar
          estratégico. Você pode ver isso na prática agora, ou já ir direto pro seu workspace.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <form action={registrarDecisaoOfertaLab.bind(null, "lab")}>
            <button
              type="submit"
              className="flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-gaiamum-primary bg-gaiamum-surface p-6 text-left transition hover:border-gaiamum-primary-dark"
            >
              <span className="text-2xl">🎮</span>
              <span className="text-lg font-semibold text-gaiamum-text">Fazer o Gaiamum Lab</span>
              <span className="text-sm text-gaiamum-text-muted">
                Um estudo de caso guiado mostra como sair do operacional pro estratégico usando
                decisões, indicadores e metas na prática, antes de aplicar no seu negócio de
                verdade. ~20 min.
              </span>
            </button>
          </form>

          <form action={registrarDecisaoOfertaLab.bind(null, "pular")}>
            <button
              type="submit"
              className="flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6 text-left transition hover:border-gaiamum-text-muted"
            >
              <span className="text-2xl">→</span>
              <span className="text-lg font-semibold text-gaiamum-text">Ir direto pro app</span>
              <span className="text-sm text-gaiamum-text-muted">
                Prefere aprender fazendo? Comece já definindo suas metas SMART. O Lab continua
                sempre disponível no menu e em Configurações.
              </span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
