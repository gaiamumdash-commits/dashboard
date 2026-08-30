"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChecklistItem, MembroTenant, Tarefa } from "@/lib/ecc/tipos";
import {
  adicionarChecklistItem,
  alternarChecklistItem,
  alternarMembroTarefa,
  atualizarDescricaoTarefa,
  removerChecklistItem,
} from "@/lib/ecc/actions";

export function DetalheTarefa({
  tarefa,
  projetoId,
  membrosDoTenant,
  membrosDaTarefa,
  checklist,
  aoFechar,
}: {
  tarefa: Tarefa;
  projetoId: string;
  membrosDoTenant: MembroTenant[];
  membrosDaTarefa: string[];
  checklist: ChecklistItem[];
  aoFechar: () => void;
}) {
  const [descricao, setDescricao] = useState(tarefa.descricao ?? "");
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();

  const concluidos = checklist.filter((item) => item.concluido).length;

  function salvarDescricao() {
    iniciarTransicao(async () => {
      const formData = new FormData();
      formData.set("descricao", descricao);
      await atualizarDescricaoTarefa(tarefa.id, projetoId, formData);
      router.refresh();
    });
  }

  function alternarMembro(userId: string) {
    iniciarTransicao(async () => {
      await alternarMembroTarefa(tarefa.id, userId, projetoId);
      router.refresh();
    });
  }

  function alternarItem(itemId: string, concluido: boolean) {
    iniciarTransicao(async () => {
      await alternarChecklistItem(itemId, tarefa.id, concluido, projetoId);
      router.refresh();
    });
  }

  function removerItem(itemId: string) {
    iniciarTransicao(async () => {
      await removerChecklistItem(itemId, tarefa.id, projetoId);
      router.refresh();
    });
  }

  function adicionarItem(formData: FormData) {
    iniciarTransicao(async () => {
      await adicionarChecklistItem(tarefa.id, projetoId, formData);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
      onClick={aoFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-gaiamum-text">{tarefa.titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            className="shrink-0 text-gaiamum-text-muted hover:text-gaiamum-text"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gaiamum-text-muted">Descrição</span>
          <textarea
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onBlur={salvarDescricao}
            placeholder="Adicionar uma descrição..."
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
          />
        </div>

        <div className="mt-5">
          <span className="text-xs font-medium text-gaiamum-text-muted">Membros</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {membrosDoTenant.map((membro) => {
              const ativo = membrosDaTarefa.includes(membro.user_id);
              return (
                <button
                  key={membro.user_id}
                  type="button"
                  onClick={() => alternarMembro(membro.user_id)}
                  title={membro.email}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                    ativo
                      ? "bg-gaiamum-primary text-white"
                      : "border border-gaiamum-border bg-gaiamum-surface-raised text-gaiamum-text-muted hover:border-gaiamum-primary"
                  }`}
                >
                  {membro.email.slice(0, 2).toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gaiamum-text-muted">Checklist</span>
            {checklist.length > 0 && (
              <span className="text-xs text-gaiamum-text-muted">
                {concluidos}/{checklist.length}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.concluido}
                  onChange={(e) => alternarItem(item.id, e.target.checked)}
                  className="h-4 w-4 accent-[var(--gaiamum-primary)]"
                />
                <span
                  className={`flex-1 text-sm ${item.concluido ? "text-gaiamum-text-muted line-through" : "text-gaiamum-text"}`}
                >
                  {item.texto}
                </span>
                <button
                  type="button"
                  onClick={() => removerItem(item.id)}
                  className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <form action={adicionarItem} className="mt-2 flex gap-2">
            <input
              name="texto"
              required
              placeholder="Adicionar item"
              className="flex-1 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-1.5 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
            />
            <button
              type="submit"
              className="rounded-lg border border-gaiamum-border px-3 py-1.5 text-sm text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
            >
              Adicionar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
