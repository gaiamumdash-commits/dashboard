import "server-only";
import { cache } from "react";
import { listarCompromissosDoDia } from "@/lib/ecc/agenda";

/** `listarCompromissosDoDia` deduplicada por requisição (`React.cache`) — a
 * página do Kanban usa os compromissos de hoje em 2 lugares (coluna
 * "Compromissos do dia" e o item "Próximo compromisso" da faixa do dia,
 * redesenho de 2026-10-05), e cada chamada vai ao Google Calendar. Com o
 * cache, a mesma requisição faz 1 chamada só. Não muda nada na Agenda em si. */
export const listarCompromissosDoDiaNaRequisicao = cache(listarCompromissosDoDia);
