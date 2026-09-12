import Link from "next/link";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, temAcessoCompleto } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { garantirTenantLab } from "@/lib/ecc/lab/tenant";
import { semearCafeMangue } from "@/lib/ecc/lab/seed-cafe-mangue";
import { listarAgendaUnificadaLab } from "@/lib/ecc/lab/agenda";
import { limitesDaSemana } from "@/lib/ecc/semana";
import { passosConcluidos, MODULO_AGENDA } from "@/lib/ecc/lab/progresso";
import { MISSOES_AGENDA_CAFE_MANGUE, PORQUE_AGENDA_CAFE_MANGUE } from "@/lib/ecc/lab/conteudo-cafe-mangue";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ListaMissoesEtapaLab } from "@/components/lab/lista-missoes-etapa-lab";
import { PorQueIssoExiste } from "@/components/lab/por-que-isso-existe";
import { PainelAgendaLab } from "@/components/lab/painel-agenda-lab";

export default async function PaginaAgendaLab({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const { semana } = await searchParams;
  const tenantId = await garantirWorkspace();
  if (!(await temAcessoCompleto(tenantId))) {
    redirect("/projetos");
  }

  const user = await obterUsuarioAtual();
  if (!user) {
    redirect("/auth");
  }

  const [totalMetasSmart, papelAtual, tenantIdLab] = await Promise.all([
    contarMetasSmart(tenantId),
    obterPapelAtual(tenantId),
    garantirTenantLab(),
  ]);

  await semearCafeMangue(tenantIdLab, user.id);

  const { chave: chaveSemana, inicio, fimExclusivo } = limitesDaSemana(semana);
  const [{ itens }, passosAgenda] = await Promise.all([
    listarAgendaUnificadaLab(tenantIdLab, inicio, fimExclusivo),
    passosConcluidos(user.id, MODULO_AGENDA),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart)} souOwner={papelAtual === "owner"} />
      <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <div>
          <Link href="/lab/visao-360" className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
            ← Visão 360°
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-gaiamum-text">Agenda — Café do Mangue</h1>
          <p className="mt-2 text-gaiamum-text-muted">
            Contas a pagar, tarefas com prazo, decisões e compromissos manuais ou por voz, num só lugar.
          </p>
        </div>

        <PorQueIssoExiste texto={PORQUE_AGENDA_CAFE_MANGUE} />

        <ListaMissoesEtapaLab missoes={MISSOES_AGENDA_CAFE_MANGUE} passosConcluidos={passosAgenda} />

        <PainelAgendaLab itens={itens} chaveSemana={chaveSemana} tenantIdLab={tenantIdLab} />
      </main>
    </div>
  );
}
