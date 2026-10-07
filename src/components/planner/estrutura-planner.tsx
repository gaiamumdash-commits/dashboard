import type { ReactNode } from "react";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { CabecalhoPlanner } from "@/components/planner/cabecalho-planner";
import type { AreaPlanner } from "@/lib/ecc/planner/tipos";

/** Casca comum das telas do Planner: menu lateral do app + cabeçalho do
 * Planner. Largura maior que as páginas de leitura (o mockup é um painel de
 * 3 colunas), mesmo critério já usado no Kanban. */
export function EstruturaPlanner({
  area,
  temMetasSmart,
  acessoCompleto,
  souOwner,
  children,
}: {
  area: AreaPlanner | null;
  temMetasSmart: boolean;
  acessoCompleto: boolean;
  souOwner: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={temMetasSmart} acessoCompleto={acessoCompleto} souOwner={souOwner} />
      <main className="mx-auto flex w-full min-w-0 max-w-[96rem] flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <CabecalhoPlanner area={area} />
        {children}
      </main>
    </div>
  );
}
