"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { Receita } from "@/lib/ecc/tipos";
import { hojeISOBrasil } from "@/lib/ecc/kanban";
import { ROTULO_CATEGORIA_RECEITA } from "@/lib/ecc/receitas-regras";
import {
  atualizarValorEDataReceita,
  desmarcarComoRecebida,
  excluirReceita,
  marcarComoRecebida,
} from "@/lib/ecc/receitas";

function formatarData(dataISO: string): string {
  return new Date(`${dataISO}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Linha({ receita, nomeProjeto }: { receita: Receita; nomeProjeto: string | null }) {
  const [editando, setEditando] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  // Otimista, como o interruptor de "pago" em `ListaContas`.
  const [recebidaOtimista, setRecebidaOtimista] = useState(receita.recebida);
  const [receitaAnterior, setReceitaAnterior] = useState(receita);
  if (receita !== receitaAnterior) {
    setReceitaAnterior(receita);
    setRecebidaOtimista(receita.recebida);
  }

  function executar(acao: () => Promise<void>, falha: string, desfazer?: () => void) {
    iniciarTransicao(async () => {
      try {
        await acao();
        router.refresh();
      } catch (err) {
        desfazer?.();
        toast.error(mensagemDeErro(err, falha));
      }
    });
  }

  function alternarRecebida() {
    const novo = !recebidaOtimista;
    setRecebidaOtimista(novo);
    executar(
      () => (novo ? marcarComoRecebida(receita.id, hojeISOBrasil()) : desmarcarComoRecebida(receita.id)),
      novo ? "Falha ao marcar como recebida." : "Falha ao reabrir receita.",
      () => setRecebidaOtimista(!novo),
    );
  }

  function excluir() {
    if (!window.confirm(`Excluir a receita "${receita.descricao}"?`)) return;
    executar(() => excluirReceita(receita.id), "Falha ao excluir receita.");
  }

  const atrasada = !recebidaOtimista && receita.data_prevista < hojeISOBrasil();
  const statusRotulo = recebidaOtimista ? "Recebida" : atrasada ? "Atrasada" : "Prevista";
  const statusClasse = recebidaOtimista
    ? "bg-gaiamum-success/15 text-gaiamum-success"
    : atrasada
      ? "bg-gaiamum-warning/15 text-gaiamum-warning"
      : "bg-gaiamum-surface-raised text-gaiamum-text-muted";

  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gaiamum-text">{receita.descricao}</span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClasse}`}>{statusRotulo}</span>
      </div>

      {!editando ? (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="mt-3 grid w-full grid-cols-2 gap-3 rounded-xl bg-gaiamum-surface-raised p-3 text-left"
          title="Clique pra corrigir valor e data prevista"
        >
          <div>
            <p className="text-xs text-gaiamum-text-muted">Data prevista</p>
            <p className="text-sm text-gaiamum-text">{formatarData(receita.data_prevista)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gaiamum-text-muted">Valor</p>
            <p className="text-sm font-medium text-gaiamum-success">{formatarMoeda(receita.valor)}</p>
          </div>
        </button>
      ) : (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-gaiamum-surface-raised p-3"
          action={(formData) => {
            const valor = String(formData.get("valor"));
            const data = String(formData.get("data_prevista"));
            setEditando(false);
            executar(() => atualizarValorEDataReceita(receita.id, valor, data), "Falha ao salvar valor/data.");
          }}
        >
          <input
            type="date"
            name="data_prevista"
            required
            autoFocus
            defaultValue={receita.data_prevista}
            className="rounded border border-gaiamum-primary bg-gaiamum-surface px-2 py-1 text-xs text-gaiamum-text outline-none"
          />
          <input
            type="number"
            name="valor"
            step="0.01"
            min="0.01"
            required
            defaultValue={receita.valor}
            className="w-24 rounded border border-gaiamum-primary bg-gaiamum-surface px-2 py-1 text-xs text-gaiamum-text outline-none"
          />
          <button type="submit" className="text-xs font-medium text-gaiamum-primary hover:underline">
            Salvar
          </button>
          <button type="button" onClick={() => setEditando(false)} className="text-xs text-gaiamum-text-muted hover:text-gaiamum-text">
            Cancelar
          </button>
        </form>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {receita.categoria && (
            <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-xs text-gaiamum-text-muted">
              {ROTULO_CATEGORIA_RECEITA[receita.categoria]}
            </span>
          )}
          {nomeProjeto && (
            <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-xs text-gaiamum-text-muted">
              📁 {nomeProjeto}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={excluir}
          disabled={pendente}
          className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger disabled:opacity-60"
        >
          Excluir
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gaiamum-border pt-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-gaiamum-text">Marcar como recebida</span>
          {receita.recebida && receita.data_recebimento && (
            <span className="text-xs text-gaiamum-text-muted">Recebida em {formatarData(receita.data_recebimento)}</span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={recebidaOtimista}
          aria-label="Marcar como recebida"
          onClick={alternarRecebida}
          disabled={pendente}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${
            recebidaOtimista ? "bg-gaiamum-success" : "bg-gaiamum-border"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${recebidaOtimista ? "left-5" : "left-0.5"}`}
          />
        </button>
      </div>
    </div>
  );
}

export function ListaReceitas({ receitas, nomesProjetos }: { receitas: Receita[]; nomesProjetos: Record<string, string> }) {
  if (receitas.length === 0) {
    return <p className="text-sm text-gaiamum-text-muted">Nenhuma receita lançada neste mês.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {receitas.map((receita) => (
        <Linha
          key={receita.id}
          receita={receita}
          nomeProjeto={receita.projeto_id ? (nomesProjetos[receita.projeto_id] ?? null) : null}
        />
      ))}
    </div>
  );
}
