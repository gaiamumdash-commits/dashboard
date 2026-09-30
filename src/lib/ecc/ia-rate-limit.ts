import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Rate limit de chamadas reais de IA (Gemini hoje) — corrige o achado da
 * auditoria (handoff canônico, seção 12.6/21): nenhuma chamada de IA tinha
 * limite de taxa. 3 camadas independentes, todas precisam permitir:
 *
 * - por usuário (rajada curta, por minuto) — impede um usuário sozinho de
 *   martelar o botão de transcrição de voz.
 * - por workspace (volume sustentado, por hora) — impede 1 tenant de
 *   consumir sozinho o orçamento de IA do piloto inteiro.
 * - global (teto de custo de todo o SaaS, por hora) — rede de segurança
 *   final, protege o orçamento mesmo se os dois limites acima forem
 *   insuficientes com a base de usuários crescendo.
 *
 * Contagem atômica no Postgres (ver migration 0046, `ia_registrar_tentativa`)
 * — funciona corretamente entre instâncias serverless concorrentes, ao
 * contrário de um contador em memória do processo (que reseta a cada cold
 * start e não é compartilhado entre instâncias).
 *
 * Configurável por variável de ambiente (sem precisar de redeploy de
 * código pra ajustar) — os valores default são conservadores de propósito
 * (o prompt de consolidação pede: "não inventar preço atual de modelo",
 * então os limites aqui são de QUANTIDADE de chamadas, não de custo em
 * R$/USD, que exigiria saber o preço real vigente do provedor).
 */

const LIMITE_POR_USUARIO_MINUTO = Number(process.env.IA_LIMITE_POR_USUARIO_MINUTO ?? 3);
const LIMITE_POR_WORKSPACE_HORA = Number(process.env.IA_LIMITE_POR_WORKSPACE_HORA ?? 20);
const LIMITE_GLOBAL_HORA = Number(process.env.IA_LIMITE_GLOBAL_HORA ?? 200);

export type ResultadoRateLimitIA = { permitido: true } | { permitido: false; motivo: string };

/** Início do minuto corrente, em ISO — exportada só pra ser testada
 * isoladamente (não depende de banco). */
export function inicioDoMinuto(agora: Date = new Date()): string {
  const truncado = new Date(agora);
  truncado.setSeconds(0, 0);
  return truncado.toISOString();
}

/** Início da hora corrente, em ISO — idem. */
export function inicioDaHora(agora: Date = new Date()): string {
  const truncado = new Date(agora);
  truncado.setMinutes(0, 0, 0);
  return truncado.toISOString();
}

/**
 * Verifica (e já REGISTRA, atomicamente) uma tentativa de chamada de IA.
 * Deve ser chamada ANTES de qualquer chamada real ao provedor — nunca
 * depois, senão a "cota" seria consumida sem prevenir nada.
 *
 * Fail-closed de propósito: se a checagem em si falhar (banco indisponível,
 * erro de rede), a chamada é BLOQUEADA, não permitida — o custo de uma
 * tentativa bloqueada é sempre zero (nenhuma chamada ao provedor
 * acontece), então errar pro lado de bloquear nunca gasta dinheiro à toa;
 * o contrário (fail-open) poderia deixar passar uma rajada sem limite
 * justamente quando o sistema de controle está com problema.
 */
export async function verificarRateLimitIA(params: {
  userId: string;
  tenantId: string;
}): Promise<ResultadoRateLimitIA> {
  const service = createServiceClient();
  const agora = new Date();

  const [porUsuario, porWorkspace, global] = await Promise.all([
    service.rpc("ia_registrar_tentativa", {
      p_escopo: "usuario",
      p_chave: params.userId,
      p_janela: inicioDoMinuto(agora),
      p_limite: LIMITE_POR_USUARIO_MINUTO,
    }),
    service.rpc("ia_registrar_tentativa", {
      p_escopo: "workspace",
      p_chave: params.tenantId,
      p_janela: inicioDaHora(agora),
      p_limite: LIMITE_POR_WORKSPACE_HORA,
    }),
    service.rpc("ia_registrar_tentativa", {
      p_escopo: "global",
      p_chave: "global",
      p_janela: inicioDaHora(agora),
      p_limite: LIMITE_GLOBAL_HORA,
    }),
  ]);

  if (porUsuario.error || porWorkspace.error || global.error) {
    console.error("[verificarRateLimitIA] falha ao checar limite — bloqueando por segurança:", {
      erroUsuario: porUsuario.error?.message,
      erroWorkspace: porWorkspace.error?.message,
      erroGlobal: global.error?.message,
    });
    return {
      permitido: false,
      motivo: "Não foi possível verificar o limite de uso da IA agora — tente de novo em instantes.",
    };
  }

  if (!porUsuario.data) {
    return {
      permitido: false,
      motivo: `Muitos pedidos de IA em pouco tempo — espere um minuto e tente de novo (limite: ${LIMITE_POR_USUARIO_MINUTO}/minuto).`,
    };
  }
  if (!porWorkspace.data) {
    return {
      permitido: false,
      motivo: "Seu workspace atingiu o limite de uso de IA nesta hora — tente novamente mais tarde.",
    };
  }
  if (!global.data) {
    return {
      permitido: false,
      motivo: "O Gaiamum atingiu o limite de uso de IA no momento — tente novamente em instantes.",
    };
  }

  return { permitido: true };
}
