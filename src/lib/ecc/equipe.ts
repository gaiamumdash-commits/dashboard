import "server-only";
import { cache } from "react";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

// obterPapelAtual() e temAcessoCompleto() são chamadas juntas em quase toda
// página (geralmente dentro do mesmo Promise.all) e cada uma precisava da
// mesma linha de membership — cache() por request evita rodar a query 2x.
const obterMembershipAtual = cache(
  async (tenantId: string): Promise<{ papel: Papel; escopo: EscopoMembership } | null> => {
    const supabase = await createClient();
    const user = await obterUsuarioAtual();
    if (!user) return null;

    const { data } = await supabase
      .from("memberships")
      .select("papel, escopo")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    return (data as { papel: Papel; escopo: EscopoMembership } | null) ?? null;
  },
);

export async function obterPapelAtual(tenantId: string): Promise<Papel | null> {
  const membership = await obterMembershipAtual(tenantId);
  return membership?.papel ?? null;
}

export async function eSouGestorDoProjeto(projetoId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projeto_membros")
    .select("id")
    .eq("projeto_id", projetoId)
    .eq("user_id", userId)
    .eq("papel", "gestor")
    .maybeSingle();

  return Boolean(data);
}

/** false pra quem entrou convidado só pra um projeto — não vê Metas SMART
 * nem a página de Equipe do workspace inteiro, só o(s) quadro(s) dele. */
export async function temAcessoCompleto(tenantId: string): Promise<boolean> {
  const membership = await obterMembershipAtual(tenantId);
  return membership?.escopo !== "projeto";
}

/** Quem enxerga um projeto específico: owner do tenant, membros com acesso
 * completo ao workspace, e quem foi colocado explicitamente em
 * `projeto_membros`. Mesma regra usada em "Configurações do quadro" e na
 * consolidação (Freeze) — centralizado aqui pra não duplicar a lógica. */
export async function listarMembrosComAcessoAoProjeto(
  tenantId: string,
  projetoId: string,
): Promise<MembroTenant[]> {
  const supabase = await createClient();

  const [membrosDoTenant, { data: projetoMembros }, { data: memberships }] = await Promise.all([
    listarMembros(tenantId),
    supabase.from("projeto_membros").select("user_id").eq("projeto_id", projetoId),
    supabase.from("memberships").select("user_id, escopo").eq("tenant_id", tenantId),
  ]);

  const idsEscopoCompleto = new Set(
    (memberships ?? []).filter((m) => m.escopo === "completo").map((m) => m.user_id as string),
  );
  const idsProjetoMembros = new Set((projetoMembros ?? []).map((m) => m.user_id as string));

  return membrosDoTenant.filter(
    (m) => m.papel === "owner" || idsEscopoCompleto.has(m.user_id) || idsProjetoMembros.has(m.user_id),
  );
}

/** Busca um convite pendente e não expirado pro e-mail do usuário, em
 * qualquer tenant (usa service client — RLS de `convites` só libera pra
 * quem já é membro do tenant, e quem ainda não aceitou não é). */
export async function buscarConvitePendentePorEmail(email: string): Promise<Convite | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("convites")
    .select("*")
    .eq("email", email.toLowerCase())
    .eq("status", "pendente")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || new Date(data.expira_em) < new Date()) {
    return null;
  }

  return data as Convite;
}

/** Vincula o usuário ao tenant do convite (membership + projeto_membros se
 * for convite de quadro específico) e marca o convite como aceito.
 * Compartilhado entre a aceitação explícita em `/convite/[token]` e o
 * bootstrap automático de workspace, pra quem já tem convite pendente
 * nunca ganhar um workspace pessoal à toa. */
export async function vincularUsuarioAoConvite(convite: Convite, userId: string): Promise<string> {
  const service = createServiceClient();

  // Convite de projeto sempre entra como "member" do tenant, com escopo
  // "projeto" — não enxerga Metas SMART nem Equipe do workspace inteiro,
  // só o(s) quadro(s) em que foi colocado via projeto_membros.
  const papelTenant = convite.projeto_id ? "member" : convite.papel;
  const escopo = convite.projeto_id ? "projeto" : "completo";

  const { error: erroMembership } = await service
    .from("memberships")
    .insert({ user_id: userId, tenant_id: convite.tenant_id, papel: papelTenant, escopo });

  if (erroMembership && erroMembership.code !== "23505") {
    throw new Error(`Falha ao entrar no workspace: ${erroMembership.message}`);
  }

  if (convite.projeto_id) {
    const { error: erroProjetoMembro } = await service.from("projeto_membros").insert({
      tenant_id: convite.tenant_id,
      projeto_id: convite.projeto_id,
      user_id: userId,
      papel: "usuario",
    });

    if (erroProjetoMembro && erroProjetoMembro.code !== "23505") {
      throw new Error(`Falha ao entrar no quadro: ${erroProjetoMembro.message}`);
    }
  }

  await service.from("convites").update({ status: "aceito" }).eq("id", convite.id);

  return convite.tenant_id;
}
