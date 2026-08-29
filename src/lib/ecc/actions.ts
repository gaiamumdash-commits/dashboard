"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { exportarMetaSmartMarkdown } from "@/lib/ecc-export/metas";
import type { Horizonte, MetaSmart, Prioridade, StatusProjeto, StatusTarefa } from "@/lib/ecc/tipos";

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

// ---------------------------------------------------------------------------
// Módulo 1 — Projetos
// ---------------------------------------------------------------------------

export async function criarProjeto(formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const nome = campoObrigatorio(formData, "nome");
  const descricao = (formData.get("descricao") as string | null)?.trim() || null;

  const { error } = await supabase.from("projetos").insert({ tenant_id: tenantId, nome, descricao });

  if (error) {
    throw new Error(`Falha ao criar projeto: ${error.message}`);
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

// ---------------------------------------------------------------------------
// Módulo 2 — Tarefas (Kanban)
// ---------------------------------------------------------------------------

export async function criarTarefa(projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const titulo = campoObrigatorio(formData, "titulo");
  const prioridade = (formData.get("prioridade") as Prioridade | null) ?? "P3";
  const tag = (formData.get("tag") as string | null)?.trim() || null;
  const dataLimite = (formData.get("data_limite") as string | null) || null;

  const { error } = await supabase.from("tarefas").insert({
    tenant_id: tenantId,
    projeto_id: projetoId,
    titulo,
    prioridade,
    tag,
    data_limite: dataLimite,
  });

  if (error) {
    throw new Error(`Falha ao criar tarefa: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function moverTarefa(tarefaId: string, projetoId: string, novoStatus: StatusTarefa) {
  const supabase = await createClient();
  const { error } = await supabase.from("tarefas").update({ status: novoStatus }).eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao mover tarefa: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function deletarTarefa(tarefaId: string, projetoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tarefas").delete().eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao excluir tarefa: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}
