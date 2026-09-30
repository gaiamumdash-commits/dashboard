"use server";

import { revalidatePath } from "next/cache";
import { createClient, obterUsuarioAtual } from "@/lib/supabase/server";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { ANTECEDENCIA_MIN_VESPERA_CONTA_A_PAGAR, FUSO_BRASIL } from "@/lib/ecc/kanban";
import type { CategoriaFinanceira, ContaAPagar, FormaPagamento } from "@/lib/ecc/tipos";

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

/** Cria automaticamente o alarme de "véspera" (ver `ANTECEDENCIA_MIN_VESPERA_CONTA_A_PAGAR`)
 * pra uma conta a pagar recém-criada — pedido do Fabio, 2026-09-29: nenhuma
 * conta deveria vencer "de surpresa", o alarme (e o e-mail que ele já dispara
 * via `disparar-alarmes`, sistema existente) sai de fábrica em toda conta
 * nova. Silencioso em erro: uma falha aqui não deve derrubar o lançamento da
 * despesa, só fica sem o aviso automático (o Fabio ainda pode configurar um
 * manualmente pelo `<CampoAlarme>`). */
async function criarAlarmeVesperaAutomatico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  contaId: string,
) {
  const user = await obterUsuarioAtual();
  if (!user) return;

  const { error } = await supabase.from("alarmes").upsert(
    {
      tenant_id: tenantId,
      entidade_tipo: "conta_a_pagar",
      entidade_id: contaId,
      antecedencia_min: ANTECEDENCIA_MIN_VESPERA_CONTA_A_PAGAR,
      criado_por: user.id,
    },
    { onConflict: "entidade_tipo,entidade_id" },
  );

  if (error) {
    console.error(`Falha ao criar alarme automático da conta ${contaId}:`, error);
  }
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

  revalidatePath("/financeiro/fixas");
}

export async function alternarAtivaContaFixa(contaFixaId: string, ativo: boolean) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase.from("contas_fixas_modelo").update({ ativo }).eq("id", contaFixaId);

  if (error) {
    throw new Error(`Falha ao atualizar conta fixa: ${error.message}`);
  }

  revalidatePath("/financeiro/fixas");
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
  // Opcional — na maioria das vezes só se sabe como vai pagar no momento de
  // marcar como paga, não no lançamento (ver `marcarComoPaga`).
  const formaPagamento = (formData.get("forma_pagamento") as string | null) || null;

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor inválido.");
  }

  const { data: contaCriada, error } = await supabase
    .from("contas_a_pagar")
    .insert({
      tenant_id: tenantId,
      conta_fixa_id: null,
      nome,
      valor,
      categoria,
      mes_referencia: primeiroDiaDoMes(dataVencimento),
      data_vencimento: dataVencimento,
      forma_pagamento: formaPagamento as FormaPagamento | null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Falha ao lançar despesa: ${error.message}`);
  }

  await criarAlarmeVesperaAutomatico(supabase, tenantId, contaCriada.id);

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/avulsas");
}

/** Gera uma conta a pagar a partir de uma tarefa do Kanban — sempre revisado
 * pelo owner (mesmos campos de `criarDespesaAvulsa`, só acrescentando o
 * vínculo de origem). Índice único parcial em `contas_a_pagar.tarefa_id`
 * garante que não dá pra gerar duas vezes da mesma tarefa. */
export async function gerarContaAPagarDaTarefa(tarefaId: string, projetoId: string, formData: FormData) {
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

  const { data: contaCriada, error } = await supabase
    .from("contas_a_pagar")
    .insert({
      tenant_id: tenantId,
      conta_fixa_id: null,
      tarefa_id: tarefaId,
      nome,
      valor,
      categoria,
      mes_referencia: primeiroDiaDoMes(dataVencimento),
      data_vencimento: dataVencimento,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Essa tarefa já tem uma conta gerada.");
    }
    throw new Error(`Falha ao lançar despesa: ${error.message}`);
  }

  await criarAlarmeVesperaAutomatico(supabase, tenantId, contaCriada.id);

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/avulsas");
  revalidatePath(`/projetos/${projetoId}/tarefas`);
}

/** Gera uma conta a pagar a partir de uma decisão — mesmo espírito de
 * `gerarContaAPagarDaTarefa`, sem cruzar fronteira de permissão nenhuma já
 * que `decisoes` também é owner-only. */
export async function gerarContaAPagarDaDecisao(decisaoId: string, projetoId: string, formData: FormData) {
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

  const { data: contaCriada, error } = await supabase
    .from("contas_a_pagar")
    .insert({
      tenant_id: tenantId,
      conta_fixa_id: null,
      decisao_id: decisaoId,
      nome,
      valor,
      categoria,
      mes_referencia: primeiroDiaDoMes(dataVencimento),
      data_vencimento: dataVencimento,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Essa decisão já tem uma conta gerada.");
    }
    throw new Error(`Falha ao lançar despesa: ${error.message}`);
  }

  await criarAlarmeVesperaAutomatico(supabase, tenantId, contaCriada.id);

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/avulsas");
  revalidatePath(`/projetos/${projetoId}/decisoes`);
}

/** Ajusta valor e/ou vencimento da cobrança do mês — útil pra contas fixas
 * cujo valor real (ex: conta de luz) só se sabe quando o boleto chega,
 * sem precisar recadastrar o modelo. Não mexe em `mes_referencia`: o
 * vencimento pode escorregar pro mês seguinte, mas a cobrança continua
 * pertencendo ao ciclo em que foi gerada (evita duplicar no próximo cron). */
export async function atualizarValorEVencimento(contaId: string, valor: number, dataVencimento: string) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor inválido.");
  }

  const { error } = await supabase
    .from("contas_a_pagar")
    .update({ valor, data_vencimento: dataVencimento })
    .eq("id", contaId);

  if (error) {
    throw new Error(`Falha ao atualizar conta: ${error.message}`);
  }

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fixas");
  revalidatePath("/financeiro/avulsas");
}

export async function marcarComoPaga(contaId: string, dataPagamento: string, formaPagamento?: FormaPagamento | null) {
  const tenantId = await garantirWorkspace();
  await exigirOwner(tenantId);
  const supabase = await createClient();

  const { error } = await supabase
    .from("contas_a_pagar")
    .update({
      pago: true,
      data_pagamento: dataPagamento,
      // `undefined` (parâmetro não informado, ex.: correção rápida de data
      // numa conta já paga) não sobrescreve o que já estava salvo; só `null`
      // explícito limpa.
      ...(formaPagamento !== undefined ? { forma_pagamento: formaPagamento } : {}),
    })
    .eq("id", contaId);

  if (error) {
    throw new Error(`Falha ao marcar conta como paga: ${error.message}`);
  }

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fixas");
  revalidatePath("/financeiro/avulsas");
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
  revalidatePath("/financeiro/fixas");
  revalidatePath("/financeiro/avulsas");
}

/** Contas a pagar (fixas ou avulsas) que vencem HOJE e ainda não foram
 * pagas — usado pela coluna "Compromissos de hoje" do Kanban pra destacar,
 * ao lado dos compromissos do Google, o que precisa ser resolvido no dia
 * (pedido do Fabio, 2026-09-29). Financeiro é owner-only: quem não é owner
 * do workspace nunca vê nada aqui (a RLS de `contas_a_pagar` já garante
 * isso, mas checar o papel antes evita uma query owner-only inútil pra
 * quem não vai ver resultado nenhum). */
export async function listarContasDoDia(tenantId: string): Promise<ContaAPagar[]> {
  if ((await obterPapelAtual(tenantId)) !== "owner") return [];

  const supabase = await createClient();
  const hojeISO = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BRASIL }).format(new Date());

  const { data, error } = await supabase
    .from("contas_a_pagar")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("data_vencimento", hojeISO)
    .eq("pago", false)
    .order("valor", { ascending: false });

  if (error) {
    console.error("Falha ao listar contas do dia:", error);
    return [];
  }

  return (data as ContaAPagar[] | null) ?? [];
}
