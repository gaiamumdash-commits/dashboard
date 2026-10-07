"use client";

import { useState } from "react";
import { definirResumoDiario } from "@/lib/ecc/planner/actions";
import { useAcaoPlanner } from "@/components/planner/uso-acao";

/** Liga/desliga o "Resumo do dia por e-mail". O link de desligar do próprio
 * e-mail aponta pra cá (`/planner#resumo-email`). */
export function OpcaoResumoEmail({ ligado }: { ligado: boolean }) {
  const { pendente, executar } = useAcaoPlanner();
  const [otimista, setOtimista] = useState(ligado);
  const [anterior, setAnterior] = useState(ligado);
  if (ligado !== anterior) {
    setAnterior(ligado);
    setOtimista(ligado);
  }

  return (
    <section
      id="resumo-email"
      className="flex scroll-mt-6 flex-wrap items-center justify-between gap-3 rounded-2xl border border-gaiamum-border bg-gaiamum-surface px-5 py-4"
    >
      <div>
        <h2 className="text-sm font-semibold text-gaiamum-text">📬 Resumo do dia por e-mail</h2>
        <p className="text-sm text-gaiamum-text-muted">
          Às 7h, o seu dia: compromissos, rotinas, hábitos e manutenções. Só chega quando há algo, e só você recebe.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={otimista}
        aria-label="Receber o resumo do dia por e-mail"
        disabled={pendente}
        onClick={() => {
          const novo = !otimista;
          setOtimista(novo);
          executar(() => definirResumoDiario(novo), {
            sucesso: novo ? "Resumo diário ligado." : "Resumo diário desligado.",
            desfazer: () => setOtimista(!novo),
          });
        }}
        className={`flex shrink-0 items-center gap-2 rounded-full px-1 py-1 pr-3 text-xs font-medium transition disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gaiamum-primary ${
          otimista ? "bg-gaiamum-success/15 text-gaiamum-success" : "bg-gaiamum-surface-raised text-gaiamum-text-muted"
        }`}
      >
        <span className={`relative h-6 w-11 rounded-full transition ${otimista ? "bg-gaiamum-success" : "bg-gaiamum-border"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${otimista ? "left-5" : "left-0.5"}`} />
        </span>
        {otimista ? "Ligado" : "Desligado"}
      </button>
    </section>
  );
}
