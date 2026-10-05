"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  contarSelecionadas,
  limparSelecao,
  novaSugestaoManual,
  selecionarEssenciais,
  selecionarTodas,
  type SugestaoNaPrevia,
} from "@/lib/ecc/planejamento-ia";

const ESTILO_BOTAO_SECUNDARIO =
  "rounded-lg border border-gaiamum-border px-4 py-2 text-sm font-medium text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text";

/**
 * Prévia selecionável do planejamento — usada pela IA do Gaiamum e pelo
 * prompt copiável, na criação do projeto e dentro de um projeto existente.
 * Nada é gravado aqui: só edita a lista em memória. Todo texto (que pode ter
 * vindo de uma IA externa) é mostrado em inputs/texto puro, nunca como HTML.
 */
export function PreviaPlanejamento({
  previa,
  setPrevia,
}: {
  previa: SugestaoNaPrevia[];
  setPrevia: Dispatch<SetStateAction<SugestaoNaPrevia[]>>;
}) {
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  function atualizar(idTemp: string, patch: Partial<SugestaoNaPrevia>) {
    setPrevia((atual) => atual.map((s) => (s.idTemp === idTemp ? { ...s, ...patch } : s)));
  }

  function alternarExpandida(idTemp: string) {
    setExpandidas((atual) => {
      const nova = new Set(atual);
      if (nova.has(idTemp)) nova.delete(idTemp);
      else nova.add(idTemp);
      return nova;
    });
  }

  function adicionarManual() {
    const nova = novaSugestaoManual();
    setPrevia((atual) => [...atual, nova]);
    setExpandidas((atual) => new Set(atual).add(nova.idTemp));
  }

  const totalSelecionadas = contarSelecionadas(previa);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-gaiamum-text">Escolha o que faz sentido para seu projeto.</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPrevia((a) => selecionarEssenciais(a))} className={ESTILO_BOTAO_SECUNDARIO}>
          Selecionar essenciais
        </button>
        <button type="button" onClick={() => setPrevia((a) => selecionarTodas(a))} className={ESTILO_BOTAO_SECUNDARIO}>
          Selecionar todas
        </button>
        <button type="button" onClick={() => setPrevia((a) => limparSelecao(a))} className={ESTILO_BOTAO_SECUNDARIO}>
          Limpar seleção
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {previa.map((sugestao) => (
          <div
            key={sugestao.idTemp}
            className={`rounded-lg border p-3 ${
              sugestao.marco ? "border-gaiamum-primary/50 bg-gaiamum-primary/5" : "border-gaiamum-border bg-gaiamum-surface-raised"
            }`}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={sugestao.selecionada}
                onChange={(e) => atualizar(sugestao.idTemp, { selecionada: e.target.checked })}
                className="mt-1.5 h-5 w-5 shrink-0 accent-gaiamum-primary"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    value={sugestao.titulo}
                    onChange={(e) => atualizar(sugestao.idTemp, { titulo: e.target.value })}
                    placeholder="Título da tarefa"
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-gaiamum-text outline-none focus:border-gaiamum-primary"
                  />
                  {sugestao.marco ? (
                    <span className="shrink-0 rounded-full bg-gaiamum-primary px-2 py-0.5 text-[10px] font-semibold text-white">🏁 Marco</span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        sugestao.recomendacao === "essencial"
                          ? "bg-gaiamum-primary/15 text-gaiamum-primary"
                          : "bg-gaiamum-border/50 text-gaiamum-text-muted"
                      }`}
                    >
                      {sugestao.recomendacao === "essencial" ? "Essencial" : "Opcional"}
                    </span>
                  )}
                </div>
                <textarea
                  value={sugestao.descricao}
                  onChange={(e) => atualizar(sugestao.idTemp, { descricao: e.target.value })}
                  placeholder="Descrição curta (opcional)"
                  rows={1}
                  className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-gaiamum-text-muted outline-none focus:border-gaiamum-primary"
                />

                <button
                  type="button"
                  onClick={() => alternarExpandida(sugestao.idTemp)}
                  className="self-start text-xs text-gaiamum-text-muted underline hover:text-gaiamum-text"
                >
                  {expandidas.has(sugestao.idTemp)
                    ? "Ocultar checklist"
                    : sugestao.checklist.length > 0
                      ? `Ver checklist (${sugestao.checklist.length})`
                      : "+ Adicionar checklist"}
                </button>

                {expandidas.has(sugestao.idTemp) && (
                  <div className="flex flex-col gap-1 rounded border border-dashed border-gaiamum-border p-2">
                    {sugestao.checklist.map((item, indice) => (
                      <div key={indice} className="flex items-center gap-2">
                        <span className="text-xs text-gaiamum-text-muted">☐</span>
                        <span className="flex-1 text-xs text-gaiamum-text">{item}</span>
                        <button
                          type="button"
                          onClick={() => atualizar(sugestao.idTemp, { checklist: sugestao.checklist.filter((_, i) => i !== indice) })}
                          className="text-xs text-gaiamum-text-muted hover:text-gaiamum-danger"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <input
                      placeholder="+ Adicionar passo"
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const texto = e.currentTarget.value.trim();
                        if (texto) atualizar(sugestao.idTemp, { checklist: [...sugestao.checklist, texto] });
                        e.currentTarget.value = "";
                      }}
                      className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-gaiamum-text outline-none focus:border-gaiamum-primary"
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPrevia((atual) => atual.filter((s) => s.idTemp !== sugestao.idTemp))}
                title="Remover sugestão"
                className="shrink-0 text-gaiamum-text-muted hover:text-gaiamum-danger"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={adicionarManual} className={`self-start ${ESTILO_BOTAO_SECUNDARIO}`}>
        + Adicionar tarefa manualmente
      </button>

      <p className="text-sm text-gaiamum-text-muted">Você selecionou {totalSelecionadas} item(ns).</p>
    </div>
  );
}
