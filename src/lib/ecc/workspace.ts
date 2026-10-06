import "server-only";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buscarConvitePendentePorEmail, vincularUsuarioAoConvite } from "@/lib/ecc/equipe";
import { buscarMembershipAtual } from "@/lib/ecc/membership";
import { emailAutorizadoNoBeta, modoCadastroFechado, registrarUsoDoAcessoBeta } from "@/lib/ecc/acesso-beta";

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
 *
 * Achado real (2026-10-02): a maioria das páginas do app chama isto como
 * 1ª coisa, sem checar `obterUsuarioAtual()` antes — ANTES desta correção,
 * isso lançava um erro genérico (tela de "Runtime Error" feia) em vez de
 * mandar pro login quando a sessão expira/não existe. Só a home (`/`) e as
 * páginas do Lab tinham um guard explícito próprio, mas essas rodavam
 * DEPOIS de `garantirWorkspace()` na ordem do código — ou seja, o guard
 * delas nunca era alcançado na prática, o erro genérico sempre disparava
 * primeiro. `redirect()` aqui dentro corrige TODAS as páginas de uma vez
 * (e também as Server Actions que chamam `garantirWorkspace()`: sessão
 * expirada no meio de uma ação agora manda pro login em vez de um toast de
 * erro genérico) — sem precisar adicionar o mesmo guard em cada uma.
 */
export async function garantirWorkspace(): Promise<string> {
  const user = await obterUsuarioAtual();

  if (!user) {
    redirect("/auth");
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

  // Modo de cadastro fechado (temporário, ver acesso-beta.ts): só quem já
  // tem convite pendente (checado acima, sempre vence) ou está na allowlist
  // explícita ganha workspace novo por conta própria. Quem chega sem
  // nenhum dos dois cai na tela de acesso restrito e nunca chama a RPC.
  if (modoCadastroFechado()) {
    const autorizado = user.email ? await emailAutorizadoNoBeta(user.email) : false;
    if (!autorizado) {
      redirect("/acesso-restrito");
    }
    if (user.email) {
      await registrarUsoDoAcessoBeta(user.email);
    }
  }

  // RPC com advisory lock por usuário (2 requisições simultâneas nunca
  // criam 2 workspaces — migration 0040). Desde a auditoria de segurança
  // (migration 0056) ela só é executável pelo service role: a checagem de
  // convite/cadastro fechado acima é a ÚNICA porta de entrada — antes,
  // qualquer conta logada criava workspace chamando a RPC direto pela API.
  // `user.id` vem da sessão revalidada no servidor, nunca do navegador.
  const service = createServiceClient();
  const nomeWorkspace = user.email ? `Workspace de ${user.email}` : "Meu workspace";

  const { data: tenantId, error: erroRpc } = await service.rpc("garantir_workspace_pessoal_para", {
    p_user_id: user.id,
    p_nome: nomeWorkspace,
  });

  if (erroRpc || !tenantId) {
    throw new Error(`Falha ao criar workspace: ${erroRpc?.message}`);
  }

  return tenantId as string;
}
