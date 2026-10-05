"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const CHAVE_LOCALSTORAGE = "gaiamum-menu-recolhido";

// Mesmo padrão de `theme-toggle.tsx` (useSyncExternalStore pra ler um valor
// externo — aqui, `localStorage` — de forma segura em React, sem o
// anti-padrão de `setState` dentro de `useEffect`, que dispara
// re-renderização em cascata desnecessária e é rejeitado pelo lint do
// projeto, `react-hooks/set-state-in-effect`). O servidor não tem acesso a
// `localStorage`, então `obterRecolhidoServidor` sempre "vê" expandido — a
// 1ª pintura real do navegador reconcilia com o valor salvo logo depois,
// sem o mismatch de hidratação que descartaria a árvore inteira.
const ouvintes = new Set<() => void>();

function obterRecolhido(): boolean {
  try {
    return localStorage.getItem(CHAVE_LOCALSTORAGE) === "1";
  } catch {
    return false;
  }
}

function obterRecolhidoServidor(): boolean {
  return false;
}

function inscrever(callback: () => void): () => void {
  ouvintes.add(callback);
  return () => ouvintes.delete(callback);
}

function definirRecolhido(valor: boolean) {
  try {
    localStorage.setItem(CHAVE_LOCALSTORAGE, valor ? "1" : "0");
  } catch {
    // Ambiente sem localStorage (modo privado, storage bloqueado) — só não
    // persiste; o alternar ainda funciona nesta sessão via `ouvintes`.
  }
  ouvintes.forEach((callback) => callback());
}

/** Casca cliente do menu lateral de desktop — pedido do Fabio (2026-10-04):
 * "quero usar o cartão Kanban na tela inteira... deixa o menu retrátil, ela
 * entra, quando clica ela expande". O `<aside>` em si (critério de
 * visibilidade desktop+mouse) continua decidido em `menu-lateral.tsx` —
 * este componente só adiciona a largura retrátil por cima. O conteúdo
 * (sino, links, patente, e-mail) continua vindo de `menu-lateral.tsx` como
 * children, incluindo os pedaços `async`/`<Suspense>` dele — o mesmo padrão
 * de "slot" já usado no resto do arquivo funciona igual aqui.
 *
 * Preferência persistida em `localStorage` (por navegador, não por conta):
 * quem recolhe uma vez continua recolhido nas próximas visitas, sem
 * precisar repetir o clique toda hora. */
export function MenuLateralRetratil({ children }: { children: ReactNode }) {
  const recolhido = useSyncExternalStore(inscrever, obterRecolhido, obterRecolhidoServidor);

  return (
    <aside
      className={`hidden h-screen shrink-0 flex-col self-start overflow-hidden border-r border-gaiamum-border bg-gaiamum-surface transition-[width] duration-200 [@media(min-width:640px)_and_(pointer:fine)]:sticky [@media(min-width:640px)_and_(pointer:fine)]:top-0 [@media(min-width:640px)_and_(pointer:fine)]:flex ${
        recolhido ? "w-14 px-2 py-6" : "w-60 px-4 py-6"
      }`}
    >
      <button
        type="button"
        onClick={() => definirRecolhido(!recolhido)}
        aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
        title={recolhido ? "Expandir menu" : "Recolher menu"}
        className={`mb-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gaiamum-text-muted transition hover:bg-gaiamum-surface-raised hover:text-gaiamum-text ${
          recolhido ? "self-center" : "self-end"
        }`}
      >
        {recolhido ? "»" : "«"}
      </button>

      {/* `hidden` (display:none), não desmontar: o conteúdo já pode ter
          vindo de Suspense já resolvido (sino, patente, links) — escondê-lo
          mantém tudo pronto pra reaparecer na hora, sem refazer nenhuma
          consulta ao servidor quando a pessoa expandir de novo. */}
      <div className={`min-h-0 flex-1 flex-col ${recolhido ? "hidden" : "flex"}`}>{children}</div>
    </aside>
  );
}
