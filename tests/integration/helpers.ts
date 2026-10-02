import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Só populado quando as 2 env vars de banco de teste estão presentes —
 * cada suíte de integração usa isso pra decidir `describe.skip`. Ver
 * tests/integration/README.md pra como definir essas variáveis. */
export const TEM_BANCO_DE_TESTE = Boolean(
  process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
);

export function clienteServico(): SupabaseClient {
  return createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Cria um usuário de teste descartável (via Admin API, já confirmado) e
 * devolve um client autenticado COMO ELE (login real, sujeito a RLS —
 * nunca o service role, que bypassa RLS e não provaria isolamento nenhum). */
export async function criarUsuarioDeTeste(
  service: SupabaseClient,
  prefixo: string,
): Promise<{ userId: string; email: string; cliente: SupabaseClient }> {
  const email = `${prefixo}-${crypto.randomUUID()}@teste.gaiamum.invalid`;
  const senha = crypto.randomUUID();

  const { data, error } = await service.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuário de teste: ${error?.message}`);
  }

  const cliente = createClient(process.env.SUPABASE_TEST_URL!, process.env.SUPABASE_TEST_ANON_KEY ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: erroLogin } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (erroLogin) {
    throw new Error(`Falha ao logar usuário de teste (confira SUPABASE_TEST_ANON_KEY): ${erroLogin.message}`);
  }

  return { userId: data.user.id, email, cliente };
}

/** Apaga o usuário de teste — cascateia pro resto (memberships, tenants
 * criados só por ele) graças ao `on delete cascade` do schema. */
export async function apagarUsuarioDeTeste(service: SupabaseClient, userId: string): Promise<void> {
  await service.auth.admin.deleteUser(userId);
}

/** Cria um tenant de teste + membership 'owner' pro usuário informado,
 * direto via service client (bypassa RLS de propósito — é fixture, não é
 * o que está sendo testado). */
export async function criarTenantDeTeste(
  service: SupabaseClient,
  ownerUserId: string,
): Promise<string> {
  const { data: tenant, error: erroTenant } = await service
    .from("tenants")
    .insert({ nome: `Tenant de teste ${crypto.randomUUID()}` })
    .select("id")
    .single();
  if (erroTenant || !tenant) {
    throw new Error(`Falha ao criar tenant de teste: ${erroTenant?.message}`);
  }

  const { error: erroMembership } = await service
    .from("memberships")
    .insert({ user_id: ownerUserId, tenant_id: tenant.id, papel: "owner", escopo: "completo" });
  if (erroMembership) {
    throw new Error(`Falha ao criar membership de teste: ${erroMembership.message}`);
  }

  return tenant.id as string;
}
