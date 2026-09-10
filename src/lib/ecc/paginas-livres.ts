"use server";

import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual, eSouGestorDoProjeto } from "@/lib/ecc/equipe";
import type { PaginaLivre } from "@/lib/ecc/tipos";
import type { PartialBlock } from "@blocknote/core";

// Template inicial de página livre — só o lado NÃO-acionável do fluxo de
// processamento do GTD (David Allen): Referência e Algum dia/talvez. O lado
// acionável (próxima ação, regra dos 2 minutos, delegar, agendar) pertence
// conceitualmente ao cartão do Kanban, não a uma nota — colocar "próximas
// ações" aqui criaria uma segunda lista de tarefas competindo com o quadro
// real do projeto.
const TEMPLATE_INICIAL_PAGINA_LIVRE: PartialBlock[] = [
  {
    type: "heading",
    props: { level: 2 },
    content: "Material de referência",
  },
  {
    type: "paragraph",
    content: "",
  },
  {
    type: "heading",
    props: { level: 2 },
    content: "Ideias / algum dia",
  },
  {
    type: "bulletListItem",
    content: "",
  },
];

export async function listarPaginasLivresDoProjeto(projetoId: string): Promise<PaginaLivre[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("paginas_livres")
    .select("*")
    .eq("projeto_id", projetoId)
    .order("atualizado_em", { ascending: false });

  if (error) {
    throw new Error(`Falha ao listar páginas: ${error.message}`);
  }

  return (data as PaginaLivre[] | null) ?? [];
}

export async function obterPaginaLivre(paginaId: string, projetoId: string): Promise<PaginaLivre | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("paginas_livres")
    .select("*")
    .eq("id", paginaId)
    .eq("projeto_id", projetoId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao buscar página: ${error.message}`);
  }

  return (data as PaginaLivre | null) ?? null;
}

export async function criarPaginaLivre(projetoId: string, titulo: string): Promise<PaginaLivre> {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const user = await obterUsuarioAtual();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data, error } = await supabase
    .from("paginas_livres")
    .insert({
      tenant_id: tenantId,
      projeto_id: projetoId,
      titulo: titulo.trim() || "Sem título",
      conteudo: TEMPLATE_INICIAL_PAGINA_LIVRE,
      criado_por: user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Falha ao criar página: ${error?.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/paginas`);
  return data as PaginaLivre;
}

export async function renomearPaginaLivre(paginaId: string, projetoId: string, titulo: string) {
  await garantirWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("paginas_livres")
    .update({ titulo: titulo.trim() || "Sem título", atualizado_em: new Date().toISOString() })
    .eq("id", paginaId);

  if (error) {
    throw new Error(`Falha ao renomear página: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/paginas`);
  revalidatePath(`/projetos/${projetoId}/paginas/${paginaId}`);
}

// `atualizadoEmConhecido` é o timestamp que o cliente tinha quando carregou a
// página. Checagem de concorrência otimista leve (sem merge, só detecção):
// se alguém salvou depois disso, avisa em vez de sobrescrever silenciosamente
// (não há colaboração em tempo real — ver contexto no plano desta frente).
export async function atualizarConteudoPaginaLivre(
  paginaId: string,
  projetoId: string,
  conteudo: PartialBlock[],
  atualizadoEmConhecido?: string,
): Promise<{ atualizado_em: string } | { conflito: true }> {
  await garantirWorkspace();
  const supabase = await createClient();

  if (atualizadoEmConhecido) {
    const { data: atual } = await supabase
      .from("paginas_livres")
      .select("atualizado_em")
      .eq("id", paginaId)
      .maybeSingle();

    if (atual && atual.atualizado_em !== atualizadoEmConhecido) {
      return { conflito: true };
    }
  }

  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("paginas_livres")
    .update({ conteudo, atualizado_em: agora })
    .eq("id", paginaId);

  if (error) {
    throw new Error(`Falha ao salvar conteúdo: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/paginas`);
  return { atualizado_em: agora };
}

export async function excluirPaginaLivre(paginaId: string, projetoId: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const user = await obterUsuarioAtual();

  const souOwner = (await obterPapelAtual(tenantId)) === "owner";
  const souGestor = Boolean(user) && (await eSouGestorDoProjeto(projetoId, user!.id));

  if (!souOwner && !souGestor) {
    throw new Error("Só o gestor do projeto (ou o dono do workspace) pode apagar uma página.");
  }

  const { error } = await supabase.from("paginas_livres").delete().eq("id", paginaId);

  if (error) {
    throw new Error(`Falha ao excluir página: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/paginas`);
}
