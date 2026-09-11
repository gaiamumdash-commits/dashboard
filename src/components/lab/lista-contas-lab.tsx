"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { ContaAPagar } from "@/lib/ecc/tipos";
import { atualizarValorEVencimentoLab, desmarcarComoPagaLab, marcarComoPagaLab } from "@/lib/ecc/lab/financeiro";

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

function Interruptor({
  ligado,
  onClick,
  disabled,
}: {
  ligado: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={onClick}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${
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

function Linha({ conta }: { conta: ContaAPagar }) {
  const [editandoValor, setEditandoValor] = useState(false);
  const [editandoDataPagamento, setEditandoDataPagamento] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  // Otimista: mesmo motivo de lista-contas.tsx (real) — sem isso o
  // interruptor só refletia o clique depois do router.refresh() trazer o
  // dado novo de volta, sem indicador de "salvando" nesse meio tempo.
  const [pagoOtimista, setPagoOtimista] = useState(conta.pago);
  const [contaAnterior, setContaAnterior] = useState(conta);
  if (conta !== contaAnterior) {
    setContaAnterior(conta);
    setPagoOtimista(conta.pago);
  }

  function alternarPago() {
    const eraPago = pagoOtimista;
    setPagoOtimista(!eraPago);

    if (eraPago) {
      iniciarTransicao(async () => {
        try {
          await desmarcarComoPagaLab(conta.id);
          router.refresh();
        } catch (err) {
          setPagoOtimista(eraPago);
          toast.error(mensagemDeErro(err, "Falha ao desmarcar como paga."));
        }
      });
    } else {
      iniciarTransicao(async () => {
        try {
          await marcarComoPagaLab(conta.id, hojeISO());
          router.refresh();
        } catch (err) {
          setPagoOtimista(eraPago);
          toast.error(mensagemDeErro(err, "Falha ao marcar como paga."));
        }
      });
    }
  }

  const vencida = !pagoOtimista && conta.data_vencimento < hojeISO();
  const statusRotulo = pagoOtimista ? "Pago" : vencida ? "Vencido" : "Em aberto";
  const statusClasse = pagoOtimista
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
          title="Clique pra corrigir valor e vencimento"
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
              try {
                await atualizarValorEVencimentoLab(conta.id, novoValor, novoVencimento);
                router.refresh();
              } catch (err) {
                toast.error(mensagemDeErro(err, "Falha ao salvar valor/vencimento."));
              }
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-xs text-gaiamum-text-muted">
          {ROTULO_CATEGORIA[conta.categoria]}
        </span>
        {(conta.tarefa_id || conta.decisao_id) && (
          <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-xs text-gaiamum-text-muted">
            🔗 {conta.tarefa_id ? "gerada de um cartão" : "gerada de uma decisão"}
          </span>
        )}
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
                    try {
                      await marcarComoPagaLab(conta.id, novaData);
                      router.refresh();
                    } catch (err) {
                      toast.error(mensagemDeErro(err, "Falha ao corrigir data de pagamento."));
                    }
                  });
                }
              }}
              className="mt-1 rounded border border-gaiamum-primary bg-gaiamum-surface px-2 py-0.5 text-xs text-gaiamum-text outline-none"
            />
          )}
        </div>
        <Interruptor ligado={pagoOtimista} onClick={alternarPago} disabled={pendente} />
      </div>
    </div>
  );
}

/** Versão só-do-Lab de ListaContas (components/financeiro/lista-contas.tsx)
 * — sem anexo de comprovante nem alarme (ambos hardcodeiam garantirWorkspace(),
 * fora de escopo do tenant fictício do Lab). Mantém badge de status, edição
 * inline de valor/vencimento, toggle pago/não pago e badge de origem. Usa as
 * Server Actions Lab-aware (lib/ecc/lab/financeiro.ts). */
export function ListaContasLab({ contas, mensagemVazio }: { contas: ContaAPagar[]; mensagemVazio: string }) {
  if (contas.length === 0) {
    return <p className="text-sm text-gaiamum-text-muted">{mensagemVazio}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {contas.map((conta) => (
        <Linha key={conta.id} conta={conta} />
      ))}
    </div>
  );
}
