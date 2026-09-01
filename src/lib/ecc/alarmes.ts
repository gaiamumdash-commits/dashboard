"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import type { Alarme, EntidadeAlarme } from "@/lib/ecc/tipos";

/** Busca o alarme já configurado pra uma entidade, se existir — usado pra
 * pré-selecionar o dropdown do `<CampoAlarme>` ao reabrir um item. */
export async function obterAlarme(
  entidadeTipo: EntidadeAlarme,
  entidadeId: string,
): Promise<Alarme | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("alarmes")
    .select("*")
    .eq("entidade_tipo", entidadeTipo)
    .eq("entidade_id", entidadeId)
    .maybeSingle();

  return (data as Alarme | null) ?? null;
}

/** Cria/atualiza (upsert por `entidade_tipo, entidade_id`) o alarme de um
 * item. `antecedenciaMin` vazio/"0" remove o alarme — mais simples do que
 * um botão de excluir separado no formulário. A RLS de `alarmes` já
 * verifica se este usuário pode mesmo alarmar esta entidade (owner pra
 * conta a pagar, acesso ao projeto pra tarefa, etc.) — não precisa
 * revalidar aqui. */
export async function salvarAlarme(formData: FormData) {
  const tenantId = await garantirWorkspace();
  const user = await obterUsuarioAtual();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const entidadeTipo = String(formData.get("entidade_tipo") ?? "") as EntidadeAlarme;
  const entidadeId = String(formData.get("entidade_id") ?? "");
  const antecedenciaMin = Number(formData.get("antecedencia_min") ?? 0);
  const caminhoRevalidar = String(formData.get("caminho_revalidar") ?? "/agenda");

  if (!entidadeId) {
    throw new Error("Entidade do alarme não informada.");
  }

  const supabase = await createClient();

  if (!antecedenciaMin) {
    const { error } = await supabase
      .from("alarmes")
      .delete()
      .eq("entidade_tipo", entidadeTipo)
      .eq("entidade_id", entidadeId);
    if (error) throw new Error(`Falha ao remover alarme: ${error.message}`);
  } else {
    const { error } = await supabase.from("alarmes").upsert(
      {
        tenant_id: tenantId,
        entidade_tipo: entidadeTipo,
        entidade_id: entidadeId,
        antecedencia_min: antecedenciaMin,
        criado_por: user.id,
        // Se o alarme já tinha disparado antes, mudar a antecedência deve
        // permitir disparar de novo pra data atual — sem isso, um alarme já
        // usado ficaria "queimado" mesmo depois de reconfigurado.
        disparado_em: null,
        disparado_para_referencia: null,
      },
      { onConflict: "entidade_tipo,entidade_id" },
    );
    if (error) throw new Error(`Falha ao salvar alarme: ${error.message}`);
  }

  revalidatePath(caminhoRevalidar);
}
