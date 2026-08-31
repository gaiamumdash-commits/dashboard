import type { CorEtiqueta, Tarefa } from "@/lib/ecc/tipos";

export const CLASSE_COR_ETIQUETA: Record<CorEtiqueta, string> = {
  purple: "border-gaiamum-tag-purple/40 bg-gaiamum-tag-purple/15 text-gaiamum-tag-purple",
  teal: "border-gaiamum-tag-teal/40 bg-gaiamum-tag-teal/15 text-gaiamum-tag-teal",
  yellow: "border-gaiamum-tag-yellow/40 bg-gaiamum-tag-yellow/15 text-gaiamum-tag-yellow",
  blue: "border-gaiamum-tag-blue/40 bg-gaiamum-tag-blue/15 text-gaiamum-tag-blue",
  coral: "border-gaiamum-tag-coral/40 bg-gaiamum-tag-coral/15 text-gaiamum-tag-coral",
  lime: "border-gaiamum-tag-lime/40 bg-gaiamum-tag-lime/15 text-gaiamum-tag-lime",
};

/** Versão sólida (sem opacidade) das mesmas 6 cores — pra faixa/banner do
 * quadro (cor de fundo do projeto), diferente do chip translúcido acima. */
export const CLASSE_FUNDO_QUADRO: Record<CorEtiqueta, string> = {
  purple: "bg-gaiamum-tag-purple",
  teal: "bg-gaiamum-tag-teal",
  yellow: "bg-gaiamum-tag-yellow",
  blue: "bg-gaiamum-tag-blue",
  coral: "bg-gaiamum-tag-coral",
  lime: "bg-gaiamum-tag-lime",
};

export type UrgenciaPrazo = "atrasado" | "proximo" | "ok" | "sem_prazo";

const DIAS_PARA_ALERTA_AMARELO = 2;

/** Amarelo faltando até 48h (2 dias), vermelho no dia do prazo ou depois.
 * `colunaConcluida` vem da coluna atual da tarefa (`ColunaKanban.concluido`),
 * não de um status fixo — uma vez que colunas são configuráveis por projeto. */
export function urgenciaDoPrazo(
  tarefa: Pick<Tarefa, "data_limite">,
  colunaConcluida: boolean,
): UrgenciaPrazo {
  if (colunaConcluida || !tarefa.data_limite) {
    return tarefa.data_limite ? "ok" : "sem_prazo";
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limite = new Date(`${tarefa.data_limite}T00:00:00`);
  const diasRestantes = Math.round((limite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  if (diasRestantes <= 0) return "atrasado";
  if (diasRestantes <= DIAS_PARA_ALERTA_AMARELO) return "proximo";
  return "ok";
}
