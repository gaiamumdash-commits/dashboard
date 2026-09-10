import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/** Grava cada chamada real a um provedor de IA (sucesso ou falha), com
 * tokens usados quando o provedor expõe isso — alimenta o painel de
 * analítica restrito ao dono do SaaS. Nunca deve quebrar o fluxo principal
 * de quem chama: quem usa esta função sempre envolve a chamada num
 * try/catch próprio e ignora falha de log. */
export async function registrarConsumoIA(params: {
  tenantId: string | null;
  userId: string | null;
  projetoId: string | null;
  provedor: string;
  modelo: string;
  sucesso: boolean;
  erro?: string | null;
  promptTokens?: number | null;
  candidatesTokens?: number | null;
  totalTokens?: number | null;
}): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("ia_consumo_log").insert({
    tenant_id: params.tenantId,
    user_id: params.userId,
    projeto_id: params.projetoId,
    provedor: params.provedor,
    modelo: params.modelo,
    sucesso: params.sucesso,
    erro: params.erro ?? null,
    prompt_tokens: params.promptTokens ?? null,
    candidates_tokens: params.candidatesTokens ?? null,
    total_tokens: params.totalTokens ?? null,
  });

  if (error) {
    throw new Error(`Falha ao registrar consumo de IA: ${error.message}`);
  }
}
