"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { lerValorMonetario, primeiroDiaDoMesDe, validarNovaReceita } from "@/lib/ecc/receitas-regras";

/** Receitas (migration 0054) — mesmo padrão de `financeiro.ts`: owner-only
 * checado aqui E pela RLS (o navegador nunca é fonte de autorização). */

async function exigirOwner(tenantId: string) {
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    throw new Error("Só o dono do workspace mexe no financeiro.");
  }
}

/** Caminhos que mostram receitas: a lista, o resumo do Financeiro e o card
 * "Financeiro do mês" do Painel geral. */
function revalidarReceitas() {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/receitas");
  revalidatePath("/");
}

export async function criarReceita(formData: FormData) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);

  const validado = validarNovaReceita({
    descricao: formData.get("descricao") as string | null,
    valor: formData.get("valor") as string | null,
    dataPrevista: formData.get("data_prevista") as string | null,
    categoria: formData.get("categoria") as string | null,
    projetoId: formData.get("projeto_id") as string | null,
  });
  if (!validado.ok) {
    throw new Error(validado.mensagem);
  }

  const { descricao, valor, dataPrevista, mesReferencia, categoria, projetoId } = validado.receita;
  const supabase = await createClient();

  const { error } = await supabase.from("receitas").insert({
    tenant_id: tenantId,
    descricao,
    valor,
    data_prevista: dataPrevista,
    mes_referencia: mesReferencia,
    categoria,
    projeto_id: projetoId,
  });

  if (error) {
    throw new Error(`Falha ao lançar receita: ${error.message}`);
  }

  revalidarReceitas();
}

/** Corrige valor e data prevista. Diferente de `atualizarValorEVencimento`
 * (contas a pagar), aqui `mes_referencia` ACOMPANHA a data: receita não tem
 * cron gerando por mês, então se o cliente atrasou o pagamento pro mês
 * seguinte, a entrada tem que passar a contar no mês seguinte. */
export async function atualizarValorEDataReceita(receitaId: string, valorBruto: string, dataPrevista: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);

  const valor = lerValorMonetario(valorBruto);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor inválido.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPrevista)) {
    throw new Error("Data inválida.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("receitas")
    .update({
      valor: Math.round(valor * 100) / 100,
      data_prevista: dataPrevista,
      mes_referencia: primeiroDiaDoMesDe(dataPrevista),
    })
    .eq("id", receitaId);

  if (error) {
    throw new Error(`Falha ao atualizar receita: ${error.message}`);
  }

  revalidarReceitas();
}

export async function marcarComoRecebida(receitaId: string, dataRecebimento: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase
    .from("receitas")
    .update({ recebida: true, data_recebimento: dataRecebimento })
    .eq("id", receitaId);

  if (error) {
    throw new Error(`Falha ao marcar receita como recebida: ${error.message}`);
  }

  revalidarReceitas();
}

export async function desmarcarComoRecebida(receitaId: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase
    .from("receitas")
    .update({ recebida: false, data_recebimento: null })
    .eq("id", receitaId);

  if (error) {
    throw new Error(`Falha ao reabrir receita: ${error.message}`);
  }

  revalidarReceitas();
}

/** Uma receita lançada por engano (ou um trabalho que não fechou) inflaria
 * "Entradas" e o saldo previsto pra sempre — por isso dá pra apagar. */
export async function excluirReceita(receitaId: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase.from("receitas").delete().eq("id", receitaId);

  if (error) {
    throw new Error(`Falha ao excluir receita: ${error.message}`);
  }

  revalidarReceitas();
}
