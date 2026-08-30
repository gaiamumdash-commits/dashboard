"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Anexo, ContaAPagar } from "@/lib/ecc/tipos";
import { desmarcarComoPaga, marcarComoPaga } from "@/lib/ecc/financeiro";
import { AnexoComprovante } from "@/components/financeiro/anexo-comprovante";

const ROTULO_CATEGORIA: Record<ContaAPagar["categoria"], string> = {
  consumo: "Consumo",
  investimento: "Investimento",
  despesa: "Despesa",
};

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatarData(dataISO: string): string {
  return new Date(`${dataISO}T00:00:00`).toLocaleDateString("pt-BR");
}

function Linha({ conta, anexos }: { conta: ContaAPagar; anexos: Anexo[] }) {
  const [editandoData, setEditandoData] = useState(false);
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();

  function alternarPago() {
    if (conta.pago) {
      iniciarTransicao(async () => {
        await desmarcarComoPaga(conta.id);
        router.refresh();
      });
    } else {
      iniciarTransicao(async () => {
        await marcarComoPaga(conta.id, hojeISO());
        router.refresh();
      });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gaiamum-border bg-gaiamum-surface-raised p-3">
      <input
        type="checkbox"
        checked={conta.pago}
        onChange={alternarPago}
        className="h-4 w-4 accent-gaiamum-primary"
      />
      <span className="flex-1 text-sm text-gaiamum-text">{conta.nome}</span>
      <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-xs text-gaiamum-text-muted">
        {ROTULO_CATEGORIA[conta.categoria]}
      </span>
      <span className="text-sm text-gaiamum-text-muted">
        {conta.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </span>
      <span className="text-xs text-gaiamum-text-muted">Vence {formatarData(conta.data_vencimento)}</span>

      {conta.pago && conta.data_pagamento && !editandoData && (
        <button
          type="button"
          onClick={() => setEditandoData(true)}
          className="text-xs text-gaiamum-primary hover:underline"
          title="Clique pra corrigir a data de pagamento"
        >
          Pago em {formatarData(conta.data_pagamento)}
        </button>
      )}

      {conta.pago && editandoData && (
        <input
          type="date"
          autoFocus
          defaultValue={conta.data_pagamento ?? hojeISO()}
          onBlur={(e) => {
            setEditandoData(false);
            const novaData = e.currentTarget.value;
            if (novaData) {
              iniciarTransicao(async () => {
                await marcarComoPaga(conta.id, novaData);
                router.refresh();
              });
            }
          }}
          className="rounded border border-gaiamum-primary bg-gaiamum-surface px-2 py-0.5 text-xs text-gaiamum-text outline-none"
        />
      )}

      <AnexoComprovante contaId={conta.id} anexos={anexos} />
    </div>
  );
}

export function ChecklistContas({
  contasFixas,
  contasAvulsas,
  anexosPorConta,
}: {
  contasFixas: ContaAPagar[];
  contasAvulsas: ContaAPagar[];
  anexosPorConta: Record<string, Anexo[]>;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
          Contas fixas do mês <span className="text-gaiamum-text">({contasFixas.length})</span>
        </h2>
        {contasFixas.length === 0 && (
          <p className="text-sm text-gaiamum-text-muted">
            Nenhuma ainda — cadastre uma conta fixa abaixo, ela aparece aqui a partir do próximo dia 1.
          </p>
        )}
        {contasFixas.map((conta) => (
          <Linha key={conta.id} conta={conta} anexos={anexosPorConta[conta.id] ?? []} />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
          Despesas avulsas do mês <span className="text-gaiamum-text">({contasAvulsas.length})</span>
        </h2>
        {contasAvulsas.length === 0 && <p className="text-sm text-gaiamum-text-muted">Nenhuma lançada ainda.</p>}
        {contasAvulsas.map((conta) => (
          <Linha key={conta.id} conta={conta} anexos={anexosPorConta[conta.id] ?? []} />
        ))}
      </div>
    </div>
  );
}
