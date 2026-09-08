import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { listarAgendaUnificada } from "@/lib/ecc/agenda";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { PainelAgenda } from "@/components/agenda/painel-agenda";

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const tenantId = await garantirWorkspace();

  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  const [papelAtual, totalMetasSmart] = await Promise.all([
    obterPapelAtual(tenantId),
    contarMetasSmart(tenantId),
  ]);
  const souOwner = papelAtual === "owner";
  const { google, itens } = await listarAgendaUnificada(tenantId, souOwner);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)} souOwner={souOwner} />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-semibold text-gaiamum-text">Agenda</h1>
        <p className="mt-1 text-gaiamum-text-muted">
          Contas a pagar, tarefas com prazo e seus eventos do Google, num só lugar.
        </p>

        <div className="mt-8">
          <PainelAgenda google={google} itens={itens} erro={erro} />
        </div>
      </main>
    </div>
  );
}
