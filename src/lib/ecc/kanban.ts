import type { Tarefa } from "@/lib/ecc/tipos";

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
