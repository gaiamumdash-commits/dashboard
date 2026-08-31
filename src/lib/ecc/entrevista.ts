"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { salvarPerfilNegocio, criarProdutoDigital, salvarAvatarCliente } from "@/lib/ecc/marketing";
import { ETAPAS, parsearResultadoEntrevista } from "@/lib/ecc/prompt-entrevista";
import type { EntrevistaIA, EstagioEntrevista, EtapaEntrevistaColada } from "@/lib/ecc/tipos";
import type { ExtracaoEntrevista } from "@/lib/ecc/entrevista-schemas";

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace usa a entrevista de Marketing.");
  }
}

export async function listarEntrevistas(tenantId: string): Promise<EntrevistaIA[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entrevistas_ia")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false });
  return (data as EntrevistaIA[] | null) ?? [];
}

export async function obterEntrevista(entrevistaId: string): Promise<EntrevistaIA | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("entrevistas_ia").select("*").eq("id", entrevistaId).maybeSingle();
  return data as EntrevistaIA | null;
}

export async function iniciarEntrevista(): Promise<string> {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entrevistas_ia")
    .insert({ tenant_id: tenantId, estagio_atual: "situacao", transcript: [] })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Falha ao iniciar entrevista: ${error?.message ?? "sem retorno"}`);
  }

  revalidatePath("/marketing/entrevista");
  return (data as { id: string }).id;
}

/** Registra o texto colado de uma etapa (Situação/Problema/Implicação/
 * Necessidade) e avança pra próxima — sem nenhuma chamada de IA, o texto
 * já veio de uma conversa que o Fabio rodou fora do Gaiamum. */
export async function registrarRespostaEtapa(entrevistaId: string, textoColado: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  if (!textoColado.trim()) {
    throw new Error("Cole a resposta antes de salvar.");
  }

  const entrevista = await obterEntrevista(entrevistaId);
  if (!entrevista || entrevista.tenant_id !== tenantId) {
    throw new Error("Entrevista não encontrada.");
  }

  const etapaAtual = entrevista.estagio_atual as Exclude<EstagioEntrevista, "concluida">;
  const novaEtapa: EtapaEntrevistaColada = { estagio: etapaAtual, texto_colado: textoColado.trim() };
  const transcript = [...entrevista.transcript, novaEtapa];

  const indiceAtual = ETAPAS.indexOf(etapaAtual);
  const proximaEtapa = indiceAtual < ETAPAS.length - 1 ? ETAPAS[indiceAtual + 1] : etapaAtual;

  const { error } = await supabase
    .from("entrevistas_ia")
    .update({ transcript, estagio_atual: proximaEtapa, atualizado_em: new Date().toISOString() })
    .eq("id", entrevistaId);

  if (error) {
    throw new Error(`Falha ao salvar a etapa: ${error.message}`);
  }

  revalidatePath(`/marketing/entrevista/${entrevistaId}`);
}

async function salvarExtracaoDaEntrevista(extracao: ExtracaoEntrevista): Promise<string | null> {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const formPerfil = new FormData();
  formPerfil.set("nome_negocio", extracao.perfil.nome_negocio);
  formPerfil.set("nicho", extracao.perfil.nicho);
  formPerfil.set("tom_de_voz", extracao.perfil.tom_de_voz);
  await salvarPerfilNegocio(formPerfil);

  const formProduto = new FormData();
  formProduto.set("nome", extracao.produto.nome);
  formProduto.set("formato", extracao.produto.formato);
  formProduto.set("promessa", extracao.produto.promessa);
  await criarProdutoDigital(formProduto);

  const { data: produtoCriado } = await supabase
    .from("produtos_digitais")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("nome", extracao.produto.nome)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const produtoId = (produtoCriado as { id: string } | null)?.id ?? null;

  if (produtoId) {
    const formAvatar = new FormData();
    formAvatar.set("dor_unificada", extracao.avatar.dor_unificada);
    formAvatar.set("gatilho_compra", extracao.avatar.gatilho_compra);
    extracao.avatar.dores.forEach((dor, i) => formAvatar.set(`dor_${i + 1}`, dor));
    extracao.avatar.desejos.forEach((desejo, i) => formAvatar.set(`desejo_${i + 1}`, desejo));
    await salvarAvatarCliente(produtoId, formAvatar);
  }

  return produtoId;
}

/** Recebe o bloco final colado (CAMPO: valor), faz o parse determinístico
 * (sem IA) e salva Perfil, Produto e Avatar reaproveitando o CRUD do
 * Incremento 1. */
export async function finalizarComExtracaoColada(entrevistaId: string, textoColado: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const entrevista = await obterEntrevista(entrevistaId);
  if (!entrevista || entrevista.tenant_id !== tenantId) {
    throw new Error("Entrevista não encontrada.");
  }

  const extracao = parsearResultadoEntrevista(textoColado);
  const produtoId = await salvarExtracaoDaEntrevista(extracao);

  const { error } = await supabase
    .from("entrevistas_ia")
    .update({
      status: "concluida",
      estagio_atual: "concluida",
      produto_digital_id: produtoId,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", entrevistaId);

  if (error) {
    throw new Error(`Falha ao concluir entrevista: ${error.message}`);
  }

  revalidatePath(`/marketing/entrevista/${entrevistaId}`);
  revalidatePath("/marketing");
  revalidatePath("/marketing/produtos");
}
