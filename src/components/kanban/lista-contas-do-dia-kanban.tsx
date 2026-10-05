"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContaAPagar } from "@/lib/ecc/tipos";
import { IconeDinheiro } from "@/components/kanban/icones-kanban";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Uma conta do dia dentro da coluna "Compromissos do dia" do Kanban —
 * clicar dá o efeito de "riscar" (mesma linguagem visual de um item de
 * checklist marcado) por um instante e então leva pro Financeiro, já na
 * conta certa, pra marcar como paga/anexar comprovante. O riscado é só
 * feedback de "vou lá resolver isso agora" — não marca como paga sozinho,
 * quem faz isso é o Financeiro (evita marcar pago sem querer com 1 clique).
 * Redesenho 2026-10-05: só visual ("Vencimento" + nome + valor + selo do
 * dia em âmbar — atenção, não risco). */
function ContaDoDia({ conta, rotuloDia }: { conta: ContaAPagar; rotuloDia: string }) {
  const [indo, setIndo] = useState(false);
  const router = useRouter();

  function abrirNoFinanceiro() {
    if (indo) return;
    setIndo(true);
    const pagina = conta.conta_fixa_id ? "/financeiro/fixas" : "/financeiro/avulsas";
    setTimeout(() => router.push(`${pagina}?destacar=${conta.id}`), 260);
  }

  return (
    <button
      type="button"
      onClick={abrirNoFinanceiro}
      title="Abrir no Financeiro"
      className={`relative w-full overflow-hidden rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised py-2 pl-3 pr-2 text-left transition ${
        indo ? "opacity-50" : "hover:border-gaiamum-warning/60"
      }`}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-gaiamum-warning" />
      <span className="flex items-start gap-2">
        <IconeDinheiro className="mt-0.5 h-4 w-4 shrink-0 text-gaiamum-success" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-gaiamum-text-muted">Vencimento</span>
          <span className={`block truncate text-sm font-semibold text-gaiamum-text transition-all ${indo ? "line-through" : ""}`}>
            {conta.nome}
          </span>
          <span className="block text-xs text-gaiamum-text-muted tabular-nums">{formatarMoeda(conta.valor)}</span>
        </span>
        <span className="shrink-0 rounded-md border border-gaiamum-warning/50 bg-gaiamum-warning/15 px-1.5 py-0.5 text-[11px] font-semibold capitalize text-gaiamum-warning">
          {rotuloDia}
        </span>
      </span>
    </button>
  );
}

export function ListaContasDoDiaKanban({ contas, rotuloDia = "hoje" }: { contas: ContaAPagar[]; rotuloDia?: string }) {
  if (contas.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2" aria-label={`Contas que vencem ${rotuloDia}`}>
      {contas.map((conta) => (
        <li key={conta.id}>
          <ContaDoDia conta={conta} rotuloDia={rotuloDia} />
        </li>
      ))}
    </ul>
  );
}
