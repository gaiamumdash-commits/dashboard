import "server-only";
import { cache } from "react";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import type { EscopoMembership, Papel } from "@/lib/ecc/tipos";

export type MembershipAtual = {
  tenantId: string;
  papel: Papel;
  escopo: EscopoMembership;
};

/**
 * Busca a membership "principal" do usuário logado — a mais antiga
 * (criado_em asc), mesmo critério que garantirWorkspace() sempre usou —
 * numa query só (tenant_id + papel + escopo juntos).
 *
 * cache() do React memoiza por request: garantirWorkspace(), obterPapelAtual()
 * e temAcessoCompleto() chamando isso na mesma renderização viram 1 round-trip
 * só. Retorna null tanto pra "sem usuário logado" quanto pra "ainda sem
 * nenhuma membership" — nesse segundo caso o resultado nunca é atualizado
 * depois no mesmo request, mesmo que garantirWorkspace() crie uma membership
 * em seguida (cache() não tem invalidação manual). Por isso quem pede um
 * tenantId específico (equipe.ts) precisa comparar antes de confiar no
 * resultado.
 */
export const buscarMembershipAtual = cache(async (): Promise<MembershipAtual | null> => {
  const supabase = await createClient();
  const user = await obterUsuarioAtual();
  if (!user) return null;

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
