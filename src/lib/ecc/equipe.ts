import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Convite, EscopoMembership, MembroTenant, Papel } from "@/lib/ecc/tipos";

export async function listarMembros(tenantId: string): Promise<MembroTenant[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("membros_do_tenant", { t_id: tenantId });
  return (data as MembroTenant[]) ?? [];
}

export async function listarConvitesPendentes(tenantId: string): Promise<Convite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("convites")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "pendente")
    .order("criado_em", { ascending: false });

  return (data as Convite[]) ?? [];
}

async function obterMembershipAtual(
  tenantId: string,
): Promise<{ papel: Papel; escopo: EscopoMembership } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("memberships")
    .select("papel, escopo")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as { papel: Papel; escopo: EscopoMembership } | null) ?? null;
}

export async function obterPapelAtual(tenantId: string): Promise<Papel | null> {
  const membership = await obterMembershipAtual(tenantId);
  return membership?.papel ?? null;
}

/** false pra quem entrou convidado só pra um projeto — não vê Metas SMART
 * nem a página de Equipe do workspace inteiro, só o(s) quadro(s) dele. */
export async function temAcessoCompleto(tenantId: string): Promise<boolean> {
  const membership = await obterMembershipAtual(tenantId);
  return membership?.escopo !== "projeto";
}
