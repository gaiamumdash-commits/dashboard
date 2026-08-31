"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Anexo, ChecklistItem, ColunaKanban, Etiqueta, MembroTenant, Tarefa, TarefaEtiqueta, TarefaMembro } from "@/lib/ecc/tipos";
import {
  criarColuna,
  criarTarefa,
  deletarTarefa,
  excluirColuna,
  moverTarefa,
  renomearColuna,
} from "@/lib/ecc/actions";
import { DetalheTarefa } from "@/components/kanban/detalhe-tarefa";
import { CartaoTarefa } from "@/components/kanban/cartao-tarefa";

export function QuadroKanban({
  projetoId,
  colunasIniciais,
  tarefasIniciais,
  membrosDoTenant,
  tarefaMembrosIniciais,
  checklistItensIniciais,
  etiquetasDoTenant,
  tarefaEtiquetasIniciais,
  anexosIniciais,
  usuarioAtualId,
  podeExcluirTarefa,
}: {
  projetoId: string;
  colunasIniciais: ColunaKanban[];
  tarefasIniciais: Tarefa[];
  membrosDoTenant: MembroTenant[];
  tarefaMembrosIniciais: TarefaMembro[];
  checklistItensIniciais: ChecklistItem[];
  etiquetasDoTenant: Etiqueta[];
  tarefaEtiquetasIniciais: TarefaEtiqueta[];
  anexosIniciais: Anexo[];
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
          const membrosDaTarefa = tarefaMembrosIniciais.filter((m) => m.tarefa_id === tarefa.id);
          const souResponsavel = Boolean(
            usuarioAtualId && membrosDaTarefa.some((m) => m.user_id === usuarioAtualId),
          );

          return (
            <CartaoTarefa
              key={tarefa.id}
              tarefa={tarefa}
              coluna={coluna}
              projetoId={projetoId}
              checklistDaTarefa={checklistItensIniciais.filter((c) => c.tarefa_id === tarefa.id)}
              anexosDaTarefa={anexosIniciais.filter((a) => a.entidade_id === tarefa.id)}
              membrosDaTarefa={membrosDaTarefa}
              membrosDoTenant={membrosDoTenant}
              etiquetasDaTarefa={tarefaEtiquetasIniciais.filter((te) => te.tarefa_id === tarefa.id)}
              etiquetasDoTenant={etiquetasDoTenant}
              souResponsavel={souResponsavel}
              podeExcluir={podeExcluirTarefa}
              onAbrir={() => setTarefaAbertaId(tarefa.id)}
              onExcluir={() => excluir(tarefa.id)}
            />
          );
        })}

        <form
          action={async (formData) => {
            await criarTarefa(projetoId, coluna.id, formData);
            router.refresh();
          }}
        >
          <input
            name="titulo"
            required
            placeholder="+ Adicionar cartão"
            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-gaiamum-text-muted outline-none transition hover:border-gaiamum-border focus:border-gaiamum-primary focus:bg-gaiamum-surface-raised focus:text-gaiamum-text"
          />
        </form>
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
          etiquetasDoTenant={etiquetasDoTenant}
          etiquetasDaTarefa={tarefaEtiquetasIniciais
            .filter((te) => te.tarefa_id === tarefaAberta.id)
            .map((te) => te.etiqueta_id)}
          anexos={anexosIniciais.filter((a) => a.entidade_id === tarefaAberta.id)}
          aoFechar={fecharModal}
        />
      )}
    </>
  );
}
