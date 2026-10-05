"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Menu suspenso mínimo (botão + painel) do Kanban redesenhado — fecha ao
 * clicar/tocar fora ou com Escape, mesmo padrão de fechamento que
 * `MoverParaMenu` já usa. `manterMontado`: o painel fica no DOM mesmo
 * fechado (só escondido) — necessário quando um item guarda estado próprio
 * que não pode se perder ao fechar (ex.: `BotaoFreeze`, que mostra "Enviado
 * pra N pessoa(s)" depois de uma transição assíncrona).
 * `data-sem-arrasto` no contêiner: dentro de um cartão, tocar no menu nunca
 * inicia arrasto por toque (ver `CartaoTarefa`). */
export function MenuSuspenso({
  rotulo,
  icone,
  itens,
  alinhamento = "direita",
  manterMontado = false,
  classeBotao = "",
}: {
  /** Texto acessível do botão (aria-label + title). */
  rotulo: string;
  icone: ReactNode;
  /** Recebe `fechar` pra cada item decidir se fecha o menu ao ser usado. */
  itens: (fechar: () => void) => ReactNode;
  alinhamento?: "direita" | "esquerda";
  manterMontado?: boolean;
  classeBotao?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoInteragirFora(e: MouseEvent | TouchEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoInteragirFora);
    document.addEventListener("touchstart", aoInteragirFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoInteragirFora);
      document.removeEventListener("touchstart", aoInteragirFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const fechar = () => setAberto(false);

  return (
    <div ref={contenedorRef} data-sem-arrasto className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={rotulo}
        title={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
        className={`flex items-center justify-center rounded-md text-gaiamum-text-muted transition hover:bg-gaiamum-surface-raised hover:text-gaiamum-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-gaiamum-primary ${classeBotao}`}
      >
        {icone}
      </button>
      {(aberto || manterMontado) && (
        <div
          role="menu"
          hidden={!aberto}
          className={`absolute top-full z-30 mt-1 flex min-w-[12rem] flex-col gap-0.5 rounded-xl border border-gaiamum-border bg-gaiamum-surface p-1.5 text-left shadow-xl ${
            alinhamento === "direita" ? "right-0" : "left-0"
          }`}
        >
          {itens(fechar)}
        </div>
      )}
    </div>
  );
}

/** Item padrão de `MenuSuspenso`. */
export function ItemMenu({
  children,
  onClick,
  perigo = false,
  ativo = false,
}: {
  children: ReactNode;
  onClick: () => void;
  perigo?: boolean;
  ativo?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-gaiamum-surface-raised ${
        perigo ? "text-gaiamum-danger" : ativo ? "text-gaiamum-primary" : "text-gaiamum-text"
      }`}
    >
      {children}
    </button>
  );
}
