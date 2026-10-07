// Classes compartilhadas do Planner. Arquivo SEM "use client" de propósito:
// constante exportada de um módulo de cliente chega num Server Component como
// referência de cliente, não como texto (os blocos da visão da área ficaram
// sem borda/fundo por isso).

export const CLASSE_CAMPO =
  "rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary focus-visible:ring-2 focus-visible:ring-gaiamum-primary/40";

export const CLASSE_CARD = "rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5";

export const CLASSE_BOTAO_PRIMARIO =
  "rounded-lg bg-gaiamum-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gaiamum-primary";

export const CLASSE_BOTAO_SECUNDARIO =
  "rounded-lg border border-gaiamum-border px-4 py-2 text-sm font-medium text-gaiamum-text transition hover:bg-gaiamum-surface-raised disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gaiamum-primary";

/** "Editar" discreto ao lado de "Excluir" nas listas. */
export const CLASSE_LINK_EDITAR =
  "text-xs text-gaiamum-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-gaiamum-primary";

export const CLASSE_BOTAO_RODAPE_CARD =
  "mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-gaiamum-primary/10 px-4 py-2.5 text-sm font-medium text-gaiamum-primary transition hover:bg-gaiamum-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gaiamum-primary";
