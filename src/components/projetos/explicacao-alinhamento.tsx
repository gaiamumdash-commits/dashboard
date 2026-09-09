"use client";

import { useState, useTransition } from "react";
import { gerarExplicacaoAlinhamento } from "@/lib/ecc/explicacao-alinhamento";

export function ExplicacaoAlinhamentoBloco({ projetoId, temDados }: { projetoId: string; temDados: boolean }) {
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function gerar() {
    if (pendente) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await gerarExplicacaoAlinhamento(projetoId);
      if (resultado.erro) {
        setErro(resultado.erro);
      } else {
        setTexto(resultado.texto);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gaiamum-text">✨ Explicação da IA</h2>
        <button
          type="button"
          onClick={gerar}
          disabled={!temDados || pendente}
          className="rounded-lg bg-gaiamum-primary px-4 py-1.5 text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60"
        >
          {pendente ? "Gerando..." : "Gerar explicação com IA"}
        </button>
      </div>
      <p className="mt-1 text-xs text-gaiamum-text-muted">
        Interpretação gerada por IA a partir do score acima — não fica salva, gerada de novo a cada clique.
      </p>
      {!temDados && (
        <p className="mt-3 text-sm text-gaiamum-text-muted">
          Ainda não há dados suficientes no projeto pra gerar uma explicação.
        </p>
      )}
      {texto && <p className="mt-3 whitespace-pre-wrap text-sm text-gaiamum-text">{texto}</p>}
      {erro && <p className="mt-3 text-sm text-gaiamum-danger">{erro}</p>}
    </div>
  );
}
