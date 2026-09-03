"use client";

import { useSyncExternalStore } from "react";

const CHAVE_STORAGE = "gaiamum-theme";
const ouvintes = new Set<() => void>();

type Tema = "light" | "navy" | "black";

const OPCOES: { valor: Tema; rotulo: string; cor: string }[] = [
  { valor: "light", rotulo: "Tema claro", cor: "#f5f6f8" },
  { valor: "navy", rotulo: "Tema azul", cor: "#011f51" },
  { valor: "black", rotulo: "Tema preto", cor: "#08090d" },
];

function inscrever(callback: () => void) {
  ouvintes.add(callback);
  return () => ouvintes.delete(callback);
}

function obterTema(): Tema {
  const atual = document.documentElement.dataset.theme;
  return atual === "light" || atual === "black" ? atual : "navy";
}

// O servidor não tem acesso a `document`/localStorage, então sempre "vê"
// navy. O script inline em layout.tsx já aplica o tema real no <html> antes
// do paint; useSyncExternalStore reconcilia esse valor com segurança depois
// da hidratação, sem o mismatch que descartaria a árvore inteira.
function obterTemaServidor(): Tema {
  return "navy";
}

function aplicarTema(tema: Tema) {
  document.documentElement.dataset.theme = tema === "navy" ? "" : tema;
  localStorage.setItem(CHAVE_STORAGE, tema);
  ouvintes.forEach((callback) => callback());
}

/** Miolo sem posicionamento — reaproveitado pelo botão flutuante (desktop)
 * e pelo rodapé do drawer mobile (MenuMobile), que precisa do seletor sem
 * `fixed`/`z-50` pra não competir com o cabeçalho mobile. */
export function SeletorTema({ className = "" }: { className?: string }) {
  const tema = useSyncExternalStore(inscrever, obterTema, obterTemaServidor);

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border border-gaiamum-border bg-gaiamum-surface p-1.5 ${className}`}
    >
      {OPCOES.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          onClick={() => aplicarTema(opcao.valor)}
          aria-label={opcao.rotulo}
          aria-pressed={tema === opcao.valor}
          title={opcao.rotulo}
          className={`h-6 w-6 rounded-full border-2 transition ${
            tema === opcao.valor
              ? "border-gaiamum-primary scale-110"
              : "border-transparent hover:border-gaiamum-border"
          }`}
          style={{ backgroundColor: opcao.cor }}
        />
      ))}
    </div>
  );
}

export function ThemeToggle() {
  // Escondido no mobile: colidiria com o cabeçalho fixo de MenuMobile
  // (sino/hambúrguer no canto superior direito, mesma região). No mobile o
  // seletor de tema mora dentro do drawer (ver MenuMobile).
  return <SeletorTema className="fixed right-4 top-4 z-50 hidden sm:flex" />;
}
