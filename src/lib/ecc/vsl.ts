"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { carregarContextoDoProduto, obterProdutoDigital } from "@/lib/ecc/marketing";
import { obterPaginaVenda } from "@/lib/ecc/pagina-venda";
import { validarViciosDeterministico } from "@/lib/ecc/checklist-copy";
import { gerarPromptVsl, parsearResultadoVsl } from "@/lib/ecc/prompt-vsl";
import type { PaginaVenda, PecaConteudo, RoteiroVsl } from "@/lib/ecc/tipos";

export type ReferenciaVsl = { tipo: "peca" | "pagina" | "nenhuma"; id: string | null };

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace usa o Roteiro de VSL.");
  }
}

export async function obterRoteiroVsl(produtoId: string): Promise<RoteiroVsl | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("roteiros_vsl").select("*").eq("produto_digital_id", produtoId).maybeSingle();
  return data as RoteiroVsl | null;
}

export async function obterPromptDeVsl(produtoId: string, referencia: ReferenciaVsl): Promise<string> {
  const { perfil, produto, avatarComItens } = await carregarContextoDoProduto(produtoId);

  let pecaReferencia: PecaConteudo | null = null;
  let paginaReferencia: PaginaVenda | null = null;

  if (referencia.tipo === "peca" && referencia.id) {
    const supabase = await createClient();
    const { data } = await supabase.from("pecas_conteudo").select("*").eq("id", referencia.id).maybeSingle();
    const peca = data as PecaConteudo | null;
    if (!peca || peca.produto_digital_id !== produtoId) {
      throw new Error("Peça de referência não encontrada para este produto.");
    }
    pecaReferencia = peca;
  } else if (referencia.tipo === "pagina") {
    const pagina = await obterPaginaVenda(produtoId);
    if (!pagina) {
      throw new Error("Página de venda de referência não encontrada para este produto.");
    }
    paginaReferencia = pagina;
  }

  return gerarPromptVsl(
    perfil,
    produto,
    avatarComItens.itens,
    avatarComItens.avatar.dor_unificada,
    avatarComItens.avatar.gatilho_compra,
    pecaReferencia,
    paginaReferencia,
  );
}

export async function salvarVslColado(produtoId: string, referencia: ReferenciaVsl, textoColado: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const produto = await obterProdutoDigital(produtoId);
  if (!produto || produto.tenant_id !== tenantId) {
    throw new Error("Produto digital não encontrado.");
  }

  const resultado = parsearResultadoVsl(textoColado);
  const avisos = validarViciosDeterministico({
    gancho: resultado.gancho,
    paragrafo1: [resultado.identificacaoDor, resultado.agitacao, resultado.virada, resultado.prova, resultado.oferta, resultado.ctaFinal]
      .filter((v): v is string => Boolean(v))
      .join("\n"),
    nomeProduto: produto.nome,
  });

  const linha = {
    tenant_id: tenantId,
    produto_digital_id: produtoId,
    peca_referencia_id: referencia.tipo === "peca" ? referencia.id : null,
    pagina_venda_referencia_id: referencia.tipo === "pagina" ? referencia.id : null,
    tempo_gancho: resultado.tempoGancho,
    gancho: resultado.gancho,
    tempo_identificacao_dor: resultado.tempoIdentificacaoDor,
    identificacao_dor: resultado.identificacaoDor,
    tempo_agitacao: resultado.tempoAgitacao,
    agitacao: resultado.agitacao,
    tempo_virada: resultado.tempoVirada,
    virada: resultado.virada,
    tempo_prova: resultado.tempoProva,
    prova: resultado.prova,
    tempo_oferta: resultado.tempoOferta,
    oferta: resultado.oferta,
    tempo_cta_final: resultado.tempoCtaFinal,
    cta_final: resultado.ctaFinal,
    checklist_avisos: avisos.join(" ") || null,
  };

  const existente = await obterRoteiroVsl(produtoId);

  const { error } = existente
    ? await supabase.from("roteiros_vsl").update({ ...linha, atualizado_em: new Date().toISOString() }).eq("id", existente.id)
    : await supabase.from("roteiros_vsl").insert(linha);

  if (error) {
    throw new Error(`Falha ao salvar o roteiro de VSL: ${error.message}`);
  }

  revalidatePath(`/marketing/produtos/${produtoId}/vsl`);
}
