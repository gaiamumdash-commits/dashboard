"use server";

import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { adicionarEtiquetaNaTarefa } from "@/lib/ecc/etiquetas";
import { ROTULO_TIPO_ANUNCIO } from "@/lib/ecc/prompt-mandala";
import type { PecaConteudo, TipoAnuncio } from "@/lib/ecc/tipos";

const NOME_QUADRO_PRODUCAO = "Produção de Conteúdo";

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace gerencia a produção de conteúdo.");
  }
}

/** Não dá pra reaproveitar `criarProjeto` (actions.ts) direto: ele sempre
 * cria as 3 colunas padrão e recebe `FormData`. O quadro de produção
 * precisa das próprias colunas (funil de conteúdo, não tarefa genérica). */
export async function obterOuCriarQuadroDeProducao(): Promise<string> {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const user = await obterUsuarioAtual();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data: existente } = await supabase
    .from("projetos")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("nome", NOME_QUADRO_PRODUCAO)
    .maybeSingle();

  if (existente) {
    return (existente as { id: string }).id;
  }

  const { data: projeto, error } = await supabase
    .from("projetos")
    .insert({ tenant_id: tenantId, nome: NOME_QUADRO_PRODUCAO })
    .select("id")
    .single();

  if (error || !projeto) {
    throw new Error(`Falha ao criar o quadro de produção: ${error?.message ?? "sem retorno"}`);
  }

  const projetoId = (projeto as { id: string }).id;

  const { error: erroMembro } = await supabase
    .from("projeto_membros")
    .insert({ tenant_id: tenantId, projeto_id: projetoId, user_id: user.id, papel: "gestor" });

  if (erroMembro) {
    throw new Error(`Quadro criado, mas falha ao definir gestor: ${erroMembro.message}`);
  }

  const { error: erroColunas } = await supabase.from("colunas_kanban").insert([
    { tenant_id: tenantId, projeto_id: projetoId, nome: "Ideia", ordem: 0, concluido: false },
    { tenant_id: tenantId, projeto_id: projetoId, nome: "Copy", ordem: 1, concluido: false },
    { tenant_id: tenantId, projeto_id: projetoId, nome: "Produção", ordem: 2, concluido: false },
    { tenant_id: tenantId, projeto_id: projetoId, nome: "Revisão", ordem: 3, concluido: false },
    { tenant_id: tenantId, projeto_id: projetoId, nome: "Agendado", ordem: 4, concluido: false },
    { tenant_id: tenantId, projeto_id: projetoId, nome: "Publicado", ordem: 5, concluido: true },
  ]);

  if (erroColunas) {
    throw new Error(`Quadro criado, mas falha ao criar colunas: ${erroColunas.message}`);
  }

  revalidatePath("/projetos");
  return projetoId;
}

function descricaoDaPeca(peca: PecaConteudo): string {
  if (peca.cta_escolhida) {
    const ctaEscolhido = {
      descoberta: peca.cta_descoberta,
      relacionamento: peca.cta_relacionamento,
      conversao: peca.cta_conversao,
      remarketing: peca.cta_remarketing,
    }[peca.cta_escolhida];
    return `${peca.paragrafo_1}\n\n${peca.paragrafo_2}\n\nCTA: ${ctaEscolhido}`;
  }

  return `${peca.paragrafo_1}\n\n${peca.paragrafo_2}\n\nCTA (Descoberta): ${peca.cta_descoberta}\nCTA (Relacionamento): ${peca.cta_relacionamento}\nCTA (Conversão): ${peca.cta_conversao}\nCTA (Remarketing): ${peca.cta_remarketing}`;
}

export async function transformarPecaEmCartao(pecaId: string): Promise<string> {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { data: peca } = await supabase.from("pecas_conteudo").select("*").eq("id", pecaId).maybeSingle();
  if (!peca || (peca as { tenant_id: string }).tenant_id !== tenantId) {
    throw new Error("Peça de conteúdo não encontrada.");
  }
  const pecaTipada = peca as PecaConteudo;

  const { data: ideia } = await supabase
    .from("ideias_conteudo")
    .select("tipo_anuncio")
    .eq("id", pecaTipada.ideia_id)
    .single();
  if (!ideia) {
    throw new Error("Ideia de origem da peça não encontrada.");
  }
  const tipoAnuncio = (ideia as { tipo_anuncio: TipoAnuncio }).tipo_anuncio;

  const projetoId = await obterOuCriarQuadroDeProducao();

  const { data: primeiraColuna } = await supabase
    .from("colunas_kanban")
    .select("id")
    .eq("projeto_id", projetoId)
    .eq("concluido", false)
    .order("ordem", { ascending: true })
    .limit(1)
    .single();

  if (!primeiraColuna) {
    throw new Error("Quadro de produção sem coluna inicial.");
  }

  const { data: tarefa, error } = await supabase
    .from("tarefas")
    .insert({
      tenant_id: tenantId,
      projeto_id: projetoId,
      coluna_id: (primeiraColuna as { id: string }).id,
      titulo: pecaTipada.gancho,
      descricao: descricaoDaPeca(pecaTipada),
      prioridade: "P3",
    })
    .select("id")
    .single();

  if (error || !tarefa) {
    throw new Error(`Falha ao criar o cartão: ${error?.message ?? "sem retorno"}`);
  }

  const tarefaId = (tarefa as { id: string }).id;

  await adicionarEtiquetaNaTarefa(tarefaId, projetoId, ROTULO_TIPO_ANUNCIO[tipoAnuncio]);

  const { error: erroVinculo } = await supabase.from("pecas_conteudo").update({ tarefa_id: tarefaId }).eq("id", pecaId);
  if (erroVinculo) {
    throw new Error(`Cartão criado, mas falha ao vincular à peça: ${erroVinculo.message}`);
  }

  revalidatePath(`/marketing/ideias/${pecaTipada.ideia_id}/copy`);
  revalidatePath(`/projetos/${projetoId}/tarefas`);

  return tarefaId;
}

/** Wrapper sem retorno — `<form action={...}>` exige uma Server Action que
 * devolva `void`; `transformarPecaEmCartao` devolve o id do cartão pra quem
 * chamar programaticamente. */
export async function enviarPecaParaProducao(pecaId: string): Promise<void> {
  await transformarPecaEmCartao(pecaId);
}

export async function obterProjetoIdDaTarefa(tarefaId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("tarefas").select("projeto_id").eq("id", tarefaId).maybeSingle();
  return (data as { projeto_id: string } | null)?.projeto_id ?? null;
}
