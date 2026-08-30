import Link from "next/link";
import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import type { Anexo, ContaAPagar, ContaFixaModelo } from "@/lib/ecc/tipos";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ConsolidacaoGlobal } from "@/components/financeiro/consolidacao-global";
import { ChecklistContas } from "@/components/financeiro/checklist-contas";
import { FormularioContaFixa } from "@/components/financeiro/formulario-conta-fixa";
import { FormularioDespesaAvulsa } from "@/components/financeiro/formulario-despesa-avulsa";
import { ListaContasFixasModelo } from "@/components/financeiro/lista-contas-fixas-modelo";

function primeiroDiaDoMesAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function PaginaFinanceiro() {
  const tenantId = await garantirWorkspace();

  // Financeiro é dado sensível — só o owner do workspace enxerga.
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const supabase = await createClient();
  const mesReferencia = primeiroDiaDoMesAtual();

  const [{ data: contasDoMes }, { data: modelos }, { count: totalMetasSmart }] = await Promise.all([
    supabase
      .from("contas_a_pagar")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("mes_referencia", mesReferencia)
      .order("data_vencimento", { ascending: true }),
    supabase
      .from("contas_fixas_modelo")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: true }),
    supabase.from("metas_smart").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  const lista = (contasDoMes as ContaAPagar[] | null) ?? [];
  const contasFixas = lista.filter((c) => c.conta_fixa_id !== null);
  const contasAvulsas = lista.filter((c) => c.conta_fixa_id === null);

  const { data: anexosDoMes } =
    lista.length > 0
      ? await supabase
          .from("anexos")
          .select("*")
          .eq("entidade_tipo", "conta_a_pagar")
          .in(
            "entidade_id",
            lista.map((c) => c.id),
          )
      : { data: [] as Anexo[] };

  const anexosPorConta: Record<string, Anexo[]> = {};
  for (const anexo of (anexosDoMes as Anexo[] | null) ?? []) {
    (anexosPorConta[anexo.entidade_id] ??= []).push(anexo);
  }

  return (
    <div className="flex min-h-screen bg-gaiamum-bg">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)} souOwner />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gaiamum-text">Financeiro</h1>
            <p className="mt-1 text-gaiamum-text-muted">Contas fixas, despesas avulsas e consolidação do mês.</p>
          </div>
          <Link
            href="/financeiro/importar"
            className="rounded-lg border border-gaiamum-border px-4 py-2 text-sm text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text"
          >
            Importar extrato
          </Link>
        </div>

        <div className="mt-8">
          <ConsolidacaoGlobal contasDoMes={lista} />
        </div>

        <div className="mt-8">
          <ChecklistContas contasFixas={contasFixas} contasAvulsas={contasAvulsas} anexosPorConta={anexosPorConta} />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <FormularioContaFixa />
          <FormularioDespesaAvulsa />
        </div>

        <div className="mt-8">
          <ListaContasFixasModelo modelos={(modelos as ContaFixaModelo[] | null) ?? []} />
        </div>
      </main>
    </div>
  );
}
