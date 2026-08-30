"use client";

import { useSyncExternalStore } from "react";

const CHAVE_STORAGE = "gaiamum-theme";
const ouvintes = new Set<() => void>();

function inscrever(callback: () => void) {
  ouvintes.add(callback);
  return () => ouvintes.delete(callback);
}

function obterTema(): "light" | "dark" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

// O servidor não tem acesso a `document`/localStorage, então sempre "vê"
// dark. O script inline em layout.tsx já aplica o tema real no <html> antes
// do paint; useSyncExternalStore reconcilia esse valor com segurança depois
// da hidratação, sem o mismatch que antes descartava a árvore inteira.
function obterTemaServidor(): "light" | "dark" {
  return "dark";
}

function aplicarTema(tema: "light" | "dark") {
  document.documentElement.dataset.theme = tema === "light" ? "light" : "";
  localStorage.setItem(CHAVE_STORAGE, tema);
  ouvintes.forEach((callback) => callback());
}

export function ThemeToggle() {
  const tema = useSyncExternalStore(inscrever, obterTema, obterTemaServidor);

  function alternar() {
    aplicarTema(tema === "light" ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={tema === "light" ? "Mudar para tema escuro" : "Mudar para tema claro"}
      className="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-gaiamum-border bg-gaiamum-surface text-gaiamum-text-muted transition hover:text-gaiamum-text"
    >
      {tema === "light" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  );
}
