"use server";

import { garantirWorkspace } from "@/lib/ecc/workspace";
import { listarCompromissosDoDia, type ResultadoCompromissosDoDia } from "@/lib/ecc/agenda";
import { listarContasDoDia } from "@/lib/ecc/financeiro";
import { chaveDiaAtual, diaSeguinte } from "@/lib/ecc/semana";
import type { ContaAPagar } from "@/lib/ecc/tipos";

const CHAVE_DIA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
/** Quantos dias à frente a coluna "Compromissos do dia" deixa espiar —
 * pedido do Fabio (2026-10-04): "o dia posterior", pra planejar hoje com
 * base no que vem amanhã. De propósito 1 só (não um calendário livre): a
 * coluna é pra planejamento rápido do dia corrente, não um substituto da
 * Agenda completa (que já tem navegação livre por semana/dia). */
const LIMITE_DIAS_A_FRENTE = 1;

export type ResultadoAgendaDoDiaKanban = {
  chave: string;
  resultado: ResultadoCompromissosDoDia;
  contas: ContaAPagar[];
};

/** Busca compromissos + contas de um dia específico pra coluna fixa do
 * Kanban — chamada pelo botão "‹ Hoje · Amanhã ›" no rodapé dela
 * (`coluna-compromissos-do-dia.tsx`). `tenantId` NUNCA vem do cliente:
 * resolvido aqui via `garantirWorkspace()`, mesmo padrão de toda Server
 * Action do projeto — evita que alguém chame isto direto (contornando a
 * interface) passando o tenant de outra pessoa. `chaveDia` é validada e
 * limitada a HOJE..HOJE+1 — fora disso, cai em hoje (nunca quebra, só
 * ignora o valor fora do intervalo permitido). */
export async function buscarAgendaDoDiaKanban(chaveDia?: string): Promise<ResultadoAgendaDoDiaKanban> {
  const tenantId = await garantirWorkspace();

  const hoje = chaveDiaAtual();
  const amanha = diaSeguinte(hoje);
  const chavesPermitidas = new Set([hoje, amanha].slice(0, LIMITE_DIAS_A_FRENTE + 1));
  const chave = chaveDia && CHAVE_DIA_VALIDA.test(chaveDia) && chavesPermitidas.has(chaveDia) ? chaveDia : hoje;

  const [resultado, contas] = await Promise.all([
    listarCompromissosDoDia(tenantId, chave),
    listarContasDoDia(tenantId, chave),
  ]);

  return { chave, resultado, contas };
}
