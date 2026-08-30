"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChecklistItem, MembroTenant, StatusTarefa, Tarefa, TarefaMembro } from "@/lib/ecc/tipos";
import { COLUNAS, urgenciaDoPrazo } from "@/lib/ecc/kanban";
import { deletarTarefa, moverTarefa } from "@/lib/ecc/actions";
import { DetalheTarefa } from "@/components/kanban/detalhe-tarefa";

const CLASSE_PRAZO: Record<ReturnType<typeof urgenciaDoPrazo>, string> = {
  atrasado: "border-gaiamum-danger text-gaiamum-danger",
  proximo: "border-gaiamum-warning text-gaiamum-warning",
  ok: "border-gaiamum-border text-gaiamum-text-muted",
  sem_prazo: "border-gaiamum-border text-gaiamum-text-muted",
};

export function QuadroKanban({
  projetoId,
  tarefasIniciais,
  membrosDoTenant,
  tarefaMembrosIniciais,
  checklistItensIniciais,
  usuarioAtualId,
  podeExcluirTarefa,
}: {
  projetoId: string;
  tarefasIniciais: Tarefa[];
  membrosDoTenant: MembroTenant[];
  tarefaMembrosIniciais: TarefaMembro[];
  checklistItensIniciais: ChecklistItem[];
  usuarioAtualId: string | null;
  podeExcluirTarefa: boolean;
}) {
  const [tarefas, setTarefas] = useState(tarefasIniciais);
  const [tarefaAbertaId, setTarefaAbertaId] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();

  function moverPara(tarefaId: string, novoStatus: StatusTarefa) {
    setTarefas((atual) => atual.map((t) => (t.id === tarefaId ? { ...t, status: novoStatus } : t)));
    iniciarTransicao(() => moverTarefa(tarefaId, projetoId, novoStatus));
  }

  function excluir(tarefaId: string) {
    setTarefas((atual) => atual.filter((t) => t.id !== tarefaId));
    iniciarTransicao(() => deletarTarefa(tarefaId, projetoId));
  }

  function fecharModal() {
    setTarefaAbertaId(null);
    router.refresh();
  }

  const tarefaAberta = tarefas.find((t) => t.id === tarefaAbertaId) ?? null;

  return (
    <>
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
                const checklistDaTarefa = checklistItensIniciais.filter((c) => c.tarefa_id === tarefa.id);
                const concluidos = checklistDaTarefa.filter((c) => c.concluido).length;
                const membrosDaTarefa = tarefaMembrosIniciais.filter((m) => m.tarefa_id === tarefa.id);
                const souResponsavel = Boolean(
                  usuarioAtualId && membrosDaTarefa.some((m) => m.user_id === usuarioAtualId),
                );

                return (
                  <div
                    key={tarefa.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/tarefa-id", tarefa.id);
                    }}
                    className={`cursor-grab rounded-xl border bg-gaiamum-surface-raised p-3 transition active:cursor-grabbing ${
                      souResponsavel ? "border-l-4 border-gaiamum-primary" : "border-gaiamum-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setTarefaAbertaId(tarefa.id)}
                        className="text-left text-sm text-gaiamum-text hover:underline"
                      >
                        {tarefa.titulo}
                      </button>
                      {podeExcluirTarefa && (
                        <button
                          type="button"
                          onClick={() => excluir(tarefa.id)}
                          className="shrink-0 text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
                        >
                          ✕
                        </button>
                      )}
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
                      {checklistDaTarefa.length > 0 && (
                        <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted">
                          ☑ {concluidos}/{checklistDaTarefa.length}
                        </span>
                      )}
                    </div>

                    {membrosDaTarefa.length > 0 && (
                      <div className="mt-2 flex -space-x-1.5">
                        {membrosDaTarefa.map((tm) => {
                          const membro = membrosDoTenant.find((m) => m.user_id === tm.user_id);
                          return (
                            <span
                              key={tm.id}
                              title={membro?.email}
                              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gaiamum-surface-raised bg-gaiamum-primary text-[10px] font-semibold text-white"
                            >
                              {(membro?.email ?? "?").slice(0, 2).toUpperCase()}
                            </span>
                          );
                        })}
                      </div>
                    )}

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

      {tarefaAberta && (
        <DetalheTarefa
          tarefa={tarefaAberta}
          projetoId={projetoId}
          membrosDoTenant={membrosDoTenant}
          membrosDaTarefa={tarefaMembrosIniciais
            .filter((m) => m.tarefa_id === tarefaAberta.id)
            .map((m) => m.user_id)}
          checklist={checklistItensIniciais.filter((c) => c.tarefa_id === tarefaAberta.id)}
          aoFechar={fecharModal}
        />
      )}
    </>
  );
}
