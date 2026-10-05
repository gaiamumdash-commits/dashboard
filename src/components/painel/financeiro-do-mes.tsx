import { calcularFinanceiroDoMes, contasVencendoEmDias } from "@/lib/ecc/painel-geral";
import { IconeCircular } from "@/components/painel/icone-circular";
import type { ContaAPagar } from "@/lib/ecc/tipos";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CardValor({
  cor,
  simbolo,
  rotulo,
  valor,
  negativo,
}: {
  cor: "verde" | "vermelho" | "azul";
  simbolo: string;
  rotulo: string;
  valor: string;
  negativo?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
      <div className="flex items-center gap-2">
        <IconeCircular cor={cor} tamanho="sm">
          {simbolo}
        </IconeCircular>
        <p className="text-xs uppercase tracking-wide text-gaiamum-text-muted">{rotulo}</p>
      </div>
      <p className={`mt-2 text-xl font-semibold ${negativo ? "text-gaiamum-danger" : "text-gaiamum-text"}`}>{valor}</p>
    </div>
  );
}

/** Card "Financeiro do mês" do Painel geral — achado real da investigação
 * antes de codar (confirmado com o Fabio): `contas_a_pagar` só modela
 * SAÍDAS, não existe receita/entrada no schema ainda (fica pra quando ele
 * cadastrar os primeiros recebimentos variáveis). "Entradas" mostra 0 de
 * verdade (não é inventado — é o estado real), "Saldo previsto" é a
 * diferença real (fica negativo até haver receita) e "Comprometido" é
 * `saídas/entradas` (100% quando não há nenhuma entrada mas há saída — ver
 * `calcularFinanceiroDoMes`). */
export function FinanceiroDoMes({ contasDoMes }: { contasDoMes: ContaAPagar[] }) {
  const { entradas, saidas, saldoPrevisto, comprometido } = calcularFinanceiroDoMes(contasDoMes);
  const { quantidade: quantidadeVencendoEm7Dias, valorTotal: valorVencendoEm7Dias } = contasVencendoEmDias(contasDoMes);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CardValor cor="verde" simbolo="↑" rotulo="Entradas" valor={formatarMoeda(entradas)} />
        <CardValor cor="vermelho" simbolo="↓" rotulo="Saídas" valor={formatarMoeda(saidas)} />
        <CardValor
          cor="azul"
          simbolo="📊"
          rotulo="Saldo previsto"
          valor={formatarMoeda(saldoPrevisto)}
          negativo={saldoPrevisto < 0}
        />
        <CardValor cor="azul" simbolo="✓" rotulo="Comprometido" valor={comprometido === null ? "—" : `${comprometido}%`} />
      </div>

      {quantidadeVencendoEm7Dias > 0 && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-gaiamum-warning/40 bg-gaiamum-warning/10 px-4 py-2.5 text-sm text-gaiamum-text">
          <span>⚠ {formatarMoeda(valorVencendoEm7Dias)} vencem nos próximos 7 dias.</span>
          <span aria-hidden className="text-gaiamum-text-muted">→</span>
        </div>
      )}
    </div>
  );
}
