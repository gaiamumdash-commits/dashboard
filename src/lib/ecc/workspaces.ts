/**
 * Seletor de workspace — pedido do Fabio, 2026-10-05 (caso da Angeline:
 * convidada pra um 2º workspace, ela continuava caindo no 1º, porque o app
 * sempre usava a membership MAIS ANTIGA e não havia como trocar).
 *
 * Lógica PURA (sem `server-only`, sem rede) — usada pelo middleware, por
 * `membership.ts` e pelo menu. A preferência fica num cookie
 * (`COOKIE_WORKSPACE_PREFERIDO`) que só ESCOLHE entre memberships que o
 * usuário já tem de verdade: um valor adulterado nunca dá acesso a nada
 * (a autorização real é a RLS, via auth.uid()).
 */

export const COOKIE_WORKSPACE_PREFERIDO = "gaiamum-workspace";
/** Um ano — a escolha vale até a pessoa trocar de novo. */
export const WORKSPACE_PREFERIDO_MAX_AGE_S = 60 * 60 * 24 * 365;

export type MembershipCandidata = {
  tenant_id: string;
  papel: string;
  escopo: string;
  criado_em: string;
};

/**
 * Qual membership vale como "workspace atual":
 * 1. a preferida (cookie), se o usuário ainda faz parte dela e não é o
 *    sandbox do Lab;
 * 2. senão, a mais antiga que não é do Lab (comportamento de sempre);
 * 3. senão, a mais antiga de todas (nunca deixa o usuário sem nada).
 */
export function escolherMembership<T extends MembershipCandidata>(
  memberships: T[],
  tenantPreferido: string | null | undefined,
  tenantsDoLab: ReadonlySet<string>,
): T | null {
  if (memberships.length === 0) return null;
  const ordenadas = [...memberships].sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  const reais = ordenadas.filter((m) => !tenantsDoLab.has(m.tenant_id));

  if (tenantPreferido) {
    const preferida = reais.find((m) => m.tenant_id === tenantPreferido);
    if (preferida) return preferida;
  }
  return reais[0] ?? ordenadas[0];
}

/** Workspaces que aparecem no seletor: todos menos o sandbox do Lab, na
 * ordem em que a pessoa entrou neles. */
export function workspacesDoSeletor<T extends MembershipCandidata>(memberships: T[], tenantsDoLab: ReadonlySet<string>): T[] {
  return [...memberships].filter((m) => !tenantsDoLab.has(m.tenant_id)).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
}

/** "Workspace de fulano@x.com" é o nome automático do 1º acesso — no
 * seletor fica mais claro como "Workspace de fulano". */
export function rotuloDoWorkspace(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  if (!limpo) return "Workspace sem nome";
  return limpo.replace(/^Workspace de ([^@\s]+)@\S+$/, "Workspace de $1");
}
