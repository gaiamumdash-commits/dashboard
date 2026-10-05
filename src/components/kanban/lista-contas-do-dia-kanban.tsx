"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContaAPagar } from "@/lib/ecc/tipos";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Uma conta do dia dentro da coluna "Compromissos de hoje" do Kanban —
 * clicar dá o efeito de "riscar" (mesma linguagem visual de um item de
 * checklist marcado) por um instante e então leva pro Financeiro, já na
 * conta certa, pra marcar como paga/anexar comprovante. O riscado é só
 * feedback de "vou lá resolver isso agora" — não marca como paga sozinho,
 * quem faz isso é o Financeiro (evita marcar pago sem querer com 1 clique). */
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
      className={`w-full rounded-lg border border-gaiamum-warning bg-gaiamum-warning/15 px-3 py-2 text-left transition ${
        indo ? "opacity-50" : "hover:bg-gaiamum-warning/25"
      }`}
    >
      <p className={`text-sm font-medium text-gaiamum-warning transition-all ${indo ? "line-through" : ""}`}>
        {conta.nome}
      </p>
      <p className="text-xs text-gaiamum-warning/80">{formatarMoeda(conta.valor)} · vence {rotuloDia}</p>
    </button>
  );
}

export function ListaContasDoDiaKanban({ contas, rotuloDia = "hoje" }: { contas: ContaAPagar[]; rotuloDia?: string }) {
  if (contas.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-gaiamum-border pt-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">
        💰 Contas de {rotuloDia} <span className="text-gaiamum-text">({contas.length})</span>
      </h3>
      <ul className="flex flex-col gap-2">
        {contas.map((conta) => (
          <li key={conta.id}>
            <ContaDoDia conta={conta} rotuloDia={rotuloDia} />
          </li>
        ))}
      </ul>
    </div>
  );
}
