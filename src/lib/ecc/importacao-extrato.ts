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

// ---------------------------------------------------------------------------
// Regras de categorização por palavra-chave (usadas na importação de extrato)
// ---------------------------------------------------------------------------

export async function criarRegraCategoria(formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const palavraChave = campoObrigatorio(formData, "palavra_chave");
  const categoria = campoObrigatorio(formData, "categoria") as CategoriaFinanceira;

  const { error } = await supabase
    .from("contas_categoria_regras")
    .insert({ tenant_id: tenantId, palavra_chave: palavraChave, categoria });

  if (error) {
    throw new Error(`Falha ao criar regra: ${error.message}`);
  }

  revalidatePath("/financeiro/importar");
}

export async function removerRegraCategoria(regraId: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase.from("contas_categoria_regras").delete().eq("id", regraId);

  if (error) {
    throw new Error(`Falha ao remover regra: ${error.message}`);
  }

  revalidatePath("/financeiro/importar");
}

// ---------------------------------------------------------------------------
// Confirmação da importação — grava as linhas revisadas como avulsas já pagas
// ---------------------------------------------------------------------------

export type LinhaExtratoConfirmada = {
  nome: string;
  valor: number;
  categoria: CategoriaFinanceira;
  data: string;
};

export async function confirmarImportacaoExtrato(linhas: LinhaExtratoConfirmada[]) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  if (linhas.length === 0) {
    throw new Error("Nenhuma linha pra confirmar.");
  }

  const registros = linhas.map((linha) => ({
    tenant_id: tenantId,
    conta_fixa_id: null,
    nome: linha.nome,
    valor: linha.valor,
    categoria: linha.categoria,
    mes_referencia: `${linha.data.slice(0, 7)}-01`,
    data_vencimento: linha.data,
    data_pagamento: linha.data,
    pago: true,
  }));

  const { error } = await supabase.from("contas_a_pagar").insert(registros);

  if (error) {
    throw new Error(`Falha ao importar extrato: ${error.message}`);
  }

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/importar");
}
