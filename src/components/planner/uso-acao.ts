"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { ResultadoAcao } from "@/lib/ecc/planner/tipos";

/** Executa uma Server Action do Planner numa transição: erro vira toast
 * (mensagem em português que a própria action devolveu), sucesso opcional
 * também. A action já revalida /planner — a tela se atualiza sozinha.
 * `desfazer` reverte o estado otimista quando falha. */
export function useAcaoPlanner() {
  const [pendente, iniciarTransicao] = useTransition();

  function executar(
    acao: () => Promise<ResultadoAcao>,
    opcoes: { sucesso?: string; desfazer?: () => void; aoConcluir?: () => void } = {},
  ) {
    iniciarTransicao(async () => {
      try {
        const resultado = await acao();
        if (!resultado.ok) {
          opcoes.desfazer?.();
          toast.error(resultado.erro);
          return;
        }
        if (opcoes.sucesso) toast.success(opcoes.sucesso);
        opcoes.aoConcluir?.();
      } catch (erro) {
        opcoes.desfazer?.();
        toast.error(mensagemDeErro(erro, "Algo deu errado. Tente de novo."));
      }
    });
  }

  return { pendente, executar };
}
