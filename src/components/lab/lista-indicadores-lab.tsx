"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { Indicador } from "@/lib/ecc/tipos";
import {
  atualizarValorIndicadorLab,
  criarIndicadorLab,
  editarIndicadorLab,
  excluirIndicadorLab,
} from "@/lib/ecc/lab/decisoes-indicadores";
import { Dialog } from "@/components/ui/dialog";
import { BarraProgresso } from "@/components/ui/barra-progresso";

/** Versão só-do-Lab de ListaIndicadores (components/projetos/lista-indicadores.tsx)
 * — mesmos campos, mesma UX (input inline de valor atual com onBlur). Usa as
 * Server Actions Lab-aware (decisoes-indicadores.ts), que resolvem tenant via
 * garantirTenantLab(). Trata erro com toast (padrão de quadro-lab.tsx) —
 * diferente do componente real, que deixa a rejeição estourar sem catch. */
export function ListaIndicadoresLab({
  projetoId,
  indicadoresIniciais,
}: {
  projetoId: string;
  indicadoresIniciais: Indicador[];
}) {
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Indicador | null>(null);
  const [salvando, iniciarTransicao] = useTransition();
  const router = useRouter();

  function fecharDialog() {
    setCriando(false);
    setEmEdicao(null);
  }

  function salvar(formData: FormData) {
    iniciarTransicao(async () => {
      try {
        if (emEdicao) {
          await editarIndicadorLab(emEdicao.id, projetoId, formData);
        } else {
          await criarIndicadorLab(projetoId, formData);
        }
        fecharDialog();
        router.refresh();
      } catch (err) {
        toast.error(mensagemDeErro(err, "Falha ao salvar indicador."));
      }
    });
  }

  function excluir(indicador: Indicador) {
    if (!confirm(`Excluir o indicador "${indicador.nome}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    iniciarTransicao(async () => {
      try {
        await excluirIndicadorLab(indicador.id, projetoId);
        router.refresh();
      } catch (err) {
        toast.error(mensagemDeErro(err, "Falha ao excluir indicador."));
      }
    });
  }

  function salvarValorAtual(indicador: Indicador, valor: string) {
    const valorNumerico = Number(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico === indicador.valor_atual) return;
    iniciarTransicao(async () => {
      try {
        await atualizarValorIndicadorLab(indicador.id, projetoId, valorNumerico);
        router.refresh();
      } catch (err) {
        toast.error(mensagemDeErro(err, "Falha ao atualizar indicador."));
      }
    });
  }

  const dialogAberto = criando || emEdicao !== null;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setCriando(true)}
        className="self-start rounded-lg border border-gaiamum-border px-4 py-2 text-sm text-gaiamum-text hover:border-gaiamum-primary"
      >
        + Novo indicador
      </button>

      {indicadoresIniciais.length === 0 && (
        <p className="text-sm text-gaiamum-text-muted">Nenhum indicador cadastrado ainda.</p>
      )}

      <div className="flex flex-col gap-3">
        {indicadoresIniciais.map((indicador) => {
          const percentual =
            indicador.meta > 0 ? Math.min(100, Math.round((indicador.valor_atual / indicador.meta) * 100)) : 0;
          return (
            <div key={indicador.id} className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-gaiamum-text">{indicador.nome}</h3>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setEmEdicao(indicador)}
                    className="text-gaiamum-text-muted hover:text-gaiamum-text"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => excluir(indicador)}
                    className="text-gaiamum-text-muted hover:text-gaiamum-danger"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <BarraProgresso percentual={percentual} rotulo={`Meta: ${indicador.meta} ${indicador.unidade}`} />
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs font-medium text-gaiamum-text-muted">
                Valor atual
                <input
                  type="number"
                  defaultValue={indicador.valor_atual}
                  onBlur={(e) => salvarValorAtual(indicador, e.currentTarget.value)}
                  className="w-28 rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-2 py-1 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
                />
                <span>{indicador.unidade}</span>
              </label>
            </div>
          );
        })}
      </div>

      {dialogAberto && (
        <Dialog
          titulo={emEdicao ? "Editar indicador" : "Novo indicador"}
          aoFechar={fecharDialog}
          largura="md"
          acoesExtras={salvando ? <span className="text-xs text-gaiamum-text-muted">Salvando…</span> : null}
        >
          <form action={salvar} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              Nome
              <input
                name="nome"
                required
                defaultValue={emEdicao?.nome}
                className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
                Meta
                <input
                  type="number"
                  name="meta"
                  required
                  defaultValue={emEdicao?.meta}
                  className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
                Unidade
                <input
                  name="unidade"
                  required
                  placeholder="ex.: pedidos, R$, %"
                  defaultValue={emEdicao?.unidade}
                  className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
                />
              </label>
            </div>

            {!emEdicao && (
              <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
                Valor atual (opcional, começa em 0)
                <input
                  type="number"
                  name="valor_atual"
                  defaultValue={0}
                  className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
                />
              </label>
            )}

            <button
              type="submit"
              disabled={salvando}
              className="mt-2 self-start rounded-lg border border-gaiamum-border px-4 py-2 text-sm text-gaiamum-text hover:border-gaiamum-primary disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
