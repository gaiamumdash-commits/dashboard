"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { ChecklistItem, ColunaKanban, MembroTenant, Tarefa, TarefaMembro } from "@/lib/ecc/tipos";
import { urgenciaDoPrazo } from "@/lib/ecc/kanban";
import { criarColuna, deletarTarefa, excluirColuna, moverTarefa, renomearColuna } from "@/lib/ecc/actions";
import { DetalheTarefa } from "@/components/kanban/detalhe-tarefa";

const CLASSE_PRAZO: Record<ReturnType<typeof urgenciaDoPrazo>, string> = {
  atrasado: "border-gaiamum-danger text-gaiamum-danger",
  proximo: "border-gaiamum-warning text-gaiamum-warning",
  ok: "border-gaiamum-border text-gaiamum-text-muted",
  sem_prazo: "border-gaiamum-border text-gaiamum-text-muted",
};

export function QuadroKanban({
  projetoId,
  colunasIniciais,
  tarefasIniciais,
  membrosDoTenant,
  tarefaMembrosIniciais,
  checklistItensIniciais,
  usuarioAtualId,
  podeExcluirTarefa,
}: {
  projetoId: string;
  colunasIniciais: ColunaKanban[];
  tarefasIniciais: Tarefa[];
  membrosDoTenant: MembroTenant[];
  tarefaMembrosIniciais: TarefaMembro[];
  checklistItensIniciais: ChecklistItem[];
  usuarioAtualId: string | null;
  podeExcluirTarefa: boolean;
}) {
  const [tarefas, setTarefas] = useState(tarefasIniciais);
  const [tarefaAbertaId, setTarefaAbertaId] = useState<string | null>(null);
  const [colunaEditandoId, setColunaEditandoId] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();

  function moverPara(tarefaId: string, novaColunaId: string) {
    setTarefas((atual) => atual.map((t) => (t.id === tarefaId ? { ...t, coluna_id: novaColunaId } : t)));
    iniciarTransicao(() => moverTarefa(tarefaId, projetoId, novaColunaId));
  }

  function excluir(tarefaId: string) {
    setTarefas((atual) => atual.filter((t) => t.id !== tarefaId));
    iniciarTransicao(() => deletarTarefa(tarefaId, projetoId));
  }

  async function apagarColuna(colunaId: string) {
    if (!window.confirm("Apagar esta coluna?")) return;
    try {
      await excluirColuna(colunaId, projetoId);
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Falha ao excluir coluna.");
    }
  }

  function fecharModal() {
    setTarefaAbertaId(null);
    router.refresh();
  }

  const tarefaAberta = tarefas.find((t) => t.id === tarefaAbertaId) ?? null;
  const colunasAbertas = colunasIniciais.filter((c) => !c.concluido);
  const colunaFixa = colunasIniciais.find((c) => c.concluido) ?? null;

  function renderColuna(coluna: ColunaKanban, ehFixa: boolean) {
    const tarefasDaColuna = tarefas.filter((t) => t.coluna_id === coluna.id);

    return (
      <div
        key={coluna.id}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const tarefaId = e.dataTransfer.getData("text/tarefa-id");
          if (tarefaId) moverPara(tarefaId, coluna.id);
        }}
        className="flex min-h-[16rem] w-72 shrink-0 flex-col gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4"
      >
        <div className="flex items-center justify-between gap-2">
          {colunaEditandoId === coluna.id ? (
            <form
              action={async (formData) => {
                await renomearColuna(coluna.id, projetoId, formData);
                setColunaEditandoId(null);
                router.refresh();
              }}
              className="flex flex-1 gap-1"
            >
              <input
                name="nome"
                defaultValue={coluna.nome}
                autoFocus
                required
                onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                className="w-full rounded border border-gaiamum-primary bg-gaiamum-surface-raised px-2 py-0.5 text-sm text-gaiamum-text outline-none"
              />
            </form>
          ) : (
            <h2
              onClick={() => !ehFixa && setColunaEditandoId(coluna.id)}
              className={`text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted ${
                ehFixa ? "" : "cursor-text hover:text-gaiamum-text"
              }`}
              title={ehFixa ? undefined : "Clique para renomear"}
            >
              {coluna.nome} <span className="text-gaiamum-text">({tarefasDaColuna.length})</span>
            </h2>
          )}
          {!ehFixa && podeExcluirTarefa && colunaEditandoId !== coluna.id && (
            <button
              type="button"
              onClick={() => apagarColuna(coluna.id)}
              className="shrink-0 text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
              title="Excluir coluna"
            >
              ✕
            </button>
          )}
        </div>

        {tarefasDaColuna.map((tarefa) => {
          const urgencia = urgenciaDoPrazo(tarefa, coluna.concluido);
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
                  className="flex items-center gap-1.5 text-left text-sm text-gaiamum-text hover:underline"
                >
                  {coluna.concluido && (
                    <Image
                      src="/brand/crab-mark.png"
                      alt=""
                      width={16}
                      height={16}
                      className="shrink-0"
                      title="Concluído!"
                    />
                  )}
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

              <div className="mt-3 flex flex-wrap gap-2">
                {colunasIniciais
                  .filter((c) => c.id !== coluna.id)
                  .map((destino) => (
                    <button
                      key={destino.id}
                      type="button"
                      onClick={() => moverPara(tarefa.id, destino.id)}
                      className="text-xs text-gaiamum-primary hover:underline"
                    >
                      → {destino.nome}
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {colunasAbertas.map((coluna) => renderColuna(coluna, false))}

        <form
          action={async (formData) => {
            await criarColuna(projetoId, formData);
            router.refresh();
          }}
          className="flex h-fit w-72 shrink-0 flex-col gap-2 rounded-2xl border border-dashed border-gaiamum-border bg-gaiamum-surface/50 p-4"
        >
          <input
            name="nome"
            required
            placeholder="Nome da nova coluna"
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
          />
          <button
            type="submit"
            className="rounded-lg border border-gaiamum-border px-3 py-1.5 text-sm text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text"
          >
            + Nova coluna
          </button>
        </form>

        {colunaFixa && renderColuna(colunaFixa, true)}
      </div>

      {tarefaAberta && (
        <DetalheTarefa
          tarefa={tarefaAberta}
          projetoId={projetoId}
          colunasDoProjeto={colunasIniciais}
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
