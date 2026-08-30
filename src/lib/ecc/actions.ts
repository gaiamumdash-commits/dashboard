"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { exportarMetaSmartMarkdown } from "@/lib/ecc-export/metas";
import type { Horizonte, MetaSmart, Papel, Prioridade, StatusProjeto, StatusTarefa } from "@/lib/ecc/tipos";

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

  // Cada linha do texto vira uma tarefa: cola uma lista pronta, sai um
  // cartão por item, sem precisar criar um por um.
  const titulos = campoObrigatorio(formData, "titulo")
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);

  if (titulos.length === 0) {
    throw new Error("Informe ao menos um título de tarefa.");
  }

  const prioridade = (formData.get("prioridade") as Prioridade | null) ?? "P3";
  const tag = (formData.get("tag") as string | null)?.trim() || null;
  const dataInicio = (formData.get("data_inicio") as string | null) || null;
  const dataLimite = (formData.get("data_limite") as string | null) || null;

  const linhas = titulos.map((titulo) => ({
    tenant_id: tenantId,
    projeto_id: projetoId,
    titulo,
    prioridade,
    tag,
    data_inicio: dataInicio,
    data_limite: dataLimite,
  }));

  const { error } = await supabase.from("tarefas").insert(linhas);

  if (error) {
    throw new Error(`Falha ao criar tarefa: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function atualizarDescricaoTarefa(tarefaId: string, projetoId: string, formData: FormData) {
  const supabase = await createClient();
  const descricao = (formData.get("descricao") as string | null)?.trim() || null;

  const { error } = await supabase.from("tarefas").update({ descricao }).eq("id", tarefaId);

  if (error) {
    throw new Error(`Falha ao salvar descrição: ${error.message}`);
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
  } else {
    const { error } = await supabase
      .from("tarefa_membros")
      .insert({ tenant_id: tenantId, tarefa_id: tarefaId, user_id: userId });
    if (error) throw new Error(`Falha ao adicionar membro à tarefa: ${error.message}`);
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

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function alternarChecklistItem(itemId: string, concluido: boolean, projetoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tarefa_checklist_itens").update({ concluido }).eq("id", itemId);

  if (error) {
    throw new Error(`Falha ao atualizar item do checklist: ${error.message}`);
  }

  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

export async function removerChecklistItem(itemId: string, projetoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tarefa_checklist_itens").delete().eq("id", itemId);

  if (error) {
    throw new Error(`Falha ao remover item do checklist: ${error.message}`);
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

  // Convite de projeto sempre entra como "member" do tenant, com escopo
  // "projeto" — não enxerga Metas SMART nem Equipe do workspace inteiro,
  // só o(s) quadro(s) em que foi colocado via projeto_membros.
  const papelTenant = convite.projeto_id ? "member" : convite.papel;
  const escopo = convite.projeto_id ? "projeto" : "completo";

  const { error: erroMembership } = await service
    .from("memberships")
    .insert({ user_id: user.id, tenant_id: convite.tenant_id, papel: papelTenant, escopo });

  if (erroMembership && erroMembership.code !== "23505") {
    throw new Error(`Falha ao entrar no workspace: ${erroMembership.message}`);
  }

  if (convite.projeto_id) {
    const { error: erroProjetoMembro } = await service.from("projeto_membros").insert({
      tenant_id: convite.tenant_id,
      projeto_id: convite.projeto_id,
      user_id: user.id,
      papel: "usuario",
    });

    if (erroProjetoMembro && erroProjetoMembro.code !== "23505") {
      throw new Error(`Falha ao entrar no quadro: ${erroProjetoMembro.message}`);
    }
  }

  await service.from("convites").update({ status: "aceito" }).eq("id", convite.id);

  redirect("/projetos");
}
