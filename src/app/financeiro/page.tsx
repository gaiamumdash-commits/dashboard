import Link from "next/link";
import { redirect } from "next/navigation";
import { garantirWorkspace } from "@/lib/ecc/workspace";
import { createClient } from "@/lib/supabase/server";
import { obterPapelAtual } from "@/lib/ecc/equipe";
import { contarMetasSmart } from "@/lib/ecc/metas";
import { primeiroDiaDoMesAtual } from "@/lib/ecc/kanban";
import type { ContaAPagar } from "@/lib/ecc/tipos";
import { MenuLateral } from "@/components/layout/menu-lateral";
import { ConsolidacaoGlobal } from "@/components/financeiro/consolidacao-global";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PaginaFinanceiro() {
  const tenantId = await garantirWorkspace();

  // Financeiro é dado sensível — só o owner do workspace enxerga.
  if ((await obterPapelAtual(tenantId)) !== "owner") {
    redirect("/projetos");
  }

  const supabase = await createClient();
  const mesReferencia = primeiroDiaDoMesAtual();

  const [{ data: contasDoMes }, totalMetasSmart] = await Promise.all([
    supabase
      .from("contas_a_pagar")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("mes_referencia", mesReferencia)
      .order("data_vencimento", { ascending: true }),
    contarMetasSmart(tenantId),
  ]);

  const lista = (contasDoMes as ContaAPagar[] | null) ?? [];
  const contasFixas = lista.filter((c) => c.conta_fixa_id !== null);
  const contasAvulsas = lista.filter((c) => c.conta_fixa_id === null);
  const somaFixas = contasFixas.reduce((soma, c) => soma + c.valor, 0);

  return (
    <div className="flex min-h-screen flex-col bg-gaiamum-bg sm:flex-row">
      <MenuLateral temMetasSmart={Boolean(totalMetasSmart && totalMetasSmart > 0)} souOwner />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-semibold text-gaiamum-text">Financeiro</h1>
        <p className="mt-1 text-gaiamum-text-muted">Consolidação do mês.</p>

        <div className="mt-8">
          <ConsolidacaoGlobal contasDoMes={lista} />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/financeiro/fixas"
            className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 transition hover:border-gaiamum-primary"
          >
            <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">Contas fixas do mês</p>
            <p className="mt-1 text-2xl font-semibold text-gaiamum-text">{formatarMoeda(somaFixas)}</p>
            <p className="mt-1 text-sm text-gaiamum-text-muted">{contasFixas.length} conta(s) →</p>
          </Link>
          <Link
            href="/financeiro/avulsas"
            className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5 transition hover:border-gaiamum-primary"
          >
            <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">Despesas avulsas do mês</p>
            <p className="mt-1 text-2xl font-semibold text-gaiamum-text">{contasAvulsas.length}</p>
            <p className="mt-1 text-sm text-gaiamum-text-muted">Ver detalhes →</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
