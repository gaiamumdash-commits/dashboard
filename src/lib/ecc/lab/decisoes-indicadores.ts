"use server";

import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirTenantLab } from "@/lib/ecc/lab/tenant";
import { paraUtcDoFuso } from "@/lib/ecc/kanban";
import { marcarPassoConcluido, MODULO_DECISOES_INDICADORES, MODULO_FINANCEIRO } from "@/lib/ecc/lab/progresso";

/** CRUD de Decisão e Indicador dentro do Gaiamum Lab — espelha
 * src/lib/ecc/decisoes.ts e indicadores.ts (mesma validação, mesmo padrão de
 * fuso), com duas diferenças deliberadas:
 *
 * 1. Resolve tenant via garantirTenantLab() (nunca garantirWorkspace()) e
 *    escopa toda escrita por tenant_id — mesmo cuidado de moverTarefaLab
 *    (actions.ts): usar as Server Actions reais aqui gravaria o dado
 *    fictício no tenant REAL do usuário.
 * 2. Sem exigirOwner(): o tenant do Lab só tem uma membership (o próprio
 *    usuário, sempre owner via garantirTenantLab()) — chamar seria código
 *    morto que nunca falha. */

function campoObrigatorio(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`Campo obrigatório ausente: ${nome}`);
  }
  return valor.trim();
}

async function exigirUsuario() {
  const user = await obterUsuarioAtual();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }
  return user;
}

export async function criarDecisaoLab(projetoId: string, formData: FormData): Promise<void> {
  const user = await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const titulo = campoObrigatorio(formData, "titulo");
  const decisao = campoObrigatorio(formData, "decisao");
  const motivo = campoObrigatorio(formData, "motivo");
  const impactoEsperado = campoObrigatorio(formData, "impacto_esperado");
  const metaSmartId = (formData.get("meta_smart_id") as string | null) || null;
  const fuso = (formData.get("fuso") as string | null) || "America/Sao_Paulo";
  const dataLocal = formData.get("data") as string | null;
  const data = dataLocal ? paraUtcDoFuso(dataLocal, fuso).toISOString() : new Date().toISOString();
  const valorEstimadoBruto = formData.get("valor_estimado") as string | null;
  const valorEstimado = valorEstimadoBruto ? Number(valorEstimadoBruto) : null;

  const { error } = await supabase.from("decisoes").insert({
    tenant_id: tenantIdLab,
    projeto_id: projetoId,
    meta_smart_id: metaSmartId,
    titulo,
    decisao,
    motivo,
    impacto_esperado: impactoEsperado,
    autor: user.id,
    data,
    valor_estimado: valorEstimado,
  });

  if (error) {
    throw new Error(`Falha ao criar decisão do Lab: ${error.message}`);
  }

  await marcarPassoConcluido(user.id, "criar_decisao", MODULO_DECISOES_INDICADORES);
  if (valorEstimado !== null) {
    await marcarPassoConcluido(user.id, "marcar_valor_estimado", MODULO_FINANCEIRO);
  }
  revalidatePath("/lab/visao-360");
  revalidatePath("/lab/financeiro");
}

export async function editarDecisaoLab(decisaoId: string, projetoId: string, formData: FormData): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const titulo = campoObrigatorio(formData, "titulo");
  const decisao = campoObrigatorio(formData, "decisao");
  const motivo = campoObrigatorio(formData, "motivo");
  const impactoEsperado = campoObrigatorio(formData, "impacto_esperado");
  const metaSmartId = (formData.get("meta_smart_id") as string | null) || null;
  const fuso = (formData.get("fuso") as string | null) || "America/Sao_Paulo";
  const dataLocal = campoObrigatorio(formData, "data");
  const data = paraUtcDoFuso(dataLocal, fuso).toISOString();

  const { error } = await supabase
    .from("decisoes")
    .update({
      meta_smart_id: metaSmartId,
      titulo,
      decisao,
      motivo,
      impacto_esperado: impactoEsperado,
      data,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", decisaoId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao editar decisão do Lab: ${error.message}`);
  }

  revalidatePath("/lab/visao-360");
}

export async function excluirDecisaoLab(decisaoId: string, projetoId: string): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const { error } = await supabase.from("decisoes").delete().eq("id", decisaoId).eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao excluir decisão do Lab: ${error.message}`);
  }

  revalidatePath("/lab/visao-360");
}

export async function criarIndicadorLab(projetoId: string, formData: FormData): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const nome = campoObrigatorio(formData, "nome");
  const valorAtual = Number(formData.get("valor_atual") ?? 0);
  const meta = Number(campoObrigatorio(formData, "meta"));
  const unidade = campoObrigatorio(formData, "unidade");

  if (!Number.isFinite(meta)) {
    throw new Error("Meta inválida.");
  }
  if (!Number.isFinite(valorAtual)) {
    throw new Error("Valor atual inválido.");
  }

  const { error } = await supabase.from("indicadores").insert({
    tenant_id: tenantIdLab,
    projeto_id: projetoId,
    nome,
    valor_atual: valorAtual,
    meta,
    unidade,
  });

  if (error) {
    throw new Error(`Falha ao criar indicador do Lab: ${error.message}`);
  }

  revalidatePath("/lab/visao-360");
}

export async function editarIndicadorLab(indicadorId: string, projetoId: string, formData: FormData): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const nome = campoObrigatorio(formData, "nome");
  const meta = Number(campoObrigatorio(formData, "meta"));
  const unidade = campoObrigatorio(formData, "unidade");

  if (!Number.isFinite(meta)) {
    throw new Error("Meta inválida.");
  }

  const { error } = await supabase
    .from("indicadores")
    .update({ nome, meta, unidade, atualizado_em: new Date().toISOString() })
    .eq("id", indicadorId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao editar indicador do Lab: ${error.message}`);
  }

  revalidatePath("/lab/visao-360");
}

export async function excluirIndicadorLab(indicadorId: string, projetoId: string): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const { error } = await supabase.from("indicadores").delete().eq("id", indicadorId).eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao excluir indicador do Lab: ${error.message}`);
  }

  revalidatePath("/lab/visao-360");
}

export async function atualizarValorIndicadorLab(
  indicadorId: string,
  projetoId: string,
  valorAtual: number,
): Promise<void> {
  const user = await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  if (!Number.isFinite(valorAtual)) {
    throw new Error("Valor inválido.");
  }

  const { error } = await supabase
    .from("indicadores")
    .update({ valor_atual: valorAtual, atualizado_em: new Date().toISOString() })
    .eq("id", indicadorId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao atualizar indicador do Lab: ${error.message}`);
  }

  await marcarPassoConcluido(user.id, "atualizar_indicador", MODULO_DECISOES_INDICADORES);
  revalidatePath("/lab/visao-360");
}
