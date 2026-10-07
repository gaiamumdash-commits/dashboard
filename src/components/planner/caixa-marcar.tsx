"use client";

import { useState } from "react";
import { marcarCompromisso, marcarHabitoNoDia } from "@/lib/ecc/planner/actions";
import type { OrigemItemDia } from "@/lib/ecc/planner/painel";
import { useAcaoPlanner } from "@/components/planner/uso-acao";

/** Checkbox de um item marcável do Planner (rotina/hábito num dia, ou
 * compromisso). Otimista: muda na hora e volta se a action falhar.
 * Estado comunicado por ícone (✓) + `aria-checked`, nunca só por cor. */
export function CaixaMarcar({
  origem,
  id,
  data,
  feito,
  rotulo,
  tamanho = "md",
}: {
  origem: Exclude<OrigemItemDia, "agenda">;
  id: string;
  /** Dia do registro ("AAAA-MM-DD") — só usado por rotina/hábito. */
  data: string;
  feito: boolean;
  rotulo: string;
  tamanho?: "sm" | "md";
}) {
  const { pendente, executar } = useAcaoPlanner();
  const [otimista, setOtimista] = useState(feito);
  const [anterior, setAnterior] = useState(feito);
  if (feito !== anterior) {
    setAnterior(feito);
    setOtimista(feito);
  }

  function alternar() {
    const novo = !otimista;
    setOtimista(novo);
    executar(() => (origem === "compromisso" ? marcarCompromisso(id, novo) : marcarHabitoNoDia(id, data, novo)), {
      desfazer: () => setOtimista(!novo),
    });
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={otimista}
      aria-label={`${rotulo}: ${otimista ? "feito" : "a fazer"}`}
      onClick={alternar}
      disabled={pendente}
      className={`flex shrink-0 items-center justify-center rounded-md border-2 transition disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gaiamum-primary ${
        tamanho === "sm" ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-xs"
      } ${otimista ? "border-gaiamum-success bg-gaiamum-success text-white" : "border-gaiamum-border-forte bg-transparent text-transparent hover:border-gaiamum-primary"}`}
    >
      ✓
    </button>
  );
}
