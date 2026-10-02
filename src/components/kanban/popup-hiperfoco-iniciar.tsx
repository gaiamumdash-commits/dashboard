"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { mensagemDeErro } from "@/lib/erro-cliente";

const ATALHOS_MINUTOS = [
  { minutos: 15, rotulo: "15 min" },
  { minutos: 30, rotulo: "30 min" },
  { minutos: 60, rotulo: "1 h" },
  { minutos: 120, rotulo: "2 h" },
];

/** Popup oferecido ao mover um cartão pra coluna de foco (migration 0052,
 * `dispara_hiperfoco`) — "pode planejar e verificar a melhor forma de
 * implantar" virou isto: alarme sempre OPCIONAL ("Sem alarme" fecha sem
 * chamar nenhuma Server Action), nunca bloqueia o movimento em si (o
 * cartão já mudou de coluna antes deste popup abrir). */
export function PopupHiperfocoIniciar({
  tituloTarefa,
  aoFechar,
  aoConfirmar,
}: {
  tituloTarefa: string;
  aoFechar: () => void;
  aoConfirmar: (minutos: number) => Promise<void>;
}) {
  const [minutosCustom, setMinutosCustom] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function confirmar(minutos: number) {
    setErro(null);
    iniciarTransicao(async () => {
      try {
        await aoConfirmar(minutos);
        aoFechar();
      } catch (err) {
        setErro(mensagemDeErro(err, "Falha ao iniciar o cronômetro de foco."));
      }
    });
  }

  return (
    <Dialog titulo="Cronômetro de foco" aoFechar={aoFechar} largura="md">
      <p className="mt-2 text-sm text-gaiamum-text-muted">
        Quer um alarme de foco pra <span className="font-medium text-gaiamum-text">&ldquo;{tituloTarefa}&rdquo;</span>? O
        cartão fica amarelo na metade do tempo e vermelho quando esgotar — opcional, pode pular.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ATALHOS_MINUTOS.map(({ minutos, rotulo }) => (
          <button
            key={minutos}
            type="button"
            disabled={pendente}
            onClick={() => confirmar(minutos)}
            className="rounded-lg border border-gaiamum-border px-3 py-2 text-sm font-medium text-gaiamum-text hover:border-gaiamum-primary hover:text-gaiamum-primary disabled:opacity-50"
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={1440}
          placeholder="Minutos (personalizado)"
          value={minutosCustom}
          onChange={(e) => setMinutosCustom(e.target.value)}
          className="w-full rounded-lg border border-gaiamum-border bg-gaiamum-surface px-3 py-2 text-sm text-gaiamum-text"
        />
        <button
          type="button"
          disabled={pendente || !minutosCustom || Number(minutosCustom) <= 0}
          onClick={() => confirmar(Number(minutosCustom))}
          className="shrink-0 rounded-lg bg-gaiamum-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Definir
        </button>
      </div>

      {erro && <p className="mt-3 text-sm text-gaiamum-danger">{erro}</p>}

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={aoFechar} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          Sem alarme, só mover
        </button>
      </div>
    </Dialog>
  );
}
