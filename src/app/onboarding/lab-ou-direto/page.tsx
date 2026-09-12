import Image from "next/image";
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
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-8">
        <div className="relative w-full overflow-hidden rounded-2xl sm:hidden" style={{ aspectRatio: "941 / 1672" }}>
          <Image
            src="/lab/oferta-lab-mobile.png"
            alt="Gaiamum Lab — coloque ordem no Mangue"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="relative hidden w-full overflow-hidden rounded-2xl sm:block" style={{ aspectRatio: "1536 / 1024" }}>
          <Image
            src="/lab/oferta-lab-desktop.png"
            alt="Gaiamum Lab — coloque ordem no Mangue"
            fill
            priority
            sizes="(min-width: 640px) 768px, 100vw"
            className="object-cover"
          />
        </div>

        <form action={registrarDecisaoOfertaLab.bind(null, "lab")} className="mt-6 w-full">
          <button
            type="submit"
            className="w-full rounded-xl bg-gaiamum-primary px-6 py-4 text-lg font-semibold text-white transition hover:bg-gaiamum-primary-dark"
          >
            🎮 Comece agora! Faça o Gaiamum Lab
          </button>
        </form>
        <p className="mt-2 text-center text-sm text-gaiamum-text-muted">
          É grátis e leva ~20 min: um estudo de caso guiado mostra como o Gaiamum pode potencializar
          seu negócio, com decisões, indicadores e metas na prática, antes de aplicar de verdade.
        </p>
        <p className="mt-2 text-center text-sm text-gaiamum-text-muted">
          Quem conclui ganha a patente 🏅 Explorador e um{" "}
          <span className="rounded bg-gaiamum-warning px-1.5 py-0.5 font-semibold text-black">
            cupom de 5% de desconto
          </span>{" "}
          na mensalidade do Gaiamum.
        </p>

        <form action={registrarDecisaoOfertaLab.bind(null, "pular")} className="mt-8">
          <button type="submit" className="text-xs text-gaiamum-text-muted underline hover:text-gaiamum-text">
            Não, prefiro ir direto pro app
          </button>
        </form>
      </main>
    </div>
  );
}
