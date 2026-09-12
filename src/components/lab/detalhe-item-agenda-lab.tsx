"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemAgenda } from "@/lib/ecc/tipos";
import { excluirEventoAgendaLab } from "@/lib/ecc/lab/agenda";
import { RÓTULO_FONTE } from "@/lib/ecc/agenda-apresentacao";

function formatarDataHoraCompleta(item: ItemAgenda): string {
  const ehDiaInteiro = /^\d{4}-\d{2}-\d{2}$/.test(item.quando);
  if (ehDiaInteiro) {
    return new Date(`${item.quando}T00:00:00`).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  const inicio = new Date(item.quando);
  const dataHora = inicio.toLocaleString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!item.fim) return dataHora;

  const fim = new Date(item.fim);
  const horaFim = fim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dataHora} até ${horaFim}`;
}

/** Duplicata de DetalheItemAgenda (components/agenda/detalhe-item-agenda.tsx)
 * sem a seção de alarme por completo (achado #4 do plano — um alarme real
 * disparando pra um compromisso fictício quebraria a fronteira do sandbox).
 * Exclusão usa excluirEventoAgendaLab. */
export function DetalheItemAgendaLab({ item, aoFechar }: { item: ItemAgenda; aoFechar: () => void }) {
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  function excluir() {
    iniciarTransicao(async () => {
      await excluirEventoAgendaLab(item.id);
      router.refresh();
      aoFechar();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
      onClick={aoFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-gaiamum-text">{item.titulo}</h2>
          <button type="button" onClick={aoFechar} className="text-gaiamum-text-muted hover:text-gaiamum-text">
            ✕
          </button>
        </div>

        <p className="mt-1 text-sm capitalize text-gaiamum-text-muted">{formatarDataHoraCompleta(item)}</p>

        <span className="mt-3 inline-block text-[11px] uppercase tracking-wide text-gaiamum-text-muted">
          {RÓTULO_FONTE[item.fonte]}
        </span>

        {item.badge && <p className="mt-2 text-sm text-gaiamum-text">{item.badge}</p>}

        <div className="mt-5 flex items-center justify-between">
          {item.link ? (
            <a href={item.link} className="text-sm text-gaiamum-primary underline">
              Ver em {RÓTULO_FONTE[item.fonte]}
            </a>
          ) : (
            <span />
          )}

          {item.fonte === "evento_agenda" && (
            <button
              type="button"
              disabled={pendente}
              onClick={excluir}
              className="text-xs text-gaiamum-text-muted underline hover:text-gaiamum-danger disabled:opacity-60"
            >
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
