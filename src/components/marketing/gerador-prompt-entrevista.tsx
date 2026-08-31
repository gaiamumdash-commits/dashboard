"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EtapaEntrevistaColada } from "@/lib/ecc/tipos";
import { registrarRespostaEtapa, finalizarComExtracaoColada } from "@/lib/ecc/entrevista";
import { ROTULO_ETAPA } from "@/lib/ecc/prompt-entrevista";

export function GeradorPromptEntrevista({
  entrevistaId,
  modo,
  rotuloEtapaAtual,
  prompt,
  etapasAnteriores,
}: {
  entrevistaId: string;
  modo: "etapa" | "extracao";
  rotuloEtapaAtual: string;
  prompt: string;
  etapasAnteriores: EtapaEntrevistaColada[];
}) {
  const [copiado, setCopiado] = useState(false);
  const [colado, setColado] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  function copiar() {
    navigator.clipboard.writeText(prompt);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function salvar() {
    if (!colado.trim() || pendente) return;
    setErro(null);
    iniciarTransicao(async () => {
      try {
        if (modo === "extracao") {
          await finalizarComExtracaoColada(entrevistaId, colado);
        } else {
          await registrarRespostaEtapa(entrevistaId, colado);
        }
        setColado("");
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao salvar a resposta.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {etapasAnteriores.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">
            Etapas já respondidas
          </h2>
          {etapasAnteriores.map((e, i) => (
            <details key={i} className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-gaiamum-text">
                {ROTULO_ETAPA[e.estagio]}
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gaiamum-text-muted">{e.texto_colado}</p>
            </details>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gaiamum-text">
            {modo === "extracao" ? "Prompt final — resumo estruturado" : `Prompt da etapa: ${rotuloEtapaAtual}`}
          </h2>
          <button
            type="button"
            onClick={copiar}
            className="rounded-lg border border-gaiamum-border px-3 py-1.5 text-xs text-gaiamum-text-muted hover:border-gaiamum-primary hover:text-gaiamum-text"
          >
            {copiado ? "Copiado!" : "Copiar prompt"}
          </button>
        </div>
        <p className="mt-1 text-xs text-gaiamum-text-muted">
          Copie e cole numa conversa do Claude Code (ou claude.ai) e converse normalmente. Quando terminar, volte
          aqui e cole a resposta abaixo.
        </p>
        <textarea
          readOnly
          value={prompt}
          rows={10}
          className="mt-3 w-full rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 font-mono text-xs text-gaiamum-text-muted outline-none"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-gaiamum-text">Colar a resposta do Claude aqui</label>
        <textarea
          value={colado}
          onChange={(e) => setColado(e.target.value)}
          rows={8}
          placeholder="Cole aqui a conversa/resumo que o Claude devolveu..."
          className="mt-2 w-full rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
        />
        <button
          type="button"
          onClick={salvar}
          disabled={pendente || !colado.trim()}
          className="mt-3 rounded-lg bg-gaiamum-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60"
        >
          {pendente ? "Salvando..." : modo === "extracao" ? "Concluir entrevista" : "Salvar e continuar"}
        </button>
        {erro && <p className="mt-2 text-sm text-gaiamum-danger">{erro}</p>}
      </div>
    </div>
  );
}
