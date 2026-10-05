"use client";

import { useState, useTransition } from "react";
import { enviarConsolidacaoProjeto } from "@/lib/ecc/actions";

/** Freeze — o gestor dispara um ponto de situação por e-mail pra todo
 * mundo com acesso ao quadro (mesmo arquivo pra todos, organizado por
 * responsável). Pedido do Fabio: dá um clique só, mas é um e-mail real
 * pra gente de verdade — por isso o confirm() antes de disparar.
 * `variante="menu"` (redesenho do Kanban, 2026-10-05): mesmo botão, mesmo
 * confirm, mesma Server Action — só com a aparência de item do menu ⋯ do
 * cabeçalho do projeto. */
export function BotaoFreeze({ projetoId, variante = "botao" }: { projetoId: string; variante?: "botao" | "menu" }) {
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  function disparar() {
    if (!confirm("Enviar o ponto de situação por e-mail pra todo mundo que tem acesso a este quadro?")) return;
    setMensagem(null);
    iniciarTransicao(async () => {
      try {
        const { enviados } = await enviarConsolidacaoProjeto(projetoId);
        setMensagem(`Enviado pra ${enviados} pessoa(s).`);
      } catch (erro) {
        setMensagem(erro instanceof Error ? erro.message : "Falha ao enviar o ponto de situação.");
      }
    });
  }

  if (variante === "menu") {
    return (
      <div className="flex flex-col">
        <button
          type="button"
          role="menuitem"
          onClick={disparar}
          disabled={pendente}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-gaiamum-text transition hover:bg-gaiamum-surface-raised disabled:opacity-50"
          title="Envia o ponto de situação do quadro por e-mail pra todo mundo com acesso"
        >
          ❄️ {pendente ? "Enviando..." : "Freeze (ponto de situação)"}
        </button>
        {mensagem && <span className="px-2.5 pb-1 text-xs text-gaiamum-text-muted">{mensagem}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={disparar}
        disabled={pendente}
        className="shrink-0 rounded-lg border border-gaiamum-border px-3 py-1.5 text-sm text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text disabled:opacity-50"
        title="Envia o ponto de situação do quadro por e-mail pra todo mundo com acesso"
      >
        ❄️ {pendente ? "Enviando..." : "Freeze"}
      </button>
      {mensagem && <span className="text-xs text-gaiamum-text-muted">{mensagem}</span>}
    </div>
  );
}
