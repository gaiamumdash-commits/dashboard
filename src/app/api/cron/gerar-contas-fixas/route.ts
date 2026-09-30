import { NextRequest, NextResponse } from "next/server";
import { autorizacaoCronValida } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ANTECEDENCIA_MIN_VESPERA_CONTA_A_PAGAR } from "@/lib/ecc/kanban";

function ultimoDiaDoMes(data: Date): number {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
}

/** Cron roda sem usuário logado (service client) — o alarme automático de
 * véspera (ver `financeiro.ts`/`ANTECEDENCIA_MIN_VESPERA_CONTA_A_PAGAR`)
 * precisa de um `criado_por`, resolvido aqui como o owner do tenant. Cache
 * simples por tenant dentro da mesma execução: vários modelos costumam ser
 * do mesmo tenant, evita repetir a query de membership pra cada um. */
async function criarAlarmeVesperaParaContaFixa(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  contaId: string,
  cacheOwnerPorTenant: Map<string, string | null>,
) {
  if (!cacheOwnerPorTenant.has(tenantId)) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("papel", "owner")
      .limit(1)
      .maybeSingle();
    cacheOwnerPorTenant.set(tenantId, (membership?.user_id as string | undefined) ?? null);
  }
  const ownerId = cacheOwnerPorTenant.get(tenantId) ?? null;
  if (!ownerId) return;

  const { error } = await supabase.from("alarmes").upsert(
    {
      tenant_id: tenantId,
      entidade_tipo: "conta_a_pagar",
      entidade_id: contaId,
      antecedencia_min: ANTECEDENCIA_MIN_VESPERA_CONTA_A_PAGAR,
      criado_por: ownerId,
    },
    { onConflict: "entidade_tipo,entidade_id" },
  );

  if (error) {
    console.error(`Falha ao criar alarme automático da conta fixa ${contaId}:`, error);
  }
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
  const cacheOwnerPorTenant = new Map<string, string | null>();

  for (const modelo of modelos ?? []) {
    const diaVencimento = Math.min(modelo.dia_vencimento, ultimoDiaDoMes(hoje));
    const dataVencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(diaVencimento).padStart(2, "0")}`;

    const { data: contaCriada, error: erroInsert } = await supabase
      .from("contas_a_pagar")
      .insert({
        tenant_id: modelo.tenant_id,
        conta_fixa_id: modelo.id,
        nome: modelo.nome,
        valor: modelo.valor_esperado,
        categoria: modelo.categoria,
        mes_referencia: mesReferencia,
        data_vencimento: dataVencimento,
      })
      .select("id")
      .single();

    if (erroInsert) {
      // 23505 = já existe (rodou duas vezes no mês) — esperado, ignora.
      if (erroInsert.code !== "23505") {
        falhas.push(`${modelo.id}: ${erroInsert.message}`);
      }
      continue;
    }

    await criarAlarmeVesperaParaContaFixa(supabase, modelo.tenant_id, contaCriada.id, cacheOwnerPorTenant);
    geradas++;
  }

  return NextResponse.json({ verificadas: modelos?.length ?? 0, geradas, falhas });
}
