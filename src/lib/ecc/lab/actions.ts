"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirTenantLab } from "@/lib/ecc/lab/tenant";
import { refazerCafeMangue, semearCafeMangue } from "@/lib/ecc/lab/seed-cafe-mangue";
import {
  marcarPassoConcluido,
  resetarPassosDoModulo,
  MODULO_NUCLEO,
  MODULO_DECISOES_INDICADORES,
  MODULO_FINANCEIRO,
  MODULO_AGENDA,
  MODULO_PAGINAS_LIVRES,
  type PassoLab,
} from "@/lib/ecc/lab/progresso";
import { concederPatente } from "@/lib/ecc/lab/patentes";

async function exigirUsuario() {
  const user = await obterUsuarioAtual();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }
  return user;
}

/** Primeira entrada no Lab: garante o tenant de sandbox, semeia o Café
 * Mangue e manda pro quadro. Usada como `<form action={iniciarLab}>` —
 * aceita o FormData implícito do form e o ignora, mesmo padrão de
 * pularOnboarding() (actions.ts). */
export async function iniciarLab(): Promise<void> {
  const user = await exigirUsuario();
  const tenantId = await garantirTenantLab();
  await semearCafeMangue(tenantId, user.id);
  redirect("/lab/quadro");
}

/** Avança um passo do roteiro. Quando o passo é "concluir", concede a
 * patente Explorador — é a ÚNICA patente que nasce do Lab; Estrategista e
 * Master nascem inteiramente do uso real do produto (ver
 * explicacao-alinhamento.ts e projetos/[id]/visao-360/page.tsx). */
async function avancarPassoLab(passo: PassoLab): Promise<void> {
  const user = await exigirUsuario();
  await marcarPassoConcluido(user.id, passo);

  if (passo === "concluir") {
    await concederPatente(user.id, "explorador");
  }

  revalidatePath("/lab");
}

/** Wrapper com redirect — usada como `<form action={continuarParaVisao360}>`
 * no botão "Continuar →" do quadro do Lab. */
export async function continuarParaVisao360(): Promise<void> {
  await avancarPassoLab("explorar_quadro");
  redirect("/lab/visao-360");
}

/** Wrapper com redirect — usada como `<form action={concluirLab}>` no botão
 * final da Visão 360° do Lab. Volta pra "/lab", que passa a mostrar a tela
 * de "você é Explorador" (ver app/lab/page.tsx). */
export async function concluirLab(): Promise<void> {
  await avancarPassoLab("concluir");
  redirect("/lab");
}

/** Move um cartão do quadro fictício entre colunas. Resolve o tenant via
 * garantirTenantLab() (nunca garantirWorkspace()) e escopa o update por
 * tenant_id — mesmo cuidado de `moverTarefa` real (actions.ts), mas com o
 * tenant certo: usar garantirWorkspace() aqui gravaria a mudança no tenant
 * REAL do usuário sobre um cartão que pertence ao tenant do Lab. */
export async function moverTarefaLab(tarefaId: string, novaColunaId: string): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tarefas")
    .update({ coluna_id: novaColunaId })
    .eq("id", tarefaId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao mover cartão do Lab: ${error.message}`);
  }

  revalidatePath("/lab/quadro");
}

/** "Refazer o case": reseta o roteiro do módulo núcleo e re-semeia o
 * quadro fictício do zero. Nunca mexe em patentes já conquistadas.
 *
 * Sem redirect() aqui de propósito: é chamada por um client component
 * (BotaoRefazerLab) dentro de um try/catch — redirect() lança um erro
 * especial (NEXT_REDIRECT) que esse catch capturaria como falha real,
 * cancelando a navegação. Quem chama navega depois, via router.push(). */
export async function refazerModuloLab(): Promise<void> {
  const user = await exigirUsuario();
  const tenantId = await garantirTenantLab();
  await resetarPassosDoModulo(user.id, MODULO_NUCLEO);
  await resetarPassosDoModulo(user.id, MODULO_DECISOES_INDICADORES);
  await resetarPassosDoModulo(user.id, MODULO_FINANCEIRO);
  await resetarPassosDoModulo(user.id, MODULO_AGENDA);
  await resetarPassosDoModulo(user.id, MODULO_PAGINAS_LIVRES);
  await refazerCafeMangue(tenantId, user.id);
  revalidatePath("/lab");
}
