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
 * Cada `ia_registrar_tentativa` (migration 0046) É atômica individualmente
 * (upsert com lock de linha, funciona corretamente entre instâncias
 * serverless concorrentes) — mas a VERIFICAÇÃO CONJUNTA das 3 camadas não é
 * transacional: não existe uma transação única que reverta as 3 se uma
 * bloquear. É por isso que a ordem de checagem importa (ver comentário em
 * `verificarRateLimitIA` abaixo).
 *
 * IMPORTANTE sobre o que este rate limit garante e o que NÃO garante
 * (achado da revisão do P0, 2026-09-30): os limites são contadores POR
 * MINUTO (usuário) e POR HORA (workspace/global) — eles controlam
 * FREQUÊNCIA (rajada), não um orçamento diário/mensal. Nada aqui impede que
 * um workspace fique consumindo, por exemplo, 20 chamadas/hora 24h por dia
 * — isso é ~480 chamadas/dia, sem teto diário algum. Um teto de orçamento
 * diário/mensal real exigiria uma 4ª camada (janela de 24h/mês) e decisão
 * de produto sobre o que fazer quando o mês acaba (resetar? bloquear até o
 * próximo ciclo?) — fora do escopo desta rodada, ver Backlog.
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
 *
 * SEQUENCIAL, não paralelo — achado real da revisão do P0 (2026-09-30):
 * a 1ª versão disparava as 3 RPCs com `Promise.all`, ou seja, TODAS
 * incrementavam o contador antes de qualquer uma delas ser checada. Isso
 * permitia que um único usuário martelando o botão (sempre bloqueado no
 * limite por minuto dele) ainda consumisse, a cada tentativa rejeitada, 1
 * unidade da cota de WORKSPACE e 1 da cota GLOBAL — cotas compartilhadas
 * com todos os outros usuários/tenants. Em volume suficiente (a cada
 * minuto ele pode tentar de novo, já que a janela de usuário reseta), isso
 * esgotava a cota de workspace/global sem nenhuma chamada real de IA
 * acontecer, derrubando o serviço pra gente legítima. Checar em ORDEM de
 * granularidade crescente (usuário → workspace → global), parando no
 * primeiro bloqueio ou erro, resolve isso: uma tentativa só chega a
 * consumir cota de workspace/global depois de já ter passado pelo limite
 * (mais restrito) do próprio usuário que a fez.
 *
 * Efeito colateral aceito, documentado: se o usuário passa no limite dele
 * mas o WORKSPACE bloqueia, a tentativa dele já consumiu 1 unidade da
 * cota de USUÁRIO mesmo sem chamada real de IA ter acontecido — isso é
 * esperado (é a cota dele mesmo sendo gasta pela ação dele mesmo, não uma
 * cota compartilhada com terceiros) e não representa esgotamento cruzado.
 *
 * Falha parcial: se uma camada retorna erro, a checagem para ali (fail-
 * closed) e as camadas seguintes (mais amplas) NUNCA são chamadas — não
 * tenta "continuar mesmo assim". As camadas anteriores (mais restritas),
 * se já tinham sido chamadas com sucesso, já registraram a tentativa
 * normalmente (não há rollback — cada RPC é atômica isoladamente, mas o
 * conjunto não é uma transação).
 */
export async function verificarRateLimitIA(params: {
  userId: string;
  tenantId: string;
}): Promise<ResultadoRateLimitIA> {
  const service = createServiceClient();
  const agora = new Date();

  const camadas = [
    {
      escopo: "usuario",
      chave: params.userId,
      janela: inicioDoMinuto(agora),
      limite: LIMITE_POR_USUARIO_MINUTO,
      motivoBloqueio: `Muitos pedidos de IA em pouco tempo — espere um minuto e tente de novo (limite: ${LIMITE_POR_USUARIO_MINUTO}/minuto).`,
    },
    {
      escopo: "workspace",
      chave: params.tenantId,
      janela: inicioDaHora(agora),
      limite: LIMITE_POR_WORKSPACE_HORA,
      motivoBloqueio: "Seu workspace atingiu o limite de uso de IA nesta hora — tente novamente mais tarde.",
    },
    {
      escopo: "global",
      chave: "global",
      janela: inicioDaHora(agora),
      limite: LIMITE_GLOBAL_HORA,
      motivoBloqueio: "O Gaiamum atingiu o limite de uso de IA no momento — tente novamente em instantes.",
    },
  ] as const;

  for (const camada of camadas) {
    const { data, error } = await service.rpc("ia_registrar_tentativa", {
      p_escopo: camada.escopo,
      p_chave: camada.chave,
      p_janela: camada.janela,
      p_limite: camada.limite,
    });

    if (error) {
      console.error(`[verificarRateLimitIA] falha ao checar limite (${camada.escopo}) — bloqueando por segurança:`, {
        erro: error.message,
      });
      return {
        permitido: false,
        motivo: "Não foi possível verificar o limite de uso da IA agora — tente de novo em instantes.",
      };
    }

    if (!data) {
      return { permitido: false, motivo: camada.motivoBloqueio };
    }
  }

  return { permitido: true };
}
