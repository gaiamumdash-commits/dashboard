import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { listarAgendaUnificada } from "@/lib/ecc/agenda";
import { limitesDaSemana, limitesDoDia, chaveDiaAtual } from "@/lib/ecc/semana";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { PainelAgenda } from "@/components/agenda/painel-agenda";

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; semana?: string; dia?: string; visao?: string }>;
}) {
  const { erro, semana, dia, visao } = await searchParams;
  const tenantId = await garantirWorkspace();

  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  const [papelAtual, totalMetasSmart] = await Promise.all([
    obterPapelAtual(tenantId),
    contarMetasSmart(tenantId),
  ]);
  const souOwner = papelAtual === "owner";
  const visaoAtiva = visao === "dia" ? "dia" : "semana";

  // Só calcula os limites (datas, sem query) da visão ativa pra buscar os
  // itens — a outra visão só precisa da "chave" (pra navegação/abas), que
  // sai de graça de limitesDaSemana/limitesDoDia mesmo sem usar o range.
  const { chave: chaveSemana, inicio: inicioSemana, fimExclusivo: fimSemana } = limitesDaSemana(semana);
  const { chave: chaveDia, inicio: inicioDia, fimExclusivo: fimDia } = limitesDoDia(dia ?? chaveDiaAtual());

  const { inicio, fimExclusivo } =
    visaoAtiva === "dia" ? { inicio: inicioDia, fimExclusivo: fimDia } : { inicio: inicioSemana, fimExclusivo: fimSemana };

  const { google, itens } = await listarAgendaUnificada(tenantId, souOwner, inicio, fimExclusivo);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)} souOwner={souOwner} />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-semibold text-gaiamum-text">Agenda</h1>
        <p className="mt-1 text-gaiamum-text-muted">
          Contas a pagar, tarefas com prazo, decisões e seus eventos do Google, num só lugar.
        </p>

        <div className="mt-8">
          <PainelAgenda
            google={google}
            itens={itens}
            erro={erro}
            chaveSemana={chaveSemana}
            chaveDia={chaveDia}
            visaoAtiva={visaoAtiva}
          />
        </div>
      </main>
    </div>
  );
}
