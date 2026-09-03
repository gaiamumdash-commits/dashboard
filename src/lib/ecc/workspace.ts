import "server-only";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buscarConvitePendentePorEmail, vincularUsuarioAoConvite } from "@/lib/ecc/equipe";
import { buscarMembershipAtual } from "@/lib/ecc/membership";

/**
 * Garante que o usuário autenticado tem um workspace (tenant) e retorna o
 * tenant_id dele. Cria o workspace + membership 'owner' no primeiro acesso.
 *
 * A criação usa o service client porque não existe policy de INSERT em
 * tenants/memberships para o usuário comum: o bootstrap do primeiro
 * workspace é a única operação privilegiada deste módulo, e o user_id vem
 * sempre de auth.getUser() (nunca de input do cliente).
 */
export async function garantirWorkspace(): Promise<string> {
  const user = await obterUsuarioAtual();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const membershipExistente = await buscarMembershipAtual();

  if (membershipExistente) {
    return membershipExistente.tenantId;
  }

  // Antes de criar um workspace pessoal, honra um convite pendente pro
  // e-mail do usuário — sem isso, quem visita qualquer página que chama
  // garantirWorkspace() antes de clicar no link do convite (ex.: o
  // redirect automático de "/" pra "/onboarding") ganha um workspace
  // pessoal vazio à toa, e fica com duas memberships sem critério
  // determinístico de qual é a "certa".
  if (user.email) {
    const convitePendente = await buscarConvitePendentePorEmail(user.email);
    if (convitePendente) {
      return vincularUsuarioAoConvite(convitePendente, user.id);
    }
  }

  const service = createServiceClient();
  const nomeWorkspace = user.email ? `Workspace de ${user.email}` : "Meu workspace";

  const { data: tenant, error: erroTenant } = await service
    .from("tenants")
    .insert({ nome: nomeWorkspace })
    .select("id")
    .single();

  if (erroTenant || !tenant) {
    throw new Error(`Falha ao criar workspace: ${erroTenant?.message}`);
  }

  const { error: erroMembership } = await service
    .from("memberships")
    .insert({ user_id: user.id, tenant_id: tenant.id, papel: "owner" });

  if (erroMembership) {
    throw new Error(`Falha ao vincular usuário ao workspace: ${erroMembership.message}`);
  }

  return tenant.id as string;
}
