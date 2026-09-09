import "server-only";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { garantirWorkspace } from "@/lib/ecc/workspace";

const NOME_TENANT_LAB = "Gaiamum Lab";

/**
 * Garante que o usuário autenticado tem um tenant de sandbox pro Gaiamum Lab
 * e retorna o tenant_id dele. Cria o tenant + membership 'owner' + o
 * registro em lab_tenants no primeiro acesso.
 *
 * SEMPRE chama garantirWorkspace() antes de tudo: a aplicação inteira
 * resolve "o tenant principal do usuário" pela membership mais antiga
 * (buscarMembershipAtual(), membership.ts) — se o tenant do Lab fosse criado
 * antes do tenant real, ele passaria a ser tratado como o workspace de
 * verdade do usuário em todo o resto do app (dashboard, kanban real,
 * Visão 360° real). Chamar garantirWorkspace() primeiro garante que o
 * tenant real já existe (e é mais antigo) antes de sequer olhar pro tenant
 * do Lab, não importa por qual rota o usuário chegou até aqui.
 *
 * Nunca usar fora de rotas /lab/**. Páginas do produto real continuam
 * resolvendo tenant via garantirWorkspace()/buscarMembershipAtual().
 */
export async function garantirTenantLab(): Promise<string> {
  const user = await obterUsuarioAtual();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  await garantirWorkspace();

  const service = createServiceClient();

  const { data: existente } = await service
    .from("lab_tenants")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existente) {
    return (existente as { tenant_id: string }).tenant_id;
  }

  const { data: tenant, error: erroTenant } = await service
    .from("tenants")
    .insert({ nome: NOME_TENANT_LAB })
    .select("id")
    .single();

  if (erroTenant || !tenant) {
    throw new Error(`Falha ao criar tenant do Lab: ${erroTenant?.message}`);
  }

  const tenantId = (tenant as { id: string }).id;

  const { error: erroMembership } = await service
    .from("memberships")
    .insert({ user_id: user.id, tenant_id: tenantId, papel: "owner" });

  if (erroMembership) {
    throw new Error(`Falha ao vincular usuário ao tenant do Lab: ${erroMembership.message}`);
  }

  // Gravado por último: lab_tenants é a fonte de verdade de idempotência
  // (ver busca acima). Se tenant/membership tiverem sucesso mas isso
  // falhar, a próxima chamada não encontra a linha e recomeça criando outro
  // tenant — mesma classe de risco (estado parcial) já aceita hoje em
  // garantirWorkspace(), que também não usa transação.
  const { error: erroLabTenant } = await service
    .from("lab_tenants")
    .insert({ user_id: user.id, tenant_id: tenantId });

  if (erroLabTenant) {
    throw new Error(`Falha ao registrar tenant do Lab: ${erroLabTenant.message}`);
  }

  return tenantId;
}
