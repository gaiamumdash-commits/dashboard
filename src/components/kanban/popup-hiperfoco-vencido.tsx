"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { mensagemDeErro } from "@/lib/erro-cliente";

const ATALHOS_MINUTOS = [
  { minutos: 15, rotulo: "15 min" },
  { minutos: 30, rotulo: "30 min" },
  { minutos: 60, rotulo: "1 h" },
];

/** Aberto automaticamente pelo próprio cartão (`CartaoTarefa`) quando o
 * cronômetro de foco esgota — "ao vencer, pode perguntar se quer renovar e
 * em qual horário" (pedido do Fabio). "Só parar" encerra sem mover o
 * cartão — concluir de verdade continua sendo uma ação separada e
 * explícita (mover pra "Concluído"), pra não mover sozinho sem a pessoa
 * decidir onde o cartão vai. */
export function PopupHiperfocoVencido({
  tituloTarefa,
  aoFechar,
  aoRenovar,
  aoParar,
}: {
  tituloTarefa: string;
  aoFechar: () => void;
  aoRenovar: (minutos: number) => Promise<void>;
  aoParar: () => Promise<void>;
}) {
  const [minutosCustom, setMinutosCustom] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function renovar(minutos: number) {
    setErro(null);
    iniciarTransicao(async () => {
      try {
        await aoRenovar(minutos);
        aoFechar();
      } catch (err) {
        setErro(mensagemDeErro(err, "Falha ao renovar o cronômetro de foco."));
      }
    });
  }

  function parar() {
    setErro(null);
    iniciarTransicao(async () => {
      try {
        await aoParar();
        aoFechar();
      } catch (err) {
        setErro(mensagemDeErro(err, "Falha ao parar o cronômetro de foco."));
      }
    });
  }

  return (
    <Dialog titulo="⏰ Tempo esgotado" aoFechar={aoFechar} largura="md">
      <p className="mt-2 text-sm text-gaiamum-text-muted">
        O tempo de foco em <span className="font-medium text-gaiamum-text">&ldquo;{tituloTarefa}&rdquo;</span> acabou. Quer
        renovar por mais quanto tempo, ou parar por aqui?
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {ATALHOS_MINUTOS.map(({ minutos, rotulo }) => (
          <button
            key={minutos}
            type="button"
            disabled={pendente}
            onClick={() => renovar(minutos)}
            className="rounded-lg border border-gaiamum-border px-3 py-2 text-sm font-medium text-gaiamum-text hover:border-gaiamum-primary hover:text-gaiamum-primary disabled:opacity-50"
          >
            +{rotulo}
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
          onClick={() => renovar(Number(minutosCustom))}
          className="shrink-0 rounded-lg bg-gaiamum-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Renovar
        </button>
      </div>

      {erro && <p className="mt-3 text-sm text-gaiamum-danger">{erro}</p>}

      <div className="mt-4 flex justify-end">
        <button type="button" disabled={pendente} onClick={parar} className="text-sm text-gaiamum-text-muted hover:text-gaiamum-text">
          Só parar o cronômetro
        </button>
      </div>
    </Dialog>
  );
}
