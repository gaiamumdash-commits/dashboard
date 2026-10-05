"use server";

import { redirect } from "next/navigation";
import { definirWorkspacePreferido, listarWorkspacesDoUsuario } from "@/lib/ecc/workspaces-servidor";

/** Troca o workspace atual pelo seletor do menu. Só aceita um workspace que
 * a pessoa já tem (e que não é o sandbox do Lab) — o cookie em si nunca
 * autoriza nada, mas não faz sentido gravar uma escolha impossível. */
export async function trocarWorkspace(formData: FormData) {
  const tenantId = formData.get("tenant_id");
  if (typeof tenantId !== "string" || !tenantId) return;

  const { workspaces } = await listarWorkspacesDoUsuario();
  if (!workspaces.some((w) => w.tenantId === tenantId)) {
    throw new Error("Você não faz parte desse workspace.");
  }

  await definirWorkspacePreferido(tenantId);
  redirect("/projetos");
}
