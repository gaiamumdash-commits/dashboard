"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type {
  Anexo,
  ChecklistItem,
  ColunaKanban,
  Etiqueta,
  MembroTenant,
  Tarefa,
  TarefaEtiqueta,
  TarefaMembro,
} from "@/lib/ecc/tipos";
import { CLASSE_COR_ETIQUETA, CLASSE_PRAZO, urgenciaDoPrazo } from "@/lib/ecc/kanban";
import { atualizarTituloTarefa } from "@/lib/ecc/actions";

/** Cartão em 2 andares: o de cima só renomeia (clique no título vira um
 * campo de texto), o de baixo abre o cartão por dentro — os quick-move
 * buttons dentro do andar de baixo têm stopPropagation pra não abrir o
 * modal junto. O elemento arrastável é o cartão inteiro, os dois andares
 * se movem juntos porque são uma coisa só. Pedido do Fabio depois de
 * confundir "renomear" com "abrir" no cartão de uma peça só. */
export function CartaoTarefa({
  tarefa,
  coluna,
  colunasDoQuadro,
  projetoId,
  checklistDaTarefa,
  anexosDaTarefa,
  membrosDaTarefa,
  membrosDoTenant,
  etiquetasDaTarefa,
  etiquetasDoTenant,
  souResponsavel,
  podeExcluir,
  onAbrir,
  onMover,
  onExcluir,
}: {
  tarefa: Tarefa;
  coluna: ColunaKanban;
  colunasDoQuadro: ColunaKanban[];
  projetoId: string;
  checklistDaTarefa: ChecklistItem[];
  anexosDaTarefa: Anexo[];
  membrosDaTarefa: TarefaMembro[];
  membrosDoTenant: MembroTenant[];
  etiquetasDaTarefa: TarefaEtiqueta[];
  etiquetasDoTenant: Etiqueta[];
  souResponsavel: boolean;
  podeExcluir: boolean;
  onAbrir: () => void;
  onMover: (novaColunaId: string) => void;
  onExcluir: () => void;
}) {
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();

  const urgencia = urgenciaDoPrazo(tarefa, coluna.concluido);
  const concluidos = checklistDaTarefa.filter((c) => c.concluido).length;

  function salvarTitulo(novoTitulo: string) {
    setEditandoTitulo(false);
    if (!novoTitulo.trim() || novoTitulo.trim() === tarefa.titulo) return;
    iniciarTransicao(async () => {
      await atualizarTituloTarefa(tarefa.id, projetoId, novoTitulo);
      router.refresh();
    });
  }

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/tarefa-id", tarefa.id)}
      className={`cursor-grab overflow-hidden rounded-xl border bg-gaiamum-surface-raised shadow-sm transition hover:shadow-md active:cursor-grabbing ${
        souResponsavel ? "border-gaiamum-border border-l-4 border-l-gaiamum-primary" : "border-gaiamum-border"
      }`}
    >
      {/* Andar 1 — título, só renomeia */}
      <div className="flex items-center gap-1.5 border-b border-gaiamum-border bg-gaiamum-surface px-3 py-1.5">
        {coluna.concluido && (
          <Image
            src="/brand/crab-mark.png"
            alt=""
            width={14}
            height={14}
            className="shrink-0"
            title="Concluído!"
          />
        )}
        {editandoTitulo ? (
          <input
            autoFocus
            defaultValue={tarefa.titulo}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => salvarTitulo(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditandoTitulo(false);
            }}
            className="w-full rounded border border-gaiamum-primary bg-gaiamum-surface-raised px-1.5 py-0.5 text-sm text-gaiamum-text outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditandoTitulo(true)}
            title="Clique para renomear"
            className="flex-1 truncate text-left text-sm font-medium text-gaiamum-text hover:text-gaiamum-primary"
          >
            {tarefa.titulo}
          </button>
        )}
        {podeExcluir && (
          <button
            type="button"
            onClick={onExcluir}
            className="shrink-0 text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
          >
            ✕
          </button>
        )}
      </div>

      {/* Andar 2 — corpo do cartão, abre o modal */}
      <div onClick={onAbrir} className="cursor-pointer p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted">
            {tarefa.prioridade}
          </span>
          {etiquetasDaTarefa.map((te) => {
            const etiqueta = etiquetasDoTenant.find((e) => e.id === te.etiqueta_id);
            if (!etiqueta) return null;
            return (
              <span key={te.id} className={`rounded-full border px-2 py-0.5 ${CLASSE_COR_ETIQUETA[etiqueta.cor]}`}>
                {etiqueta.nome}
              </span>
            );
          })}
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
          {anexosDaTarefa.length > 0 && (
            <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-gaiamum-text-muted">
              📎 {anexosDaTarefa.length}
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

        <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {colunasDoQuadro
            .filter((c) => c.id !== coluna.id)
            .map((destino) => (
              <button
                key={destino.id}
                type="button"
                onClick={() => onMover(destino.id)}
                className="text-xs text-gaiamum-primary hover:underline"
              >
                → {destino.nome}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
