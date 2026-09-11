"use server";

import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirTenantLab } from "@/lib/ecc/lab/tenant";
import { marcarPassoConcluido, MODULO_FINANCEIRO } from "@/lib/ecc/lab/progresso";
import type { CategoriaFinanceira } from "@/lib/ecc/tipos";

/** Espelha src/lib/ecc/financeiro.ts função a função (mesma validação, mesmo
 * cálculo de mes_referencia), trocando garantirWorkspace()+exigirOwner() por
 * só garantirTenantLab() — mesmo cuidado das outras Server Actions Lab-aware
 * (decisoes-indicadores.ts, actions.ts): usar as reais aqui gravaria o dado
 * fictício no tenant REAL do usuário. Todas as escritas levam .eq("tenant_id",
 * tenantIdLab) como defesa em profundidade, além da RLS já herdada. */

function campoObrigatorio(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`Campo obrigatório ausente: ${nome}`);
  }
  return valor.trim();
}

async function exigirUsuario() {
  const user = await obterUsuarioAtual();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }
  return user;
}

function primeiroDiaDoMes(dataISO: string): string {
  return `${dataISO.slice(0, 7)}-01`;
}

export async function criarDespesaAvulsaLab(formData: FormData): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const nome = campoObrigatorio(formData, "nome");
  const valor = Number(campoObrigatorio(formData, "valor"));
  const categoria = campoObrigatorio(formData, "categoria") as CategoriaFinanceira;
  const dataVencimento = campoObrigatorio(formData, "data_vencimento");

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor inválido.");
  }

  const { error } = await supabase.from("contas_a_pagar").insert({
    tenant_id: tenantIdLab,
    conta_fixa_id: null,
    nome,
    valor,
    categoria,
    mes_referencia: primeiroDiaDoMes(dataVencimento),
    data_vencimento: dataVencimento,
  });

  if (error) {
    throw new Error(`Falha ao lançar despesa do Lab: ${error.message}`);
  }

  revalidatePath("/lab/financeiro");
}

/** Gera uma conta a pagar a partir de uma tarefa do quadro fictício — mesmo
 * espírito de gerarContaAPagarDaTarefa (financeiro.ts): índice único parcial
 * em contas_a_pagar.tarefa_id garante que não dá pra gerar duas vezes. */
export async function gerarContaAPagarDaTarefaLab(
  tarefaId: string,
  projetoId: string,
  formData: FormData,
): Promise<void> {
  const user = await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const nome = campoObrigatorio(formData, "nome");
  const valor = Number(campoObrigatorio(formData, "valor"));
  const categoria = campoObrigatorio(formData, "categoria") as CategoriaFinanceira;
  const dataVencimento = campoObrigatorio(formData, "data_vencimento");

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor inválido.");
  }

  const { error } = await supabase.from("contas_a_pagar").insert({
    tenant_id: tenantIdLab,
    conta_fixa_id: null,
    tarefa_id: tarefaId,
    nome,
    valor,
    categoria,
    mes_referencia: primeiroDiaDoMes(dataVencimento),
    data_vencimento: dataVencimento,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Essa tarefa já tem uma conta gerada.");
    }
    throw new Error(`Falha ao lançar despesa do Lab: ${error.message}`);
  }

  await marcarPassoConcluido(user.id, "gerar_conta_a_pagar", MODULO_FINANCEIRO);
  revalidatePath("/lab/financeiro");
}

/** Gera uma conta a pagar a partir de uma decisão do Lab — mesmo espírito de
 * gerarContaAPagarDaDecisao (financeiro.ts). */
export async function gerarContaAPagarDaDecisaoLab(
  decisaoId: string,
  projetoId: string,
  formData: FormData,
): Promise<void> {
  const user = await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const nome = campoObrigatorio(formData, "nome");
  const valor = Number(campoObrigatorio(formData, "valor"));
  const categoria = campoObrigatorio(formData, "categoria") as CategoriaFinanceira;
  const dataVencimento = campoObrigatorio(formData, "data_vencimento");

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor inválido.");
  }

  const { error } = await supabase.from("contas_a_pagar").insert({
    tenant_id: tenantIdLab,
    conta_fixa_id: null,
    decisao_id: decisaoId,
    nome,
    valor,
    categoria,
    mes_referencia: primeiroDiaDoMes(dataVencimento),
    data_vencimento: dataVencimento,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Essa decisão já tem uma conta gerada.");
    }
    throw new Error(`Falha ao lançar despesa do Lab: ${error.message}`);
  }

  await marcarPassoConcluido(user.id, "gerar_conta_a_pagar", MODULO_FINANCEIRO);
  revalidatePath("/lab/financeiro");
}

export async function atualizarValorEVencimentoLab(
  contaId: string,
  valor: number,
  dataVencimento: string,
): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor inválido.");
  }

  const { error } = await supabase
    .from("contas_a_pagar")
    .update({ valor, data_vencimento: dataVencimento })
    .eq("id", contaId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao atualizar conta do Lab: ${error.message}`);
  }

  revalidatePath("/lab/financeiro");
}

export async function marcarComoPagaLab(contaId: string, dataPagamento: string): Promise<void> {
  const user = await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const { error } = await supabase
    .from("contas_a_pagar")
    .update({ pago: true, data_pagamento: dataPagamento })
    .eq("id", contaId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao marcar conta do Lab como paga: ${error.message}`);
  }

  await marcarPassoConcluido(user.id, "marcar_conta_paga", MODULO_FINANCEIRO);
  revalidatePath("/lab/financeiro");
}

export async function desmarcarComoPagaLab(contaId: string): Promise<void> {
  await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const { error } = await supabase
    .from("contas_a_pagar")
    .update({ pago: false, data_pagamento: null })
    .eq("id", contaId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao reabrir conta do Lab: ${error.message}`);
  }

  revalidatePath("/lab/financeiro");
}

/** Espelha atualizarValorEstimadoTarefa (actions.ts) — só marca o passo do
 * roteiro quando um valor é de fato preenchido, nunca ao limpar o campo. */
export async function atualizarValorEstimadoTarefaLab(
  tarefaId: string,
  projetoId: string,
  valor: number | null,
): Promise<void> {
  const user = await exigirUsuario();
  const tenantIdLab = await garantirTenantLab();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tarefas")
    .update({ valor_estimado: valor })
    .eq("id", tarefaId)
    .eq("tenant_id", tenantIdLab);

  if (error) {
    throw new Error(`Falha ao atualizar valor estimado do Lab: ${error.message}`);
  }

  if (valor !== null) {
    await marcarPassoConcluido(user.id, "marcar_valor_estimado", MODULO_FINANCEIRO);
  }
  revalidatePath("/lab/financeiro");
}
