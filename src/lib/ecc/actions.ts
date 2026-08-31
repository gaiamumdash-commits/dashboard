"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { vincularUsuarioAoConvite } from "@/lib/ecc/equipe";
import { registrarAtividade } from "@/lib/ecc/atividade";
import { eSouGestorDoProjeto, listarMembrosComAcessoAoProjeto, obterPapelAtual } from "@/lib/ecc/equipe";
import { exportarMetaSmartMarkdown } from "@/lib/ecc-export/metas";
import { enviarEmailConsolidacao, type ItemConsolidacao, type SecaoConsolidacao } from "@/lib/ecc/notificacoes";
import type {
  AtividadeTarefa,
  CorEtiqueta,
  Convite,
  Horizonte,
  MetaSmart,
  Papel,
  Prioridade,
  StatusProjeto,
  Tarefa,
} from "@/lib/ecc/tipos";

function campoObrigatorio(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`Campo obrigatório ausente: ${nome}`);
  }
  return valor.trim();
}

// ---------------------------------------------------------------------------
// Módulo 0 — Onboarding & Metas SMART
// ---------------------------------------------------------------------------

export async function criarMetasSmart(formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const horizontes: Horizonte[] = ["medio_prazo", "longo_prazo"];
  const linhas = horizontes.map((horizonte) => ({
    tenant_id: tenantId,
    horizonte,
    visao_macro: campoObrigatorio(formData, `${horizonte}_visao_macro`),
    specific: campoObrigatorio(formData, `${horizonte}_specific`),
    measurable: campoObrigatorio(formData, `${horizonte}_measurable`),
    attainable: campoObrigatorio(formData, `${horizonte}_attainable`),
    relevant: campoObrigatorio(formData, `${horizonte}_relevant`),
    time_bound: campoObrigatorio(formData, `${horizonte}_time_bound`),
  }));

  const { data: metasCriadas, error } = await supabase
    .from("metas_smart")
    .insert(linhas)
    .select("*");

  if (error) {
    throw new Error(`Falha ao salvar metas SMART: ${error.message}`);
  }

  const { data: tenant } = await supabase.from("tenants").select("nome").eq("id", tenantId).single();
  const nomeWorkspace = tenant?.nome ?? "Gaiamum";

  for (const meta of (metasCriadas ?? []) as MetaSmart[]) {
    await exportarMetaSmartMarkdown(meta, nomeWorkspace);
  }

  redirect("/projetos");
}

export async function pularOnboarding() {
  redirect("/projetos");
}

// ---------------------------------------------------------------------------
// Módulo 1 — Projetos
// ---------------------------------------------------------------------------

export async function criarProjeto(formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace pode criar projetos novos.");
  }

  const nome = campoObrigatorio(formData, "nome");
  const descricao = (formData.get("descricao") as string | null)?.trim() || null;

  const { data: projeto, error } = await supabase
    .from("projetos")
    .insert({ tenant_id: tenantId, nome, descricao })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Falha ao criar projeto: ${error.message}`);
  }

  // Quem cria o quadro vira o gestor dele — só o gestor pode apagar
  // cartão ou quadro depois.
  const { error: erroMembro } = await supabase
    .from("projeto_membros")
    .insert({ tenant_id: tenantId, projeto_id: projeto.id, user_id: user.id, papel: "gestor" });

  if (erroMembro) {
    throw new Error(`Projeto criado, mas falha ao definir gestor: ${erroMembro.message}`);
  }

  // Todo projeto novo nasce com as 3 colunas padrão — "Concluído" fixa,
  // as outras duas o usuário pode renomear ou apagar depois.
  const { error: erroColunas } = await supabase.from("colunas_kanban").insert([
    { tenant_id: tenantId, projeto_id: projeto.id, nome: "Em Aberto", ordem: 0, concluido: false },
    { tenant_id: tenantId, projeto_id: projeto.id, nome: "Em Desenvolvimento", ordem: 1, concluido: false },
    { tenant_id: tenantId, projeto_id: projeto.id, nome: "Concluído", ordem: 0, concluido: true },
  ]);

  if (erroColunas) {
    throw new Error(`Projeto criado, mas falha ao criar colunas padrão: ${erroColunas.message}`);
  }

  revalidatePath("/projetos");
}

export async function atualizarStatusProjeto(projetoId: string, status: StatusProjeto) {
  const supabase = await createClient();
  const { error } = await supabase.from("projetos").update({ status }).eq("id", projetoId);

  if (error) {
    throw new Error(`Falha ao atualizar status do projeto: ${error.message}`);
  }

  revalidatePath("/projetos");
}

export async function deletarProjeto(projetoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projetos").delete().eq("id", projetoId);

  if (error) {
    throw new Error(`Falha ao excluir projeto: ${error.message}`);
  }

  revalidatePath("/projetos");
}

async function exigirGestorOuOwner(tenantId: string, projetoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const souOwner = (await obterPapelAtual(tenantId)) === "owner";
  const souGestor = Boolean(user) && (await eSouGestorDoProjeto(projetoId, user!.id));

  if (!souOwner && !souGestor) {
    throw new Error("Só o gestor do projeto (ou o dono do workspace) mexe nas configurações do quadro.");
  }
}

export async function renomearProjeto(projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);
  const supabase = await createClient();
  const nome = campoObrigatorio(formData, "nome");

  const { error } = await supabase.from("projetos").update({ nome }).eq("id", projetoId);

  if (error) {
    throw new Error(`Falha ao renomear projeto: ${error.message}`);
  }

  revalidatePath("/projetos");
  revalidatePath(`/projetos/${projetoId}/tarefas`);
  revalidatePath(`/projetos/${projetoId}/configuracoes`);
}

export async function mudarCorProjeto(projetoId: string, cor: CorEtiqueta) {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);
  const supabase = await createClient();

  const { error } = await supabase.from("projetos").update({ cor_fundo: cor }).eq("id", projetoId);

  if (error) {
    throw new Error(`Falha ao mudar cor do quadro: ${error.message}`);
  }

  revalidatePath("/projetos");
  revalidatePath(`/projetos/${projetoId}/tarefas`);
  revalidatePath(`/projetos/${projetoId}/configuracoes`);
}

export async function alternarArquivadoProjeto(projetoId: string, arquivado: boolean) {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);
  const supabase = await createClient();

  const { error } = await supabase.from("projetos").update({ arquivado }).eq("id", projetoId);

  if (error) {
    throw new Error(`Falha ao ${arquivado ? "arquivar" : "desarquivar"} projeto: ${error.message}`);
  }

  revalidatePath("/projetos");
}

// ---------------------------------------------------------------------------
// Módulo 2 — Tarefas (Kanban)
// ---------------------------------------------------------------------------

export async function criarTarefa(projetoId: string, colunaId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  // Cada linha do texto vira uma tarefa: cola uma lista pronta, sai um
  // cartão por item, sem precisar criar um por um.
  const titulos = campoObrigatorio(formData, "titulo")
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);

  if (titulos.length === 0) {
    throw new Error("Informe ao menos um título de tarefa.");
  }

  // Criação rápida: só o título agora, o resto (prioridade, tag, datas) o
  // usuário preenche depois abrindo o cartão.
  const linhas = titulos.map((titulo) => ({
    tenant_id: tenantId,
    projeto_id: projetoId,
    coluna_id: colunaId,
    titulo,
    prioridade: "P3" as Prioridade,
  }));

  const { data: criadas, error } = await supabase.from("tarefas").insert(linhas).select("id");

  if (error) {
    throw new Error(`Falha ao criar tarefa: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);

  // Devolve o id do primeiro cartão criado — a UI abre ele direto pra
  // configurar (prioridade, data, etiqueta, etc.), sem precisar de um
  // segundo clique.
  return (criadas?.[0]?.id as string | undefined) ?? null;
}

export async function atualizarDescricaoTarefa(tarefaId: string, projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const descricao = (formData.get("descricao") as string | null)?.trim() || null;

  const { error } = await supabase.from("tarefas").update({ descricao }).eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao salvar descrição: ${error.message}`);
  }

  await registrarAtividade({ tenantId, projetoId, tarefaId, tipo: "descricao_editada" });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function atualizarDatasTarefa(tarefaId: string, projetoId: string, formData: FormData) {
  await garantirWorkspace();
  const supabase = await createClient();
  const dataInicio = (formData.get("data_inicio") as string | null) || null;
  const dataLimite = (formData.get("data_limite") as string | null) || null;

  const { error } = await supabase
    .from("tarefas")
    .update({ data_inicio: dataInicio, data_limite: dataLimite })
    .eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao salvar datas: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function atualizarPrioridadeTarefa(tarefaId: string, projetoId: string, prioridade: Prioridade) {
  await garantirWorkspace();
  const supabase = await createClient();

  const { error } = await supabase.from("tarefas").update({ prioridade }).eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao salvar prioridade: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function atualizarTituloTarefa(tarefaId: string, projetoId: string, titulo: string) {
  await garantirWorkspace();
  const supabase = await createClient();
  const tituloLimpo = titulo.trim();

  if (!tituloLimpo) {
    throw new Error("O título não pode ficar vazio.");
  }

  const { error } = await supabase.from("tarefas").update({ titulo: tituloLimpo }).eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao renomear cartão: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function alternarMembroTarefa(tarefaId: string, userId: string, projetoId: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("tarefa_membros")
    .select("id")
    .eq("tarefa_id", tarefaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase.from("tarefa_membros").delete().eq("id", existente.id);
    if (error) throw new Error(`Falha ao remover membro da tarefa: ${error.message}`);
    await registrarAtividade({
      tenantId,
      projetoId,
      tarefaId,
      tipo: "membro_removido",
      notificarTambem: [userId],
    });
  } else {
    const { error } = await supabase
      .from("tarefa_membros")
      .insert({ tenant_id: tenantId, tarefa_id: tarefaId, user_id: userId });
    if (error) throw new Error(`Falha ao adicionar membro à tarefa: ${error.message}`);
    await registrarAtividade({ tenantId, projetoId, tarefaId, tipo: "membro_adicionado" });
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function adicionarChecklistItem(tarefaId: string, projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const texto = campoObrigatorio(formData, "texto");

  const { count } = await supabase
    .from("tarefa_checklist_itens")
    .select("id", { count: "exact", head: true })
    .eq("tarefa_id", tarefaId);

  const { error } = await supabase.from("tarefa_checklist_itens").insert({
    tenant_id: tenantId,
    tarefa_id: tarefaId,
    texto,
    ordem: count ?? 0,
  });

  if (error) {
    throw new Error(`Falha ao adicionar item do checklist: ${error.message}`);
  }

  await registrarAtividade({
    tenantId,
    projetoId,
    tarefaId,
    tipo: "checklist_item_adicionado",
    detalhe: { texto },
  });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function alternarChecklistItem(
  itemId: string,
  tarefaId: string,
  concluido: boolean,
  projetoId: string,
) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("tarefa_checklist_itens")
    .update({ concluido })
    .eq("id", itemId)
    .select("texto")
    .single();

  if (error) {
    throw new Error(`Falha ao atualizar item do checklist: ${error.message}`);
  }

  await registrarAtividade({
    tenantId,
    projetoId,
    tarefaId,
    tipo: concluido ? "checklist_item_concluido" : "checklist_item_reaberto",
    detalhe: { texto: item.texto },
  });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function removerChecklistItem(itemId: string, tarefaId: string, projetoId: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("tarefa_checklist_itens")
    .delete()
    .eq("id", itemId)
    .select("texto")
    .single();

  if (error) {
    throw new Error(`Falha ao remover item do checklist: ${error.message}`);
  }

  await registrarAtividade({
    tenantId,
    projetoId,
    tarefaId,
    tipo: "checklist_item_removido",
    detalhe: { texto: item.texto },
  });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function moverTarefa(tarefaId: string, projetoId: string, novaColunaId: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const { data: tarefaAtual } = await supabase
    .from("tarefas")
    .select("coluna_id")
    .eq("id", tarefaId)
    .maybeSingle();

  const idsColunas = [tarefaAtual?.coluna_id, novaColunaId].filter((id): id is string => Boolean(id));
  const { data: colunas } = await supabase.from("colunas_kanban").select("id, nome").in("id", idsColunas);
  const nomeDe = colunas?.find((c) => c.id === tarefaAtual?.coluna_id)?.nome ?? "?";
  const nomePara = colunas?.find((c) => c.id === novaColunaId)?.nome ?? "?";

  const { error } = await supabase.from("tarefas").update({ coluna_id: novaColunaId }).eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao mover tarefa: ${error.message}`);
  }

  await registrarAtividade({
    tenantId,
    projetoId,
    tarefaId,
    tipo: "movida",
    detalhe: { de: nomeDe, para: nomePara },
  });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

// ---------------------------------------------------------------------------
// Colunas do kanban (configuráveis por projeto — só "Concluído" é fixa)
// ---------------------------------------------------------------------------

export async function criarColuna(projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const nome = campoObrigatorio(formData, "nome");

  const { count } = await supabase
    .from("colunas_kanban")
    .select("id", { count: "exact", head: true })
    .eq("projeto_id", projetoId)
    .eq("concluido", false);

  const { error } = await supabase
    .from("colunas_kanban")
    .insert({ tenant_id: tenantId, projeto_id: projetoId, nome, ordem: count ?? 0 });

  if (error) {
    throw new Error(`Falha ao criar coluna: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function renomearColuna(colunaId: string, projetoId: string, formData: FormData) {
  const supabase = await createClient();
  const nome = campoObrigatorio(formData, "nome");

  const { data: coluna } = await supabase
    .from("colunas_kanban")
    .select("concluido")
    .eq("id", colunaId)
    .maybeSingle();

  if (coluna?.concluido) {
    throw new Error('A coluna "Concluído" é fixa e não pode ser renomeada.');
  }

  const { error } = await supabase.from("colunas_kanban").update({ nome }).eq("id", colunaId);

  if (error) {
    throw new Error(`Falha ao renomear coluna: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function excluirColuna(colunaId: string, projetoId: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const souOwner = (await obterPapelAtual(tenantId)) === "owner";
  const souGestor = Boolean(user) && (await eSouGestorDoProjeto(projetoId, user!.id));

  if (!souOwner && !souGestor) {
    throw new Error("Só o gestor do projeto (ou o dono do workspace) pode apagar uma coluna.");
  }

  const { data: coluna } = await supabase
    .from("colunas_kanban")
    .select("concluido")
    .eq("id", colunaId)
    .maybeSingle();

  if (coluna?.concluido) {
    throw new Error('A coluna "Concluído" é fixa e não pode ser apagada.');
  }

  const { count } = await supabase
    .from("tarefas")
    .select("id", { count: "exact", head: true })
    .eq("coluna_id", colunaId);

  if ((count ?? 0) > 0) {
    throw new Error("Mova ou apague os cartões desta coluna antes de excluí-la.");
  }

  const { error } = await supabase.from("colunas_kanban").delete().eq("id", colunaId);

  if (error) {
    throw new Error(`Falha ao excluir coluna: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function deletarTarefa(tarefaId: string, projetoId: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const souOwner = (await obterPapelAtual(tenantId)) === "owner";
  const souGestor = Boolean(user) && (await eSouGestorDoProjeto(projetoId, user!.id));

  if (!souOwner && !souGestor) {
    throw new Error("Só o gestor do projeto (ou o dono do workspace) pode apagar um cartão.");
  }

  // Registra a exclusão (e avisa os responsáveis por e-mail) antes de
  // apagar de fato — o registro fica no histórico mesmo depois que o
  // cartão some (tarefa_id vira null, mas a atividade permanece).
  await registrarAtividade({ tenantId, projetoId, tarefaId, tipo: "excluida" });

  const { error } = await supabase.from("tarefas").delete().eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao excluir tarefa: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function listarAtividadesDaTarefa(tarefaId: string): Promise<AtividadeTarefa[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefa_atividades")
    .select("*")
    .eq("tarefa_id", tarefaId)
    .order("criado_em", { ascending: false });

  return (data as AtividadeTarefa[] | null) ?? [];
}

export async function comentarNaTarefa(tarefaId: string, projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  const texto = campoObrigatorio(formData, "texto");

  await registrarAtividade({ tenantId, projetoId, tarefaId, tipo: "comentario", detalhe: { texto } });

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

// ---------------------------------------------------------------------------
// Freeze — ponto de situação do quadro, por e-mail pra todo mundo com acesso
// ---------------------------------------------------------------------------

function diasEntre(dataA: Date, dataB: Date): number {
  const umDia = 1000 * 60 * 60 * 24;
  const a = new Date(dataA.getFullYear(), dataA.getMonth(), dataA.getDate());
  const b = new Date(dataB.getFullYear(), dataB.getMonth(), dataB.getDate());
  return Math.round((b.getTime() - a.getTime()) / umDia);
}

export async function enviarConsolidacaoProjeto(projetoId: string): Promise<{ enviados: number }> {
  const tenantId = await garantirWorkspace();
  await exigirGestorOuOwner(tenantId, projetoId);
  const supabase = await createClient();

  const [{ data: projeto }, { data: tarefas }, { data: colunas }, { data: tarefaMembros }, membrosComAcesso] =
    await Promise.all([
      supabase.from("projetos").select("nome").eq("id", projetoId).maybeSingle(),
      supabase.from("tarefas").select("*").eq("projeto_id", projetoId),
      supabase.from("colunas_kanban").select("id, concluido").eq("projeto_id", projetoId),
      supabase.from("tarefa_membros").select("tarefa_id, user_id").eq("tenant_id", tenantId),
      listarMembrosComAcessoAoProjeto(tenantId, projetoId),
    ]);

  const listaTarefas = (tarefas ?? []) as Tarefa[];
  const listaColunas = (colunas ?? []) as { id: string; concluido: boolean }[];
  const hoje = new Date();

  const itensPorTarefa = new Map<string, ItemConsolidacao>();
  for (const tarefa of listaTarefas) {
    const coluna = listaColunas.find((c) => c.id === tarefa.coluna_id);
    const concluido = coluna?.concluido ?? false;
    const diasParaPrazo = tarefa.data_limite ? diasEntre(hoje, new Date(tarefa.data_limite)) : null;

    itensPorTarefa.set(tarefa.id, {
      titulo: tarefa.titulo,
      status: concluido ? "concluido" : diasParaPrazo !== null && diasParaPrazo < 0 ? "atrasado" : "aberto",
      diasEmAberto: Math.max(0, diasEntre(new Date(tarefa.criado_em), hoje)),
      prazoFormatado: tarefa.data_limite
        ? new Date(tarefa.data_limite).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
        : null,
      diasParaPrazo,
    });
  }

  const itensPorResponsavel = new Map<string, ItemConsolidacao[]>();
  const idsComResponsavel = new Set<string>();

  for (const tm of (tarefaMembros ?? []) as { tarefa_id: string; user_id: string }[]) {
    const item = itensPorTarefa.get(tm.tarefa_id);
    if (!item) continue;
    idsComResponsavel.add(tm.tarefa_id);
    const membro = membrosComAcesso.find((m) => m.user_id === tm.user_id);
    const chave = membro?.email ?? "Responsável fora do quadro";
    if (!itensPorResponsavel.has(chave)) itensPorResponsavel.set(chave, []);
    itensPorResponsavel.get(chave)!.push(item);
  }

  const semResponsavel = listaTarefas
    .filter((t) => !idsComResponsavel.has(t.id))
    .map((t) => itensPorTarefa.get(t.id))
    .filter((item): item is ItemConsolidacao => Boolean(item));

  const secoes: SecaoConsolidacao[] = [...itensPorResponsavel.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nomeResponsavel, itens]) => ({ nomeResponsavel, itens }));

  if (semResponsavel.length > 0) {
    secoes.push({ nomeResponsavel: "Sem responsável", itens: semResponsavel });
  }

  const destinatarios = membrosComAcesso.map((m) => m.email);

  await enviarEmailConsolidacao({
    destinatarios,
    nomeProjeto: (projeto?.nome as string | undefined) ?? "Gaiamum",
    secoes,
    projetoId,
  });

  return { enviados: destinatarios.length };
}

// ---------------------------------------------------------------------------
// Colaboração em equipe — convites, membros, permissões
// ---------------------------------------------------------------------------

export async function convidarMembro(formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const email = campoObrigatorio(formData, "email").toLowerCase();
  const papel = (formData.get("papel") as Papel | null) ?? "member";
  const projetoId = (formData.get("projeto_id") as string | null) || null;

  const { error } = await supabase.from("convites").insert({
    tenant_id: tenantId,
    email,
    papel,
    convidado_por: user.id,
    projeto_id: projetoId,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe um convite pendente para esse e-mail.");
    }
    throw new Error(`Falha ao convidar: ${error.message}`);
  }

  revalidatePath("/equipe");
}

export async function cancelarConvite(conviteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("convites").update({ status: "cancelado" }).eq("id", conviteId);

  if (error) {
    throw new Error(`Falha ao cancelar convite: ${error.message}`);
  }

  revalidatePath("/equipe");
}

export async function removerMembro(userId: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Falha ao remover membro: ${error.message}`);
  }

  revalidatePath("/equipe");
}

export async function aceitarConvite(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Você precisa estar logado para aceitar o convite.");
  }

  // Precisa do service client: quem está aceitando ainda não é membro do
  // tenant, então current_tenant_ids() (usado no RLS normal) não alcança
  // esse convite ainda.
  const service = createServiceClient();

  const { data: convite, error: erroConvite } = await service
    .from("convites")
    .select("*")
    .eq("token", token)
    .eq("status", "pendente")
    .maybeSingle();

  if (erroConvite || !convite) {
    throw new Error("Convite inválido ou já utilizado.");
  }

  if (new Date(convite.expira_em) < new Date()) {
    throw new Error("Este convite expirou.");
  }

  if (convite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    throw new Error("Este convite foi feito para outro e-mail.");
  }

  await vincularUsuarioAoConvite(convite as Convite, user.id);

  redirect("/projetos");
}
