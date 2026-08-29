"use client";

import { useState, useTransition } from "react";
import type { StatusTarefa, Tarefa } from "@/lib/ecc/tipos";
import { COLUNAS, urgenciaDoPrazo } from "@/lib/ecc/kanban";
import { deletarTarefa, moverTarefa } from "@/lib/ecc/actions";

const CLASSE_PRAZO: Record<ReturnType<typeof urgenciaDoPrazo>, string> = {
  atrasado: "border-gaiamum-danger text-gaiamum-danger",
  proximo: "border-gaiamum-warning text-gaiamum-warning",
  ok: "border-gaiamum-border text-gaiamum-text-muted",
  sem_prazo: "border-gaiamum-border text-gaiamum-text-muted",
};

export function QuadroKanban({
  projetoId,
  tarefasIniciais,
}: {
  projetoId: string;
  tarefasIniciais: Tarefa[];
}) {
  const [tarefas, setTarefas] = useState(tarefasIniciais);
  const [, iniciarTransicao] = useTransition();

  function moverPara(tarefaId: string, novoStatus: StatusTarefa) {
    setTarefas((atual) => atual.map((t) => (t.id === tarefaId ? { ...t, status: novoStatus } : t)));
    iniciarTransicao(() => moverTarefa(tarefaId, projetoId, novoStatus));
  }

  function excluir(tarefaId: string) {
    setTarefas((atual) => atual.filter((t) => t.id !== tarefaId));
    iniciarTransicao(() => deletarTarefa(tarefaId, projetoId));
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {COLUNAS.map((coluna) => {
        const tarefasDaColuna = tarefas.filter((t) => t.status === coluna.status);

        return (
          <div
            key={coluna.status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const tarefaId = e.dataTransfer.getData("text/tarefa-id");
              if (tarefaId) moverPara(tarefaId, coluna.status);
            }}
            className="flex min-h-[16rem] flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
              {coluna.titulo} <span className="text-gaiamum-text">({tarefasDaColuna.length})</span>
            </h2>

            {tarefasDaColuna.map((tarefa) => {
              const urgencia = urgenciaDoPrazo(tarefa);

              return (
                <div
                  key={tarefa.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/tarefa-id", tarefa.id);
                  }}
                  className="cursor-grab rounded-xl border border-gaiamum-border bg-gaiamum-surface-raised p-3 transition active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gaiamum-text">{tarefa.titulo}</p>
                    <button
                      type="button"
                      onClick={() => excluir(tarefa.id)}
                      className="shrink-0 text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted">
                      {tarefa.prioridade}
                    </span>
                    {tarefa.tag && (
                      <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted">
                        {tarefa.tag}
                      </span>
                    )}
                    {tarefa.data_limite && (
                      <span className={`rounded-full border px-2 py-0.5 ${CLASSE_PRAZO[urgencia]}`}>
                        {new Date(`${tarefa.data_limite}T00:00:00`).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>

                  {coluna.status !== "concluido" && (
                    <div className="mt-3 flex gap-2">
                      {COLUNAS.filter((c) => c.status !== coluna.status).map((destino) => (
                        <button
                          key={destino.status}
                          type="button"
                          onClick={() => moverPara(tarefa.id, destino.status)}
                          className="text-xs text-gaiamum-primary hover:underline"
                        >
                          → {destino.titulo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
