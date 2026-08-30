"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Anexo, ContaAPagar } from "@/lib/ecc/tipos";
import { atualizarValorEVencimento, desmarcarComoPaga, marcarComoPaga } from "@/lib/ecc/financeiro";
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

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Interruptor({ ligado, onClick }: { ligado: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        ligado ? "bg-gaiamum-success" : "bg-gaiamum-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          ligado ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Linha({ conta, anexos }: { conta: ContaAPagar; anexos: Anexo[] }) {
  const [editandoValor, setEditandoValor] = useState(false);
  const [editandoDataPagamento, setEditandoDataPagamento] = useState(false);
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

  const vencida = !conta.pago && conta.data_vencimento < hojeISO();
  const statusRotulo = conta.pago ? "Pago" : vencida ? "Vencido" : "Em aberto";
  const statusClasse = conta.pago
    ? "bg-gaiamum-success/15 text-gaiamum-success"
    : vencida
      ? "bg-gaiamum-danger/15 text-gaiamum-danger"
      : "bg-gaiamum-surface-raised text-gaiamum-text-muted";

  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gaiamum-text">{conta.nome}</span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClasse}`}>
          {statusRotulo}
        </span>
      </div>

      {!editandoValor ? (
        <button
          type="button"
          onClick={() => setEditandoValor(true)}
          className="mt-3 grid w-full grid-cols-2 gap-3 rounded-xl bg-gaiamum-surface-raised p-3 text-left"
          title="Clique pra corrigir valor e vencimento (boleto chegou com valor diferente do esperado)"
        >
          <div>
            <p className="text-xs text-gaiamum-text-muted">Vencimento</p>
            <p className="text-sm text-gaiamum-text">{formatarData(conta.data_vencimento)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gaiamum-text-muted">Valor</p>
            <p className="text-sm font-medium text-gaiamum-text">{formatarMoeda(conta.valor)}</p>
          </div>
        </button>
      ) : (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-gaiamum-surface-raised p-3"
          action={(formData) => {
            const novoValor = Number(formData.get("valor"));
            const novoVencimento = String(formData.get("data_vencimento"));
            setEditandoValor(false);
            iniciarTransicao(async () => {
              await atualizarValorEVencimento(conta.id, novoValor, novoVencimento);
              router.refresh();
            });
          }}
        >
          <input
            type="date"
            name="data_vencimento"
            required
            autoFocus
            defaultValue={conta.data_vencimento}
            className="rounded border border-gaiamum-primary bg-gaiamum-surface px-2 py-1 text-xs text-gaiamum-text outline-none"
          />
          <input
            type="number"
            name="valor"
            step="0.01"
            min="0.01"
            required
            defaultValue={conta.valor}
            className="w-24 rounded border border-gaiamum-primary bg-gaiamum-surface px-2 py-1 text-xs text-gaiamum-text outline-none"
          />
          <button type="submit" className="text-xs font-medium text-gaiamum-primary hover:underline">
            Salvar
          </button>
        </form>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-xs text-gaiamum-text-muted">
          {ROTULO_CATEGORIA[conta.categoria]}
        </span>
      </div>

      <div className="mt-3">
        <AnexoComprovante contaId={conta.id} anexos={anexos} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gaiamum-border pt-3">
        <div className="flex flex-col">
          <span className="text-sm text-gaiamum-text">Marcar como pago</span>
          {conta.pago && conta.data_pagamento && !editandoDataPagamento && (
            <button
              type="button"
              onClick={() => setEditandoDataPagamento(true)}
              className="text-left text-xs text-gaiamum-primary hover:underline"
              title="Clique pra corrigir a data de pagamento"
            >
              Pago em {formatarData(conta.data_pagamento)}
            </button>
          )}
          {conta.pago && editandoDataPagamento && (
            <input
              type="date"
              autoFocus
              defaultValue={conta.data_pagamento ?? hojeISO()}
              onBlur={(e) => {
                setEditandoDataPagamento(false);
                const novaData = e.currentTarget.value;
                if (novaData) {
                  iniciarTransicao(async () => {
                    await marcarComoPaga(conta.id, novaData);
                    router.refresh();
                  });
                }
              }}
              className="mt-1 rounded border border-gaiamum-primary bg-gaiamum-surface px-2 py-0.5 text-xs text-gaiamum-text outline-none"
            />
          )}
        </div>
        <Interruptor ligado={conta.pago} onClick={alternarPago} />
      </div>
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
      <div className="flex flex-col gap-3">
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

      <div className="flex flex-col gap-3">
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
