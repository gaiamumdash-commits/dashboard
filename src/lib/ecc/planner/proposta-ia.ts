import { z } from "zod";
import { AREAS_PLANNER } from "@/lib/ecc/planner/tipos";

/**
 * Contrato da futura "Planejar com IA" do Planner — SÓ o contrato (Fase M
 * do Planner V1). Nenhuma chamada de modelo existe ainda, e nada aqui grava
 * dado. Fluxo obrigatório quando for implementado:
 *
 *   PEDIDO → ANÁLISE → PROPOSTA → PREVIEW → CONFIRMAÇÃO DO USUÁRIO → ALTERAÇÕES
 *
 * Regras que este módulo já garante pra quem for ligar a IA:
 * - A saída do modelo é tratada como DADO NÃO CONFIÁVEL: passa por
 *   `validarPropostaPlanner` (schema estrito, limites de tamanho e de
 *   quantidade) antes de virar prévia. Campo desconhecido = proposta recusada.
 * - A proposta não carrega `user_id`/`tenant_id`/`id` de nada: quem decide
 *   ONDE gravar é a Server Action, pela sessão (`garantirWorkspace`) e pela
 *   RLS — nunca o modelo. Autorização acontece fora do LLM.
 * - Só CRIA itens novos (hábitos, rotinas, objetivos). Editar/apagar o que a
 *   pessoa já tem fica fora do contrato de propósito.
 * - A gravação só pode acontecer numa Server Action chamada pelo clique de
 *   confirmação na prévia, com os itens que a pessoa manteve marcados — o
 *   mesmo padrão já em produção no planejamento de projetos
 *   (`planejamento-ia.ts` / `PreviaPlanejamento`).
 */

const MAX_ITENS = 15;

const habitoProposto = z
  .object({
    nome: z.string().trim().min(1).max(120),
    area: z.enum(AREAS_PLANNER),
    tipo: z.enum(["habito", "rotina"]),
    dias_semana: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    horario: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
    duracao_minutos: z.number().int().min(1).max(1440).nullable().optional(),
    justificativa: z.string().trim().max(300).optional(),
  })
  .strict();

const objetivoProposto = z
  .object({
    titulo: z.string().trim().min(1).max(200),
    area: z.enum(AREAS_PLANNER),
    prazo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    justificativa: z.string().trim().max(300).optional(),
  })
  .strict();

export const esquemaPropostaPlanner = z
  .object({
    resumo: z.string().trim().max(600),
    habitos: z.array(habitoProposto).max(MAX_ITENS),
    objetivos: z.array(objetivoProposto).max(MAX_ITENS),
  })
  .strict();

export type PropostaPlanner = z.infer<typeof esquemaPropostaPlanner>;

export function validarPropostaPlanner(bruto: unknown): { ok: true; proposta: PropostaPlanner } | { ok: false; erro: string } {
  const resultado = esquemaPropostaPlanner.safeParse(bruto);
  if (!resultado.success) {
    return { ok: false, erro: "A proposta da IA veio num formato inválido. Nada foi alterado." };
  }
  const { proposta } = { proposta: resultado.data };
  if (proposta.habitos.length + proposta.objetivos.length === 0) {
    return { ok: false, erro: "A proposta da IA veio vazia. Nada foi alterado." };
  }
  // Dias repetidos viram um só, em ordem (mesma normalização de `validarHabito`).
  proposta.habitos = proposta.habitos.map((h) => ({ ...h, dias_semana: [...new Set(h.dias_semana)].sort((a, b) => a - b) }));
  return { ok: true, proposta };
}
