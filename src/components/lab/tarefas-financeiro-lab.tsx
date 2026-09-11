"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { Tarefa } from "@/lib/ecc/tipos";
import { atualizarValorEstimadoTarefaLab } from "@/lib/ecc/lab/financeiro";
import { GerarContaAPagarLab } from "@/components/lab/gerar-conta-a-pagar-lab";

/** Lista as tarefas do case com valor estimado + ponte pro Financeiro — sem
 * equivalente real direto (o quadro do Lab não tem dialog de detalhe de
 * tarefa como o quadro-kanban.tsx real tem via detalhe-tarefa.tsx). Mesmo
 * campo/UX de "💰 Valor estimado" que detalhe-tarefa.tsx já usa. */
export function TarefasFinanceiroLab({
  projetoId,
  tarefas,
  tarefasComContaGerada,
}: {
  projetoId: string;
  tarefas: Tarefa[];
  tarefasComContaGerada: string[];
}) {
  const [, iniciarTransicao] = useTransition();
  const router = useRouter();

  function salvarValorEstimado(tarefa: Tarefa, valorBruto: string) {
    const valor = valorBruto.trim() === "" ? null : Number(valorBruto);
    if (valor !== null && !Number.isFinite(valor)) return;
    if (valor === tarefa.valor_estimado) return;

    iniciarTransicao(async () => {
      try {
        await atualizarValorEstimadoTarefaLab(tarefa.id, projetoId, valor);
        router.refresh();
      } catch (err) {
        toast.error(mensagemDeErro(err, "Falha ao atualizar valor estimado."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {tarefas.map((tarefa) => (
        <div key={tarefa.id} className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
          <p className="text-sm font-medium text-gaiamum-text">{tarefa.titulo}</p>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              💰 Valor estimado (opcional)
              <input
                type="number"
                step="0.01"
                min="0"
                defaultValue={tarefa.valor_estimado ?? ""}
                onBlur={(e) => salvarValorEstimado(tarefa, e.target.value)}
                placeholder="Ex.: 500"
                className="w-32 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
            </label>

            <GerarContaAPagarLab
              origem="tarefa"
              origemId={tarefa.id}
              projetoId={projetoId}
              nomeInicial={tarefa.titulo}
              valorInicial={tarefa.valor_estimado}
              jaGerada={tarefasComContaGerada.includes(tarefa.id)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
