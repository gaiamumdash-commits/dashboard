import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import type { EscopoMembership, Papel } from "@/lib/ecc/tipos";

const HEADER_MEMBERSHIP = "x-gaiamum-membership";

export type MembershipAtual = {
  tenantId: string;
  papel: Papel;
  escopo: EscopoMembership;
};

function membershipValida(valor: unknown): valor is MembershipAtual {
  return (
    typeof valor === "object" &&
    valor !== null &&
    typeof (valor as MembershipAtual).tenantId === "string" &&
    typeof (valor as MembershipAtual).papel === "string" &&
    typeof (valor as MembershipAtual).escopo === "string"
  );
}

/**
 * Busca a membership "principal" do usuário logado — a mais antiga
 * (criado_em asc), mesmo critério que garantirWorkspace() sempre usou.
 *
 * O proxy.ts (src/lib/supabase/middleware.ts) já resolveu isso antes da
 * página renderizar — com cache de 5min num cookie (`gaiamum-membership`,
 * ver comentário lá pro raciocínio de segurança/trade-off) — e deixou o
 * resultado no header x-gaiamum-membership. Ler esse header aqui evita
 * pagar de novo o round-trip ao Supabase que o middleware já pagou (ou já
 * tinha em cache). Fallback pro query real cobre header ausente/malformado
 * ou qualquer requisição que não passou pelo proxy — nunca confia
 * cegamente na ausência do header, mesmo padrão de obterUsuarioAtual().
 *
 * cache() do React memoiza por request: garantirWorkspace(), obterPapelAtual()
 * e temAcessoCompleto() chamando isso na mesma renderização viram 1 acesso
 * só (nem chega a reler o header 2x). Retorna null tanto pra "sem usuário
 * logado" quanto pra "ainda sem nenhuma membership" — nesse segundo caso o
 * resultado nunca é atualizado depois no mesmo request, mesmo que
 * garantirWorkspace() crie uma membership em seguida (cache() não tem
 * invalidação manual). Por isso quem pede um tenantId específico
 * (equipe.ts) precisa comparar antes de confiar no resultado.
 */
export const buscarMembershipAtual = cache(async (): Promise<MembershipAtual | null> => {
  const user = await obterUsuarioAtual();
  if (!user) return null;

  const cabecalhos = await headers();
  const bruto = cabecalhos.get(HEADER_MEMBERSHIP);
  if (bruto) {
    try {
      const parseado = JSON.parse(bruto);
      if (membershipValida(parseado)) return parseado;
    } catch {
      // header malformado — cai pro fallback abaixo
    }
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("tenant_id, papel, escopo")
    .eq("user_id", user.id)
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    tenantId: data.tenant_id as string,
    papel: data.papel as Papel,
    escopo: data.escopo as EscopoMembership,
  };
});
