"use server";

import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import type { Decisao } from "@/lib/ecc/tipos";

function campoObrigatorio(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`Campo obrigatório ausente: ${nome}`);
  }
  return valor.trim();
}

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace mexe em decisões.");
  }
}

export async function listarDecisoesDoProjeto(projetoId: string): Promise<Decisao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("decisoes")
    .select("*")
    .eq("projeto_id", projetoId)
    .order("data", { ascending: false });

  if (error) {
    throw new Error(`Falha ao listar decisões: ${error.message}`);
  }

  return (data as Decisao[] | null) ?? [];
}

export async function criarDecisao(projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();
  const user = await obterUsuarioAtual();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const titulo = campoObrigatorio(formData, "titulo");
  const decisao = campoObrigatorio(formData, "decisao");
  const motivo = campoObrigatorio(formData, "motivo");
  const impactoEsperado = campoObrigatorio(formData, "impacto_esperado");
  const metaSmartId = (formData.get("meta_smart_id") as string | null) || null;
  const data = (formData.get("data") as string | null) || new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("decisoes").insert({
    tenant_id: tenantId,
    projeto_id: projetoId,
    meta_smart_id: metaSmartId,
    titulo,
    decisao,
    motivo,
    impacto_esperado: impactoEsperado,
    autor: user.id,
    data,
  });

  if (error) {
    throw new Error(`Falha ao criar decisão: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/decisoes`);
}

export async function editarDecisao(decisaoId: string, projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const titulo = campoObrigatorio(formData, "titulo");
  const decisao = campoObrigatorio(formData, "decisao");
  const motivo = campoObrigatorio(formData, "motivo");
  const impactoEsperado = campoObrigatorio(formData, "impacto_esperado");
  const metaSmartId = (formData.get("meta_smart_id") as string | null) || null;
  const data = campoObrigatorio(formData, "data");

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
    .eq("id", decisaoId);

  if (error) {
    throw new Error(`Falha ao editar decisão: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/decisoes`);
}

export async function excluirDecisao(decisaoId: string, projetoId: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase.from("decisoes").delete().eq("id", decisaoId);

  if (error) {
    throw new Error(`Falha ao excluir decisão: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/decisoes`);
}
