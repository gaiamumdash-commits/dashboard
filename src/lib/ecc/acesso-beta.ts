import "server-only";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { obterUsuarioAtual } from "@/lib/supabase/server";
import { souDonoDoSaas } from "@/lib/ecc/dono-saas";

/** Liga/desliga o gate de cadastro fechado inteiro sem reverter código nem
 * gerar migration — pra reabrir quando o produto virar comercial. Ausente
 * ou != "true" = cadastro aberto (comportamento de hoje, inalterado). Ao
 * contrário de EMAIL_DONO_SAAS (seguro por padrão = fechado), aqui o padrão
 * seguro pro produto é ABERTO — documentado de propósito pra não confundir
 * os dois gates. */
export function modoCadastroFechado(): boolean {
  return process.env.MODO_CADASTRO_FECHADO === "true";
}

export async function emailAutorizadoNoBeta(email: string): Promise<boolean> {
  const service = createServiceClient();
  const { data } = await service
    .from("acesso_beta_permitido")
    .select("email")
    .eq("email", email.toLowerCase())
    .eq("bloqueado", false)
    .maybeSingle();
  return Boolean(data);
}

/** Só telemetria (quem já entrou vs. só autorizado) — nunca lógica de
 * autorização. */
export async function registrarUsoDoAcessoBeta(email: string): Promise<void> {
  const service = createServiceClient();
  await service
    .from("acesso_beta_permitido")
    .update({ usado_em: new Date().toISOString() })
    .eq("email", email.toLowerCase());
}

export type LinhaAcessoBeta = {
  email: string;
  criadoEm: string;
  usadoEm: string | null;
  bloqueado: boolean;
};

export async function listarAcessoBetaPermitido(): Promise<LinhaAcessoBeta[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("acesso_beta_permitido")
    .select("email, criado_em, usado_em, bloqueado")
    .order("criado_em", { ascending: false });

  return (data ?? []).map((linha) => ({
    email: linha.email,
    criadoEm: linha.criado_em,
    usadoEm: linha.usado_em,
    bloqueado: linha.bloqueado,
  }));
}

export async function autorizarEmailNoBeta(formData: FormData): Promise<void> {
  "use server";

  if (!(await souDonoDoSaas())) {
    throw new Error("Não autorizado.");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;

  const usuario = await obterUsuarioAtual();
  const service = createServiceClient();
  await service
    .from("acesso_beta_permitido")
    .upsert({ email, autorizado_por: usuario?.id ?? null, bloqueado: false }, { onConflict: "email" });

  revalidatePath("/admin/analitica-lab");
}

export async function alternarBloqueioAcessoBeta(formData: FormData): Promise<void> {
  "use server";

  if (!(await souDonoDoSaas())) {
    throw new Error("Não autorizado.");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const bloquear = formData.get("bloquear") === "true";
  if (!email) return;

  const service = createServiceClient();
  await service.from("acesso_beta_permitido").update({ bloqueado: bloquear }).eq("email", email);

  revalidatePath("/admin/analitica-lab");
}
