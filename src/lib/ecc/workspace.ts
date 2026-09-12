import "server-only";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { buscarConvitePendentePorEmail, vincularUsuarioAoConvite } from "@/lib/ecc/equipe";
import { buscarMembershipAtual } from "@/lib/ecc/membership";

/**
 * Garante que o usuário autenticado tem um workspace (tenant) e retorna o
 * tenant_id dele. Cria o workspace + membership 'owner' no primeiro acesso.
 *
 * A criação delega pro RPC garantir_workspace_pessoal() (security definer,
 * migration 0040) porque não existe policy de INSERT em tenants/memberships
 * para o usuário comum, e porque o RPC serializa chamadas concorrentes do
 * mesmo usuário via advisory lock — 2 requisições quase simultâneas sem
 * membership ainda não criam mais de 1 workspace. auth.uid() é resolvido
 * dentro do RPC, nunca recebido como parâmetro vindo do cliente.
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

  // RPC (não insert direto via service client) de propósito: garantir_workspace_pessoal()
  // usa um advisory lock por usuário pra serializar chamadas concorrentes — sem isso, 2
  // requisições quase simultâneas do mesmo usuário sem membership ainda podiam criar 2
  // workspaces distintos (achado real, ver comentário na migration 0040).
  const supabase = await createClient();
  const nomeWorkspace = user.email ? `Workspace de ${user.email}` : "Meu workspace";

  const { data: tenantId, error: erroRpc } = await supabase.rpc("garantir_workspace_pessoal", {
    p_nome: nomeWorkspace,
  });

  if (erroRpc || !tenantId) {
    throw new Error(`Falha ao criar workspace: ${erroRpc?.message}`);
  }

  return tenantId as string;
}
