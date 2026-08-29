import type { StatusTarefa, Tarefa } from "@/lib/ecc/tipos";

export const COLUNAS: { status: StatusTarefa; titulo: string }[] = [
  { status: "backlog", titulo: "A Fazer / Backlog" },
  { status: "em_execucao", titulo: "Em Execução" },
  { status: "concluido", titulo: "Concluído" },
];

export type UrgenciaPrazo = "atrasado" | "proximo" | "ok" | "sem_prazo";

const DIAS_PARA_ALERTA_AMARELO = 2;

/** Amarelo quando o prazo está a até 2 dias, vermelho quando já passou. */
export function urgenciaDoPrazo(tarefa: Pick<Tarefa, "data_limite" | "status">): UrgenciaPrazo {
  if (tarefa.status === "concluido" || !tarefa.data_limite) {
    return tarefa.data_limite ? "ok" : "sem_prazo";
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limite = new Date(`${tarefa.data_limite}T00:00:00`);
  const diasRestantes = Math.round((limite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) return "atrasado";
  if (diasRestantes <= DIAS_PARA_ALERTA_AMARELO) return "proximo";
  return "ok";
}
