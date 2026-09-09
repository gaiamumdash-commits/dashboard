"use client";

import type { ReactNode } from "react";

/** Modal genérico — mesmo padrão visual já usado (antes de forma duplicada)
 * em detalhe-tarefa.tsx e detalhe-item-agenda.tsx. Sem focus trap, Escape
 * ou aria-modal: mantém o mesmo nível dos modais que ainda não migraram
 * pra cá, não é escopo desta etapa endurecer acessibilidade. */
export function Dialog({
  titulo,
  aoFechar,
  largura = "lg",
  acoesExtras,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  largura?: "md" | "lg";
  acoesExtras?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
      onClick={aoFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6 ${
          largura === "md" ? "max-w-md" : "max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-gaiamum-text">{titulo}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {acoesExtras}
            <button type="button" onClick={aoFechar} className="text-gaiamum-text-muted hover:text-gaiamum-text">
              ✕
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
