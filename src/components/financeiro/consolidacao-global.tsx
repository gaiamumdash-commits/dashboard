import type { CategoriaFinanceira, ContaAPagar } from "@/lib/ecc/tipos";

const ROTULO_CATEGORIA: Record<CategoriaFinanceira, string> = {
  consumo: "Consumo",
  investimento: "Investimento",
  despesa: "Despesa",
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ConsolidacaoGlobal({ contasDoMes }: { contasDoMes: ContaAPagar[] }) {
  const totalPago = contasDoMes.filter((c) => c.pago).reduce((soma, c) => soma + c.valor, 0);
  const totalPendente = contasDoMes.filter((c) => !c.pago).reduce((soma, c) => soma + c.valor, 0);

  const porCategoria = (Object.keys(ROTULO_CATEGORIA) as CategoriaFinanceira[]).map((categoria) => ({
    categoria,
    total: contasDoMes.filter((c) => c.categoria === categoria).reduce((soma, c) => soma + c.valor, 0),
  }));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
        <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">Pago no mês</p>
        <p className="mt-1 text-2xl font-semibold text-gaiamum-text">{formatarMoeda(totalPago)}</p>
      </div>
      <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
        <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">Pendente no mês</p>
        <p className="mt-1 text-2xl font-semibold text-gaiamum-warning">{formatarMoeda(totalPendente)}</p>
      </div>
      {porCategoria.map(({ categoria, total }) => (
        <div key={categoria} className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">{ROTULO_CATEGORIA[categoria]}</p>
          <p className="mt-1 text-2xl font-semibold text-gaiamum-text">{formatarMoeda(total)}</p>
        </div>
      ))}
    </div>
  );
}
