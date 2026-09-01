"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContaFixaModelo } from "@/lib/ecc/tipos";
import { alternarAtivaContaFixa } from "@/lib/ecc/financeiro";

const ROTULO_CATEGORIA: Record<ContaFixaModelo["categoria"], string> = {
  consumo: "Consumo",
  investimento: "Investimento",
  despesa: "Despesa",
};

export function ListaContasFixasModelo({ modelos }: { modelos: ContaFixaModelo[] }) {
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  if (modelos.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
        Modelos de conta fixa cadastrados
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {modelos.map((modelo) => (
          <div key={modelo.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className={modelo.ativo ? "text-gaiamum-text" : "text-gaiamum-text-muted line-through"}>
              {modelo.nome}
            </span>
            <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-xs text-gaiamum-text-muted">
              {ROTULO_CATEGORIA[modelo.categoria]}
            </span>
            <span className="text-xs text-gaiamum-text-muted">
              {modelo.valor_esperado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · dia{" "}
              {modelo.dia_vencimento}
            </span>
            <button
              type="button"
              disabled={pendente}
              onClick={() =>
                iniciarTransicao(async () => {
                  await alternarAtivaContaFixa(modelo.id, !modelo.ativo);
                  router.refresh();
                })
              }
              className="ml-auto text-xs text-gaiamum-primary hover:underline disabled:opacity-60"
            >
              {modelo.ativo ? "Pausar" : "Reativar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
