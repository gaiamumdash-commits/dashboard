"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import type { CategoriaFinanceira } from "@/lib/ecc/tipos";

function campoObrigatorio(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`Campo obrigatório ausente: ${nome}`);
  }
  return valor.trim();
}

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace mexe no financeiro.");
  }
}

function primeiroDiaDoMes(dataISO: string): string {
  return `${dataISO.slice(0, 7)}-01`;
}

// ---------------------------------------------------------------------------
// Contas fixas (modelo recorrente)
// ---------------------------------------------------------------------------

export async function criarContaFixa(formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const nome = campoObrigatorio(formData, "nome");
  const valorEsperado = Number(campoObrigatorio(formData, "valor_esperado"));
  const diaVencimento = Number(campoObrigatorio(formData, "dia_vencimento"));
  const categoria = campoObrigatorio(formData, "categoria") as CategoriaFinanceira;

  if (!Number.isFinite(valorEsperado) || valorEsperado <= 0) {
    throw new Error("Valor esperado inválido.");
  }
  if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
    throw new Error("Dia de vencimento precisa ser entre 1 e 31.");
  }

  const { error } = await supabase.from("contas_fixas_modelo").insert({
    tenant_id: tenantId,
    nome,
    valor_esperado: valorEsperado,
    dia_vencimento: diaVencimento,
    categoria,
  });

  if (error) {
    throw new Error(`Falha ao criar conta fixa: ${error.message}`);
  }

  revalidatePath("/financeiro");
}

export async function alternarAtivaContaFixa(contaFixaId: string, ativo: boolean) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase.from("contas_fixas_modelo").update({ ativo }).eq("id", contaFixaId);

  if (error) {
    throw new Error(`Falha ao atualizar conta fixa: ${error.message}`);
  }

  revalidatePath("/financeiro");
}

// ---------------------------------------------------------------------------
// Contas a pagar (instâncias — geradas do modelo pelo cron, ou avulsas)
// ---------------------------------------------------------------------------

export async function criarDespesaAvulsa(formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const nome = campoObrigatorio(formData, "nome");
  const valor = Number(campoObrigatorio(formData, "valor"));
  const categoria = campoObrigatorio(formData, "categoria") as CategoriaFinanceira;
  const dataVencimento = campoObrigatorio(formData, "data_vencimento");

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor inválido.");
  }

  const { error } = await supabase.from("contas_a_pagar").insert({
    tenant_id: tenantId,
    conta_fixa_id: null,
    nome,
    valor,
    categoria,
    mes_referencia: primeiroDiaDoMes(dataVencimento),
    data_vencimento: dataVencimento,
  });

  if (error) {
    throw new Error(`Falha ao lançar despesa: ${error.message}`);
  }

  revalidatePath("/financeiro");
}

export async function marcarComoPaga(contaId: string, dataPagamento: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase
    .from("contas_a_pagar")
    .update({ pago: true, data_pagamento: dataPagamento })
    .eq("id", contaId);

  if (error) {
    throw new Error(`Falha ao marcar conta como paga: ${error.message}`);
  }

  revalidatePath("/financeiro");
}

export async function desmarcarComoPaga(contaId: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase
    .from("contas_a_pagar")
    .update({ pago: false, data_pagamento: null })
    .eq("id", contaId);

  if (error) {
    throw new Error(`Falha ao reabrir conta: ${error.message}`);
  }

  revalidatePath("/financeiro");
}
