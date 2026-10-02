"use client";

import { useEffect, useRef, useState } from "react";
import type { ColunaKanban, Turno } from "@/lib/ecc/tipos";

/** Popover "Mover para..." — alternativa ao arrasto, pedida explicitamente
 * pelo Fabio (2026-09-30) pro cenário mais difícil de arrastar: levar um
 * cartão do FIM de uma coluna longa pro INÍCIO dela (ou vice-versa) sem
 * lutar com a rolagem da tela. Escolher a MESMA coluna+turno do cartão e
 * "Início" resolve exatamente esse caso sem nenhum gesto de arrasto.
 *
 * Autorização: nenhuma checagem extra aqui — o clique chama a mesma
 * Server Action (`moverTarefa`, via `aoEscolher` do QuadroKanban) que o
 * arrasto já chama, que já é autorizada por RLS no servidor. Este menu
 * nunca amplia quem pode mover uma tarefa, só oferece um caminho a mais
 * pra quem já podia. */
export function MoverParaMenu({
  colunaAtualId,
  turnoAtual,
  colunasDoProjeto,
  turnos,
  aoEscolher,
  aoFechar,
}: {
  colunaAtualId: string;
  turnoAtual: Turno | null;
  colunasDoProjeto: ColunaKanban[];
  turnos: { valor: Turno; rotulo: string }[];
  aoEscolher: (colunaId: string, turno: Turno | null, extremidade: "inicio" | "fim") => void;
  aoFechar: () => void;
}) {
  const [colunaEscolhidaId, setColunaEscolhidaId] = useState(colunaAtualId);
  const [turnoEscolhido, setTurnoEscolhido] = useState<Turno | null>(turnoAtual);
  const menuRef = useRef<HTMLDivElement>(null);

  const colunaEscolhida = colunasDoProjeto.find((c) => c.id === colunaEscolhidaId);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) aoFechar();
    }
    function aoTocarFora(e: TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) aoFechar();
    }
    function aoTeclarEscape(e: KeyboardEvent) {
      if (e.key === "Escape") aoFechar();
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("touchstart", aoTocarFora);
    document.addEventListener("keydown", aoTeclarEscape);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("touchstart", aoTocarFora);
      document.removeEventListener("keydown", aoTeclarEscape);
    };
  }, [aoFechar]);

  return (
    <div
      ref={menuRef}
      data-sem-arrasto
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Mover cartão para"
      className="absolute right-0 top-full z-20 mt-1 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-xl border border-gaiamum-border bg-gaiamum-surface p-3 text-left shadow-lg"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">Mover para</span>

      <label className="flex flex-col gap-1 text-xs text-gaiamum-text-muted">
        Coluna
        <select
          autoFocus
          value={colunaEscolhidaId}
          onChange={(e) => {
            setColunaEscolhidaId(e.target.value);
            const novaColuna = colunasDoProjeto.find((c) => c.id === e.target.value);
            setTurnoEscolhido(novaColuna?.dividida_em_turnos ? (turnoEscolhido ?? "manha") : null);
          }}
          className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
        >
          {colunasDoProjeto.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      {colunaEscolhida?.dividida_em_turnos && (
        <label className="flex flex-col gap-1 text-xs text-gaiamum-text-muted">
          Turno
          <select
            value={turnoEscolhido ?? "manha"}
            onChange={(e) => setTurnoEscolhido(e.target.value as Turno)}
            className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1.5 text-sm text-gaiamum-text outline-none"
          >
            {turnos.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </label>
      )}

      <span className="text-xs text-gaiamum-text-muted">Posição</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => aoEscolher(colunaEscolhidaId, colunaEscolhida?.dividida_em_turnos ? turnoEscolhido : null, "inicio")}
          className="flex-1 rounded-lg border border-gaiamum-border px-2 py-1.5 text-sm text-gaiamum-text hover:border-gaiamum-primary hover:text-gaiamum-primary"
        >
          ⇤ Início
        </button>
        <button
          type="button"
          onClick={() => aoEscolher(colunaEscolhidaId, colunaEscolhida?.dividida_em_turnos ? turnoEscolhido : null, "fim")}
          className="flex-1 rounded-lg border border-gaiamum-border px-2 py-1.5 text-sm text-gaiamum-text hover:border-gaiamum-primary hover:text-gaiamum-primary"
        >
          Fim ⇥
        </button>
      </div>

      <button
        type="button"
        onClick={aoFechar}
        className="mt-1 self-end text-xs text-gaiamum-text-muted hover:text-gaiamum-text"
      >
        Cancelar
      </button>
    </div>
  );
}
