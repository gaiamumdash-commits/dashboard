"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adicionarTarefasPlanejadas } from "@/lib/ecc/planejamento-ia-actions";
import { contarSelecionadas, prepararPreviaParaSelecao, type SugestaoNaPrevia } from "@/lib/ecc/planejamento-ia";
import { gerarIdCliente } from "@/lib/ecc/kanban";
import { PreviaPlanejamento } from "@/components/projetos/previa-planejamento";
import { PassoPromptCopiavel } from "@/components/projetos/passo-prompt-copiavel";

const ESTILO_BOTAO_SECUNDARIO =
  "rounded-lg border border-gaiamum-border px-4 py-2 text-sm font-medium text-gaiamum-text-muted transition hover:border-gaiamum-primary hover:text-gaiamum-text";
const ESTILO_BOTAO_PRIMARIO =
  "rounded-lg bg-gaiamum-primary px-5 py-2 text-sm font-medium text-white transition hover:bg-gaiamum-primary-dark disabled:opacity-60";

/**
 * "Planejar com IA" num projeto que já existe (menu ⋯ do projeto) — replanejar
 * no meio do caminho é caso comum. Mesmo prompt copiável e mesma prévia da
 * criação; os itens confirmados entram no fim da coluna "Tarefas".
 * Renderizado num portal no <body>: o menu ⋯ fica dentro do cabeçalho, e o
 * modal não pode herdar nenhum recorte/empilhamento de lá.
 */
export function ModalPlanejarNoProjeto({
  projetoId,
  nomeProjeto,
  aoFechar,
}: {
  projetoId: string;
  nomeProjeto: string;
  aoFechar: () => void;
}) {
  const [previa, setPrevia] = useState<SugestaoNaPrevia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [idempotencyKey] = useState(gerarIdCliente);
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  function confirmar() {
    const selecionadas = (previa ?? []).filter((s) => s.selecionada);
    if (selecionadas.length === 0) {
      setErro("Selecione pelo menos um item.");
      return;
    }
    if (selecionadas.some((s) => !s.titulo.trim())) {
      setErro("Todo item selecionado precisa de um título.");
      return;
    }
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await adicionarTarefasPlanejadas({
        projetoId,
        idempotencyKey,
        tarefas: selecionadas.map((s) => ({ titulo: s.titulo, descricao: s.descricao, checklist: s.checklist, marco: s.marco })),
      });
      if (resultado.status === "erro") {
        setErro(resultado.mensagem);
        return;
      }
      toast.success(`${resultado.criadas} item(ns) adicionados na coluna Tarefas.`);
      aoFechar();
      router.refresh();
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      onClick={aoFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl border border-gaiamum-border bg-gaiamum-surface p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gaiamum-text">Planejar com IA</h2>
          <button type="button" onClick={aoFechar} className="text-gaiamum-text-muted hover:text-gaiamum-text">
            ✕
          </button>
        </div>

        {erro && <p className="mb-3 text-sm text-gaiamum-danger">{erro}</p>}

        {previa === null ? (
          <PassoPromptCopiavel
            nomeProjeto={nomeProjeto}
            chaveRascunho={`gaiamum-rascunho-plano:${projetoId}`}
            aoLerPlano={(sugestoes, descartados) => {
              if (descartados > 0) toast.message(`${descartados} item(ns) do plano ficaram de fora (sem título ou acima do limite de 30).`);
              setPrevia(prepararPreviaParaSelecao(sugestoes));
            }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <PreviaPlanejamento previa={previa} setPrevia={(acao) => setPrevia((atual) => (typeof acao === "function" ? acao(atual ?? []) : acao))} />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setPrevia(null)} className={ESTILO_BOTAO_SECUNDARIO}>
                ← Voltar
              </button>
              <button type="button" onClick={confirmar} disabled={pendente} className={ESTILO_BOTAO_PRIMARIO}>
                {pendente ? "Adicionando..." : `Adicionar ao quadro (${contarSelecionadas(previa)})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
