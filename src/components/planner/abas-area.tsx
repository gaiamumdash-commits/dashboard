import Link from "next/link";
import type { AreaPlanner } from "@/lib/ecc/planner/tipos";

export type AbaArea = { id: string; rotulo: string };

/** Sub-abas de cada área (pedido: Pessoal → Visão geral, Rotina, Hábitos,
 * Objetivos, Notas; Estudos → ... Idiomas; Casa → ... Manutenções; Saúde →
 * ... Bem-estar). Na URL como `?aba=` — uma página por área, com o estado
 * no endereço (dá pra voltar/compartilhar o link da aba). */
export const ABAS_POR_AREA: Record<AreaPlanner, AbaArea[]> = {
  pessoal: [
    { id: "visao", rotulo: "Visão geral" },
    { id: "rotina", rotulo: "Rotina" },
    { id: "habitos", rotulo: "Hábitos" },
    { id: "objetivos", rotulo: "Objetivos" },
    { id: "notas", rotulo: "Notas" },
  ],
  estudos: [
    { id: "visao", rotulo: "Visão geral" },
    { id: "metas", rotulo: "Metas" },
    { id: "rotina", rotulo: "Rotina de estudos" },
    { id: "leituras", rotulo: "Leituras" },
    { id: "cursos", rotulo: "Cursos" },
    { id: "idiomas", rotulo: "Idiomas" },
  ],
  casa: [
    { id: "visao", rotulo: "Visão geral" },
    { id: "rotinas", rotulo: "Rotinas" },
    { id: "compras", rotulo: "Compras" },
    { id: "cardapio", rotulo: "Cardápio" },
    { id: "pets", rotulo: "Pets" },
    { id: "manutencoes", rotulo: "Manutenções" },
  ],
  saude: [
    { id: "visao", rotulo: "Visão geral" },
    { id: "rotina", rotulo: "Rotina" },
    { id: "consultas", rotulo: "Consultas" },
    { id: "habitos", rotulo: "Hábitos" },
    { id: "bem-estar", rotulo: "Bem-estar" },
  ],
};

export function abaValida(area: AreaPlanner, aba: string | undefined): string {
  return ABAS_POR_AREA[area].some((a) => a.id === aba) ? (aba as string) : "visao";
}

export function AbasArea({ area, ativa }: { area: AreaPlanner; ativa: string }) {
  return (
    <nav aria-label="Seções da área" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1.5">
        {ABAS_POR_AREA[area].map((aba) => {
          const selecionada = aba.id === ativa;
          return (
            <li key={aba.id}>
              <Link
                href={aba.id === "visao" ? `/planner/${area}` : `/planner/${area}?aba=${aba.id}`}
                aria-current={selecionada ? "page" : undefined}
                className={`block rounded-full px-3.5 py-1.5 text-sm transition ${
                  selecionada
                    ? "bg-gaiamum-primary text-white"
                    : "border border-gaiamum-border text-gaiamum-text-muted hover:bg-gaiamum-surface-raised hover:text-gaiamum-text"
                }`}
              >
                {aba.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
