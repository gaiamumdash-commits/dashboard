"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { obterPerfilNegocio, obterProdutoDigital, obterAvatarComItens } from "@/lib/ecc/marketing";
import { validarViciosDeterministico } from "@/lib/ecc/checklist-copy";
import { gerarPromptCopy, gerarPromptIdeias, parsearListaIdeias, parsearResultadoCopy } from "@/lib/ecc/prompt-mandala";
import type { FaseFunil, IdeiaConteudo, PecaConteudo, TipoAnuncio } from "@/lib/ecc/tipos";

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace usa a Mandala de Anúncios.");
  }
}

async function carregarContextoDoProduto(produtoId: string) {
  const tenantId = await garantirWorkspace();
  const produto = await obterProdutoDigital(produtoId);
  if (!produto || produto.tenant_id !== tenantId) {
    throw new Error("Produto digital não encontrado.");
  }

  const perfil = await obterPerfilNegocio(tenantId);
  if (!perfil) {
    throw new Error("Preencha o Perfil do Negócio antes de gerar conteúdo.");
  }

  const avatarComItens = await obterAvatarComItens(produtoId);
  if (!avatarComItens || avatarComItens.itens.length === 0) {
    throw new Error("Preencha o Avatar do Cliente Ideal antes de gerar conteúdo.");
  }

  return { tenantId, produto, perfil, avatarComItens };
}

export async function obterPromptDeIdeias(produtoId: string, tipo: TipoAnuncio): Promise<string> {
  const { perfil, produto, avatarComItens } = await carregarContextoDoProduto(produtoId);
  return gerarPromptIdeias(
    perfil,
    produto,
    avatarComItens.itens,
    avatarComItens.avatar.dor_unificada,
    avatarComItens.avatar.gatilho_compra,
    tipo,
  );
}

export async function listarLotesDeIdeias(produtoId: string): Promise<IdeiaConteudo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ideias_conteudo")
    .select("*")
    .eq("produto_digital_id", produtoId)
    .order("criado_em", { ascending: false })
    .order("numero", { ascending: true });
  return (data as IdeiaConteudo[] | null) ?? [];
}

export async function obterIdeia(ideiaId: string): Promise<IdeiaConteudo | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("ideias_conteudo").select("*").eq("id", ideiaId).maybeSingle();
  return data as IdeiaConteudo | null;
}

export async function salvarLoteIdeias(produtoId: string, tipo: TipoAnuncio, textoColado: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const ideiasParseadas = parsearListaIdeias(textoColado);
  const loteId = crypto.randomUUID();

  const linhas = ideiasParseadas.map((ideia) => ({
    tenant_id: tenantId,
    produto_digital_id: produtoId,
    lote_id: loteId,
    numero: ideia.numero,
    tipo_anuncio: tipo,
    titulo_gancho: ideia.titulo,
    checklist_avisos: validarViciosDeterministico({ gancho: ideia.titulo }).join(" ") || null,
  }));

  const { error } = await supabase.from("ideias_conteudo").insert(linhas);
  if (error) {
    throw new Error(`Falha ao salvar as ideias: ${error.message}`);
  }

  revalidatePath(`/marketing/produtos/${produtoId}/ideias`);
}

export async function obterPromptDeCopy(ideiaId: string): Promise<{ prompt: string; ideia: IdeiaConteudo }> {
  const ideia = await obterIdeia(ideiaId);
  if (!ideia) {
    throw new Error("Ideia não encontrada.");
  }

  const { perfil, produto, avatarComItens } = await carregarContextoDoProduto(ideia.produto_digital_id);
  const prompt = gerarPromptCopy(
    perfil,
    produto,
    avatarComItens.itens,
    avatarComItens.avatar.dor_unificada,
    avatarComItens.avatar.gatilho_compra,
    ideia,
  );

  return { prompt, ideia };
}

export async function obterPeca(ideiaId: string): Promise<PecaConteudo | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("pecas_conteudo").select("*").eq("ideia_id", ideiaId).maybeSingle();
  return data as PecaConteudo | null;
}

export async function salvarCopyColada(ideiaId: string, textoColado: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const ideia = await obterIdeia(ideiaId);
  if (!ideia || ideia.tenant_id !== tenantId) {
    throw new Error("Ideia não encontrada.");
  }

  const produto = await obterProdutoDigital(ideia.produto_digital_id);
  const resultado = parsearResultadoCopy(textoColado);
  const avisos = validarViciosDeterministico({
    gancho: ideia.titulo_gancho,
    paragrafo1: resultado.paragrafo1,
    nomeProduto: produto?.nome,
  });

  const linha = {
    tenant_id: tenantId,
    produto_digital_id: ideia.produto_digital_id,
    ideia_id: ideiaId,
    gancho: ideia.titulo_gancho,
    paragrafo_1: resultado.paragrafo1,
    paragrafo_2: resultado.paragrafo2,
    cta_descoberta: resultado.ctaDescoberta,
    cta_relacionamento: resultado.ctaRelacionamento,
    cta_conversao: resultado.ctaConversao,
    cta_remarketing: resultado.ctaRemarketing,
    checklist_avisos: avisos.join(" ") || null,
  };

  const existente = await obterPeca(ideiaId);

  const { error } = existente
    ? await supabase.from("pecas_conteudo").update({ ...linha, atualizado_em: new Date().toISOString() }).eq("id", existente.id)
    : await supabase.from("pecas_conteudo").insert(linha);

  if (error) {
    throw new Error(`Falha ao salvar a copy: ${error.message}`);
  }

  revalidatePath(`/marketing/ideias/${ideiaId}/copy`);
}

export async function escolherCtaDaPeca(pecaId: string, fase: FaseFunil) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { data: peca, error } = await supabase
    .from("pecas_conteudo")
    .update({ cta_escolhida: fase })
    .eq("id", pecaId)
    .select("ideia_id")
    .single();

  if (error || !peca) {
    throw new Error(`Falha ao escolher o CTA: ${error?.message ?? "peça não encontrada"}`);
  }

  revalidatePath(`/marketing/ideias/${(peca as { ideia_id: string }).ideia_id}/copy`);
}
