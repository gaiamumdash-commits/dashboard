import "server-only";
import { cookies } from "next/headers";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { buscarMembershipAtual } from "@/lib/ecc/membership";
import {
  COOKIE_WORKSPACE_PREFERIDO,
  WORKSPACE_PREFERIDO_MAX_AGE_S,
  rotuloDoWorkspace,
  workspacesDoSeletor,
  type MembershipCandidata,
} from "@/lib/ecc/workspaces";

/** Cache de 5min do workspace atual (ver lib/supabase/middleware.ts) —
 * apagado na troca pra escolha valer já na próxima página. */
const COOKIE_CACHE_MEMBERSHIP = "gaiamum-membership";

export type WorkspaceDoUsuario = { tenantId: string; nome: string; papel: string };

/** Workspaces reais da pessoa (sem o sandbox do Lab) + qual é o atual. A
 * RLS de `memberships`/`tenants` já limita ao que é dela. */
export async function listarWorkspacesDoUsuario(): Promise<{ workspaces: WorkspaceDoUsuario[]; atual: string | null }> {
  const user = await obterUsuarioAtual();
  if (!user) return { workspaces: [], atual: null };

  const supabase = await createClient();
  const [{ data: todas }, { data: lab }, atual] = await Promise.all([
    supabase.from("memberships").select("tenant_id, papel, escopo, criado_em, tenants(nome)").eq("user_id", user.id),
    supabase.from("lab_tenants").select("tenant_id").eq("user_id", user.id),
    buscarMembershipAtual(),
  ]);

  type Linha = MembershipCandidata & { tenants: { nome: string } | { nome: string }[] | null };
  const tenantsDoLab = new Set(((lab as { tenant_id: string }[] | null) ?? []).map((l) => l.tenant_id));
  const workspaces = workspacesDoSeletor((todas as Linha[] | null) ?? [], tenantsDoLab).map((m) => {
    const tenant = Array.isArray(m.tenants) ? m.tenants[0] : m.tenants;
    return { tenantId: m.tenant_id, nome: rotuloDoWorkspace(tenant?.nome), papel: m.papel };
  });

  return { workspaces, atual: atual?.tenantId ?? null };
}

/** Grava a escolha (só pode ser chamada de Server Action/Route Handler). */
export async function definirWorkspacePreferido(tenantId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_WORKSPACE_PREFERIDO, tenantId, {
    maxAge: WORKSPACE_PREFERIDO_MAX_AGE_S,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  cookieStore.delete(COOKIE_CACHE_MEMBERSHIP);
}
