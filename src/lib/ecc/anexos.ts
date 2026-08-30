"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import type { Anexo, EntidadeAnexo } from "@/lib/ecc/tipos";

const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024; // 15MB — arquivo maior, o Fabio linka com Google Drive.

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace mexe em anexos do financeiro.");
  }
}

export async function listarAnexos(entidadeTipo: EntidadeAnexo, entidadeId: string): Promise<Anexo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("anexos")
    .select("*")
    .eq("entidade_tipo", entidadeTipo)
    .eq("entidade_id", entidadeId)
    .order("criado_em", { ascending: false });

  return (data as Anexo[] | null) ?? [];
}

export async function enviarAnexoContaAPagar(contaId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    throw new Error("Selecione um arquivo.");
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error("Arquivo maior que 15MB — linke com o Google Drive em vez de anexar aqui.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const nomeSanitizado = arquivo.name.replace(/[^\w.\-]/g, "_");
  const storagePath = `${tenantId}/conta_a_pagar/${contaId}/${Date.now()}-${nomeSanitizado}`;

  const { error: erroUpload } = await supabase.storage.from("anexos").upload(storagePath, arquivo, {
    contentType: arquivo.type || "application/octet-stream",
  });

  if (erroUpload) {
    throw new Error(`Falha ao enviar arquivo: ${erroUpload.message}`);
  }

  const { error: erroMetadados } = await supabase.from("anexos").insert({
    tenant_id: tenantId,
    entidade_tipo: "conta_a_pagar",
    entidade_id: contaId,
    storage_path: storagePath,
    nome_arquivo: arquivo.name,
    tamanho_bytes: arquivo.size,
    tipo_mime: arquivo.type || "application/octet-stream",
    enviado_por: user.id,
  });

  if (erroMetadados) {
    // Some o arquivo órfão do storage se não conseguiu gravar o metadado.
    await supabase.storage.from("anexos").remove([storagePath]);
    throw new Error(`Falha ao registrar anexo: ${erroMetadados.message}`);
  }

  revalidatePath("/financeiro");
}

export async function enviarAnexoTarefa(tarefaId: string, projetoId: string, formData: FormData) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    throw new Error("Selecione um arquivo.");
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error("Arquivo maior que 15MB — linke com o Google Drive em vez de anexar aqui.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const nomeSanitizado = arquivo.name.replace(/[^\w.\-]/g, "_");
  const storagePath = `${tenantId}/tarefa/${tarefaId}/${Date.now()}-${nomeSanitizado}`;

  const { error: erroUpload } = await supabase.storage.from("anexos").upload(storagePath, arquivo, {
    contentType: arquivo.type || "application/octet-stream",
  });

  if (erroUpload) {
    throw new Error(`Falha ao enviar arquivo: ${erroUpload.message}`);
  }

  const { error: erroMetadados } = await supabase.from("anexos").insert({
    tenant_id: tenantId,
    entidade_tipo: "tarefa",
    entidade_id: tarefaId,
    storage_path: storagePath,
    nome_arquivo: arquivo.name,
    tamanho_bytes: arquivo.size,
    tipo_mime: arquivo.type || "application/octet-stream",
    enviado_por: user.id,
  });

  if (erroMetadados) {
    await supabase.storage.from("anexos").remove([storagePath]);
    throw new Error(`Falha ao registrar anexo: ${erroMetadados.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function removerAnexo(anexoId: string, caminhoRevalidar: string) {
  const supabase = await createClient();

  const { data: anexo, error: erroBusca } = await supabase
    .from("anexos")
    .select("storage_path")
    .eq("id", anexoId)
    .maybeSingle();

  if (erroBusca || !anexo) {
    throw new Error("Anexo não encontrado.");
  }

  await supabase.storage.from("anexos").remove([anexo.storage_path]);

  const { error } = await supabase.from("anexos").delete().eq("id", anexoId);

  if (error) {
    throw new Error(`Falha ao remover anexo: ${error.message}`);
  }

  revalidatePath(caminhoRevalidar);
}

export async function urlAssinadaDoAnexo(storagePath: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("anexos").createSignedUrl(storagePath, 60 * 10);

  if (error || !data) {
    throw new Error(`Falha ao gerar link do anexo: ${error?.message}`);
  }

  return data.signedUrl;
}
