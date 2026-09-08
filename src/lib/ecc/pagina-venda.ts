"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { carregarContextoDoProduto, obterProdutoDigital } from "@/lib/ecc/marketing";
import { validarViciosDeterministico } from "@/lib/ecc/checklist-copy";
import { gerarPromptPaginaVenda, parsearResultadoPaginaVenda } from "@/lib/ecc/prompt-pagina-venda";
import type { PaginaVenda, PecaConteudo } from "@/lib/ecc/tipos";

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace usa a Página de Venda.");
  }
}

export async function listarPecasDoProduto(produtoId: string): Promise<PecaConteudo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pecas_conteudo")
    .select("*")
    .eq("produto_digital_id", produtoId)
    .order("criado_em", { ascending: false });
  return (data as PecaConteudo[] | null) ?? [];
}

export async function obterPaginaVenda(produtoId: string): Promise<PaginaVenda | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("paginas_venda").select("*").eq("produto_digital_id", produtoId).maybeSingle();
  return data as PaginaVenda | null;
}

export async function obterPromptDePaginaVenda(produtoId: string, pecaReferenciaId: string | null): Promise<string> {
  const { perfil, produto, avatarComItens } = await carregarContextoDoProduto(produtoId);

  let pecaReferencia: PecaConteudo | null = null;
  if (pecaReferenciaId) {
    const supabase = await createClient();
    const { data } = await supabase.from("pecas_conteudo").select("*").eq("id", pecaReferenciaId).maybeSingle();
    const peca = data as PecaConteudo | null;
    if (!peca || peca.produto_digital_id !== produtoId) {
      throw new Error("Peça de referência não encontrada para este produto.");
    }
    pecaReferencia = peca;
  }

  return gerarPromptPaginaVenda(
    perfil,
    produto,
    avatarComItens.itens,
    avatarComItens.avatar.dor_unificada,
    avatarComItens.avatar.gatilho_compra,
    pecaReferencia,
  );
}

export async function salvarPaginaVendaColada(produtoId: string, pecaReferenciaId: string | null, textoColado: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const produto = await obterProdutoDigital(produtoId);
  if (!produto || produto.tenant_id !== tenantId) {
    throw new Error("Produto digital não encontrado.");
  }

  const resultado = parsearResultadoPaginaVenda(textoColado);
  const avisos = validarViciosDeterministico({
    gancho: resultado.headline,
    paragrafo1: resultado.introducao,
    nomeProduto: produto.nome,
  });

  const linha = {
    tenant_id: tenantId,
    produto_digital_id: produtoId,
    peca_referencia_id: pecaReferenciaId,
    headline: resultado.headline,
    subheadline: resultado.subheadline,
    introducao: resultado.introducao,
    beneficios: resultado.beneficios,
    oferta: resultado.oferta,
    prova_social: resultado.provaSocial,
    garantia: resultado.garantia,
    cta_final: resultado.ctaFinal,
    checklist_avisos: avisos.join(" ") || null,
  };

  const existente = await obterPaginaVenda(produtoId);

  const { error } = existente
    ? await supabase.from("paginas_venda").update({ ...linha, atualizado_em: new Date().toISOString() }).eq("id", existente.id)
    : await supabase.from("paginas_venda").insert(linha);

  if (error) {
    throw new Error(`Falha ao salvar a página de venda: ${error.message}`);
  }

  revalidatePath(`/marketing/produtos/${produtoId}/pagina-venda`);
}
