"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import type { Indicador } from "@/lib/ecc/tipos";

function campoObrigatorio(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`Campo obrigatório ausente: ${nome}`);
  }
  return valor.trim();
}

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace mexe em indicadores.");
  }
}

export async function listarIndicadoresDoProjeto(projetoId: string): Promise<Indicador[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("indicadores")
    .select("*")
    .eq("projeto_id", projetoId)
    .order("criado_em", { ascending: true });

  if (error) {
    throw new Error(`Falha ao listar indicadores: ${error.message}`);
  }

  return (data as Indicador[] | null) ?? [];
}

export async function criarIndicador(projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
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
    tenant_id: tenantId,
    projeto_id: projetoId,
    nome,
    valor_atual: valorAtual,
    meta,
    unidade,
  });

  if (error) {
    throw new Error(`Falha ao criar indicador: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/indicadores`);
}

export async function atualizarValorIndicador(indicadorId: string, projetoId: string, valorAtual: number) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  if (!Number.isFinite(valorAtual)) {
    throw new Error("Valor inválido.");
  }

  const { error } = await supabase
    .from("indicadores")
    .update({ valor_atual: valorAtual, atualizado_em: new Date().toISOString() })
    .eq("id", indicadorId);

  if (error) {
    throw new Error(`Falha ao atualizar indicador: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/indicadores`);
}

export async function editarIndicador(indicadorId: string, projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
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
    .eq("id", indicadorId);

  if (error) {
    throw new Error(`Falha ao editar indicador: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/indicadores`);
}

export async function excluirIndicador(indicadorId: string, projetoId: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase.from("indicadores").delete().eq("id", indicadorId);

  if (error) {
    throw new Error(`Falha ao excluir indicador: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/indicadores`);
}
