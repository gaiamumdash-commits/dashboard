"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import type { CorEtiqueta, Etiqueta } from "@/lib/ecc/tipos";

const SEQUENCIA_CORES: CorEtiqueta[] = ["purple", "teal", "yellow", "blue", "coral", "lime"];

export async function listarEtiquetasDoTenant(tenantId: string): Promise<Etiqueta[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("etiquetas").select("*").eq("tenant_id", tenantId).order("nome");
  return (data as Etiqueta[] | null) ?? [];
}

/** Anexa uma etiqueta na tarefa pelo nome — reaproveita se já existir
 * (case-insensitive) no workspace, ou cria uma nova com a próxima cor da
 * sequência de 6. Dá mais liberdade sem duplicar etiqueta por causa de
 * maiúscula/minúscula diferente. */
export async function adicionarEtiquetaNaTarefa(tarefaId: string, projetoId: string, nome: string) {
  const tenantId = await garantirWorkspace();
  const supabase = await createClient();
  const nomeLimpo = nome.trim();

  if (!nomeLimpo) {
    throw new Error("Informe um nome pra etiqueta.");
  }

  const { data: existente } = await supabase
    .from("etiquetas")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("nome", nomeLimpo)
    .maybeSingle();

  let etiquetaId = existente?.id as string | undefined;

  if (!etiquetaId) {
    const { count } = await supabase
      .from("etiquetas")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    const cor = SEQUENCIA_CORES[(count ?? 0) % SEQUENCIA_CORES.length];

    const { data: nova, error: erroCriar } = await supabase
      .from("etiquetas")
      .insert({ tenant_id: tenantId, nome: nomeLimpo, cor })
      .select("id")
      .single();

    if (erroCriar || !nova) {
      throw new Error(`Falha ao criar etiqueta: ${erroCriar?.message}`);
    }

    etiquetaId = nova.id as string;
  }

  const { error } = await supabase
    .from("tarefa_etiquetas")
    .insert({ tenant_id: tenantId, tarefa_id: tarefaId, etiqueta_id: etiquetaId });

  if (error && error.code !== "23505") {
    throw new Error(`Falha ao anexar etiqueta: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function removerEtiquetaDaTarefa(tarefaId: string, etiquetaId: string, projetoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tarefa_etiquetas")
    .delete()
    .eq("tarefa_id", tarefaId)
    .eq("etiqueta_id", etiquetaId);

  if (error) {
    throw new Error(`Falha ao remover etiqueta: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}
