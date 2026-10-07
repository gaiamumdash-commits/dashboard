"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";

/** Botão que abre um `Dialog` com um formulário — o formulário recebe
 * `fechar` pra fechar o modal depois de salvar. */
export function BotaoDialogo({
  rotulo,
  titulo,
  className,
  children,
}: {
  rotulo: ReactNode;
  titulo: string;
  className: string;
  children: (fechar: () => void) => ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={className}>
        {rotulo}
      </button>
      {aberto && (
        <Dialog titulo={titulo} aoFechar={fechar} largura="md">
          <div className="mt-4">{children(fechar)}</div>
        </Dialog>
      )}
    </>
  );
}
