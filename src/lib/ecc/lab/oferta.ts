"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { listarPatentesDoUsuario } from "@/lib/ecc/lab/patentes";

/** Elegibilidade pra tela de escolha pré-onboarding ("Fazer o Lab" vs "Ir
 * direto pro app"): só owner do workspace (quem assina a conta — convidado
 * de projeto nunca vê isso), só quem esse workspace ainda não perguntou, e
 * só quem ainda não tem a patente 'explorador'. A patente é por CONTA
 * (user_id, ver 0027_gaiamum_lab.sql), não por workspace — um owner que já
 * concluiu o Lab num tenant não é oferecido de novo num tenant novo. */
export async function deveOferecerLab(tenantId: string): Promise<boolean> {
  const user = await obterUsuarioAtual();
  if (!user) return false;

  const [papel, patentes, jaDecidiu] = await Promise.all([
    obterPapelAtual(tenantId),
    listarPatentesDoUsuario(user.id),
    tenantJaDecidiuOfertaLab(tenantId),
  ]);

  if (papel !== "owner") return false;
  if (patentes.some((p) => p.codigo === "explorador")) return false;
  if (jaDecidiu) return false;
  return true;
}

async function tenantJaDecidiuOfertaLab(tenantId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenants")
    .select("oferta_lab_decisao")
    .eq("id", tenantId)
    .maybeSingle();
  return Boolean((data as { oferta_lab_decisao: string | null } | null)?.oferta_lab_decisao);
}

/** Marca que o workspace viu a tela — gravado só uma vez (a query já filtra
 * por "ainda não tinha visto", então uma corrida entre duas requisições no
 * pior caso grava a mesma coisa duas vezes, nunca sobrescreve com null).
 * Roda em after() pra não atrasar a resposta, mesmo padrão de actions.ts. */
export async function registrarVistaOfertaLab(tenantId: string): Promise<void> {
  const supabase = await createClient();
  after(async () => {
    await supabase
      .from("tenants")
      .update({ oferta_lab_vista_em: new Date().toISOString() })
      .eq("id", tenantId)
      .is("oferta_lab_vista_em", null);
  });
}

/** Grava a decisão do owner e redireciona. A checagem de papel aqui é só
 * mensagem de erro amigável — a policy de UPDATE em tenants (migration
 * 0036) é quem garante a segurança real, mesmo raciocínio de exigirOwner()
 * usado em decisoes.ts/entrevista.ts/anexos.ts. */
export async function registrarDecisaoOfertaLab(decisao: "lab" | "pular"): Promise<void> {
  const tenantId = await garantirWorkspace();

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace decide sobre a oferta do Lab.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tenants").update({ oferta_lab_decisao: decisao }).eq("id", tenantId);

  if (error) {
    throw new Error(`Falha ao registrar decisão da oferta do Lab: ${error.message}`);
  }

  redirect(decisao === "lab" ? "/lab" : "/onboarding");
}
