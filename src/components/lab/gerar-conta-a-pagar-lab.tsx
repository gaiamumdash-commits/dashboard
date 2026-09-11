"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gerarContaAPagarDaDecisaoLab, gerarContaAPagarDaTarefaLab } from "@/lib/ecc/lab/financeiro";
import { mensagemDeErro } from "@/lib/erro-cliente";
import { Dialog } from "@/components/ui/dialog";

const CATEGORIAS = [
  { valor: "consumo", rotulo: "Consumo" },
  { valor: "investimento", rotulo: "Investimento" },
  { valor: "despesa", rotulo: "Despesa" },
];

/** Versão só-do-Lab de GerarContaAPagar (components/financeiro/gerar-conta-a-pagar.tsx)
 * — duplicado (não generalizado) porque o componente real importa as Server
 * Actions reais hardcoded (financeiro.ts), que gravariam no tenant REAL do
 * usuário se reaproveitadas aqui. Usa as versões Lab-aware
 * (lib/ecc/lab/financeiro.ts). */
export function GerarContaAPagarLab({
  origem,
  origemId,
  projetoId,
  nomeInicial,
  valorInicial,
  jaGerada,
}: {
  origem: "tarefa" | "decisao";
  origemId: string;
  projetoId: string;
  nomeInicial: string;
  valorInicial: number | null;
  jaGerada: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  if (jaGerada) {
    return (
      <p className="text-xs text-gaiamum-text-muted">
        💰 Lançado no Financeiro —{" "}
        <a href="/lab/financeiro" className="underline hover:text-gaiamum-text">
          ver
        </a>
      </p>
    );
  }

  if (valorInicial === null) return null;

  function gerar(formData: FormData) {
    setErro(null);
    iniciarTransicao(async () => {
      try {
        if (origem === "tarefa") {
          await gerarContaAPagarDaTarefaLab(origemId, projetoId, formData);
        } else {
          await gerarContaAPagarDaDecisaoLab(origemId, projetoId, formData);
        }
        setAberto(false);
        router.refresh();
      } catch (e) {
        setErro(mensagemDeErro(e, "Falha ao gerar conta a pagar."));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-xs text-gaiamum-primary hover:underline"
      >
        💰 Gerar conta a pagar
      </button>

      {aberto && (
        <Dialog titulo="Gerar conta a pagar" aoFechar={() => setAberto(false)}>
          <form action={gerar} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              Nome
              <input
                name="nome"
                required
                defaultValue={nomeInicial}
                className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              Valor
              <input
                type="number"
                name="valor"
                step="0.01"
                min="0.01"
                required
                defaultValue={valorInicial}
                className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              Vencimento
              <input
                type="date"
                name="data_vencimento"
                required
                className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              Categoria
              <select
                name="categoria"
                defaultValue="despesa"
                className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={pendente}
              className="mt-2 self-start rounded-lg border border-gaiamum-border px-4 py-2 text-sm text-gaiamum-text hover:border-gaiamum-primary disabled:opacity-50"
            >
              {pendente ? "Gerando…" : "Gerar conta a pagar"}
            </button>

            {erro && <p className="text-sm text-gaiamum-danger">{erro}</p>}
          </form>
        </Dialog>
      )}
    </>
  );
}
