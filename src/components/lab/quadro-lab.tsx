"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { ColunaKanban, Tarefa } from "@/lib/ecc/tipos";
import { CLASSE_PRAZO, urgenciaDoPrazo } from "@/lib/ecc/kanban";
import { moverTarefaLab } from "@/lib/ecc/lab/actions";

/** Versão simplificada e só-do-Lab do quadro Kanban — sem criar/apagar
 * cartão ou coluna, sem checklist/membros/etiquetas (o Café Mangue é
 * conteúdo fixo). Não reaproveita `QuadroKanban`/`actions.ts` de propósito:
 * essas Server Actions resolvem tenant via garantirWorkspace() (o tenant
 * REAL do usuário), então usá-las aqui gravaria tenant_id real + projeto_id
 * do Lab na mesma linha — dado corrompido que pode vazar pro dashboard real
 * como cartão fantasma. `moverTarefaLab` resolve tenant via
 * garantirTenantLab(), sempre o tenant certo. */
export function QuadroLab({
  colunasIniciais,
  tarefasIniciais,
}: {
  colunasIniciais: ColunaKanban[];
  tarefasIniciais: Tarefa[];
}) {
  const [tarefas, setTarefas] = useState(tarefasIniciais);
  const [, iniciarTransicao] = useTransition();

  function moverPara(tarefaId: string, novaColunaId: string) {
    const colunaAnterior = tarefas.find((t) => t.id === tarefaId)?.coluna_id;
    if (colunaAnterior === novaColunaId) return;

    setTarefas((atual) => atual.map((t) => (t.id === tarefaId ? { ...t, coluna_id: novaColunaId } : t)));
    iniciarTransicao(() => {
      moverTarefaLab(tarefaId, novaColunaId).catch((err) => {
        if (colunaAnterior) {
          setTarefas((atual) => atual.map((t) => (t.id === tarefaId ? { ...t, coluna_id: colunaAnterior } : t)));
        }
        toast.error(mensagemDeErro(err, "Falha ao mover cartão."));
      });
    });
  }

  const colunasOrdenadas = [...colunasIniciais].sort((a, b) => {
    if (a.concluido !== b.concluido) return a.concluido ? 1 : -1;
    return a.ordem - b.ordem;
  });

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {colunasOrdenadas.map((coluna) => {
        const tarefasDaColuna = tarefas.filter((t) => t.coluna_id === coluna.id);

        return (
          <div
            key={coluna.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => moverPara(e.dataTransfer.getData("text/tarefa-id"), coluna.id)}
            className="flex min-h-[14rem] w-64 shrink-0 flex-col gap-2.5 rounded-xl border border-gaiamum-border bg-gaiamum-surface p-3"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
              {coluna.nome} <span className="text-gaiamum-text">({tarefasDaColuna.length})</span>
            </h2>

            {tarefasDaColuna.map((tarefa) => {
              const urgencia = urgenciaDoPrazo(tarefa, coluna.concluido);
              return (
                <div
                  key={tarefa.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/tarefa-id", tarefa.id)}
                  className="cursor-grab rounded-xl border-2 border-gaiamum-border-forte bg-gaiamum-surface-raised p-3 shadow-sm active:cursor-grabbing"
                >
                  <p className="text-sm font-medium text-gaiamum-text">{tarefa.titulo}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted">
                      {tarefa.prioridade}
                    </span>
                    {tarefa.is_marco && (
                      <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted">
                        🚩 Marco
                      </span>
                    )}
                    {tarefa.data_limite && (
                      <span className={`rounded-full border px-2 py-0.5 ${CLASSE_PRAZO[urgencia]}`}>
                        {new Date(tarefa.data_limite).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
