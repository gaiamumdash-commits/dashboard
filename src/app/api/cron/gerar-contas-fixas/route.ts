import { NextRequest, NextResponse } from "next/server";
import { autorizacaoCronValida } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";

function ultimoDiaDoMes(data: Date): number {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
}

/** Roda todo dia 1 do mês (vercel.json): gera a `conta_a_pagar` do mês pra
 * cada `conta_fixa_modelo` ativa. Idempotente — o índice único
 * (conta_fixa_id, mes_referencia) impede duplicar se rodar mais de uma vez. */
export async function GET(request: NextRequest) {
  if (!autorizacaoCronValida(request.headers.get("authorization"), process.env.CRON_SECRET ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const mesReferencia = `${ano}-${String(mes).padStart(2, "0")}-01`;

  const { data: modelos, error } = await supabase
    .from("contas_fixas_modelo")
    .select("id, tenant_id, nome, valor_esperado, dia_vencimento, categoria")
    .eq("ativo", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let geradas = 0;
  const falhas: string[] = [];

  for (const modelo of modelos ?? []) {
    const diaVencimento = Math.min(modelo.dia_vencimento, ultimoDiaDoMes(hoje));
    const dataVencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(diaVencimento).padStart(2, "0")}`;

    const { error: erroInsert } = await supabase.from("contas_a_pagar").insert({
      tenant_id: modelo.tenant_id,
      conta_fixa_id: modelo.id,
      nome: modelo.nome,
      valor: modelo.valor_esperado,
      categoria: modelo.categoria,
      mes_referencia: mesReferencia,
      data_vencimento: dataVencimento,
    });

    if (erroInsert) {
      // 23505 = já existe (rodou duas vezes no mês) — esperado, ignora.
      if (erroInsert.code !== "23505") {
        falhas.push(`${modelo.id}: ${erroInsert.message}`);
      }
      continue;
    }

    geradas++;
  }

  return NextResponse.json({ verificadas: modelos?.length ?? 0, geradas, falhas });
}
