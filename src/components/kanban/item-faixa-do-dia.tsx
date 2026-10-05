import type { ReactNode } from "react";

/** Um bloco da "faixa contextual do dia" do Kanban (mockup aprovado,
 * 2026-10-05): ícone em ladrilho + rótulo pequeno + valor. Sem "use client"
 * de propósito — usado tanto pelo item servidor (próximo compromisso, em
 * `<Suspense>`) quanto pelos itens cliente (prazo, foco ativo). */
export function ItemFaixaDoDia({
  icone,
  tomIcone = "azul",
  rotulo,
  children,
  acao,
  className = "",
}: {
  icone: ReactNode;
  tomIcone?: "azul" | "amarelo" | "vermelho" | "neutro";
  rotulo?: ReactNode;
  children: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  const classeTom = {
    azul: "bg-gaiamum-primary/15 text-gaiamum-primary",
    amarelo: "bg-gaiamum-warning/15 text-gaiamum-warning",
    vermelho: "bg-gaiamum-danger/15 text-gaiamum-danger",
    neutro: "bg-gaiamum-surface-raised text-gaiamum-text-muted",
  }[tomIcone];

  return (
    <div className={`flex min-w-[14.5rem] shrink-0 snap-start items-center gap-3 px-4 py-2.5 lg:min-w-0 ${className}`}>
      <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${classeTom}`}>
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        {rotulo && <p className="truncate text-xs text-gaiamum-text-muted">{rotulo}</p>}
        <div className="truncate text-sm text-gaiamum-text">{children}</div>
      </div>
      {acao}
    </div>
  );
}
