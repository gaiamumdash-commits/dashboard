import { contasVencendoEmDias } from "@/lib/ecc/painel-geral";
import type { ContaAPagar } from "@/lib/ecc/tipos";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Card "Financeiro do mês" do Painel geral — achado real da investigação
 * antes de codar (confirmado com o Fabio): `contas_a_pagar` só modela
 * SAÍDAS, não existe receita/entrada no schema ainda (fica pra quando ele
 * cadastrar os primeiros recebimentos variáveis). Por isso "Entradas" e
 * "Saldo previsto" ficam com rótulo "Em breve" em vez de um número
 * inventado; "Comprometido %" é redefinido como pago/total do mês (dado
 * 100% real, só não é a leitura clássica de "% da renda"). */
export function FinanceiroDoMes({ contasDoMes }: { contasDoMes: ContaAPagar[] }) {
  const pago = contasDoMes.filter((c) => c.pago).reduce((soma, c) => soma + c.valor, 0);
  const pendente = contasDoMes.filter((c) => !c.pago).reduce((soma, c) => soma + c.valor, 0);
  const saidas = pago + pendente;
  const comprometido = saidas === 0 ? null : Math.round((100 * pago) / saidas);

  const { quantidade: quantidadeVencendoEm7Dias, valorTotal: valorVencendoEm7Dias } = contasVencendoEmDias(contasDoMes);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">Entradas</p>
          <p className="mt-1 text-2xl font-semibold text-gaiamum-text-muted">Em breve</p>
        </div>
        <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">Saídas</p>
          <p className="mt-1 text-2xl font-semibold text-gaiamum-text">{formatarMoeda(saidas)}</p>
        </div>
        <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">Saldo previsto</p>
          <p className="mt-1 text-2xl font-semibold text-gaiamum-text-muted">Em breve</p>
        </div>
        <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
          <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">Comprometido</p>
          <p className="mt-1 text-2xl font-semibold text-gaiamum-text">
            {comprometido === null ? "—" : `${comprometido}%`}
          </p>
          <p className="mt-0.5 text-[11px] text-gaiamum-text-muted">já pago / total do mês</p>
        </div>
      </div>

      {quantidadeVencendoEm7Dias > 0 && (
        <div className="mt-4 rounded-xl border border-gaiamum-warning/40 bg-gaiamum-warning/10 px-4 py-2.5 text-sm text-gaiamum-text">
          ⚠ {formatarMoeda(valorVencendoEm7Dias)} vencem nos próximos 7 dias.
        </div>
      )}
    </div>
  );
}
