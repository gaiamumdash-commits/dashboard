import type { AreaPlanner } from "@/lib/ecc/planner/tipos";

/** Cor de cada área, sempre de tokens que já existem (`globals.css`) — o
 * mockup usa verde/azul/laranja/rosa; aqui viram success/tag-blue/warning/
 * tag-coral, que acompanham os 3 temas do Gaiamum. */
export const COR_AREA: Record<AreaPlanner, { texto: string; fundoIcone: string; fundoCard: string; borda: string }> = {
  pessoal: {
    texto: "text-gaiamum-success",
    fundoIcone: "bg-gaiamum-success/15",
    fundoCard: "bg-gradient-to-br from-gaiamum-success/10 to-gaiamum-surface",
    borda: "hover:border-gaiamum-success/60",
  },
  estudos: {
    texto: "text-gaiamum-tag-blue",
    fundoIcone: "bg-gaiamum-tag-blue/15",
    fundoCard: "bg-gradient-to-br from-gaiamum-tag-blue/10 to-gaiamum-surface",
    borda: "hover:border-gaiamum-tag-blue/60",
  },
  casa: {
    texto: "text-gaiamum-warning",
    fundoIcone: "bg-gaiamum-warning/15",
    fundoCard: "bg-gradient-to-br from-gaiamum-warning/10 to-gaiamum-surface",
    borda: "hover:border-gaiamum-warning/60",
  },
  saude: {
    texto: "text-gaiamum-tag-coral",
    fundoIcone: "bg-gaiamum-tag-coral/15",
    fundoCard: "bg-gradient-to-br from-gaiamum-tag-coral/10 to-gaiamum-surface",
    borda: "hover:border-gaiamum-tag-coral/60",
  },
};
