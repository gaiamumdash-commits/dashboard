"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Decisao, MetaSmart } from "@/lib/ecc/tipos";
import { criarDecisao, editarDecisao, excluirDecisao } from "@/lib/ecc/decisoes";
import { paraDatetimeLocal } from "@/lib/ecc/kanban";
import { Dialog } from "@/components/ui/dialog";
import { GerarContaAPagar } from "@/components/financeiro/gerar-conta-a-pagar";

export function ListaDecisoes({
  projetoId,
  decisoesIniciais,
  metasSmart,
  decisoesComContaGerada,
}: {
  projetoId: string;
  decisoesIniciais: Decisao[];
  metasSmart: MetaSmart[];
  decisoesComContaGerada: string[];
}) {
  const [criando, setCriando] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Decisao | null>(null);
  const [salvando, iniciarTransicao] = useTransition();
  const router = useRouter();

  function fecharDialog() {
    setCriando(false);
    setEmEdicao(null);
  }

  function salvar(formData: FormData) {
    iniciarTransicao(async () => {
      if (emEdicao) {
        await editarDecisao(emEdicao.id, projetoId, formData);
      } else {
        await criarDecisao(projetoId, formData);
      }
      fecharDialog();
      router.refresh();
    });
  }

  function excluir(decisao: Decisao) {
    if (!confirm(`Excluir a decisão "${decisao.titulo}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    iniciarTransicao(async () => {
      await excluirDecisao(decisao.id, projetoId);
      router.refresh();
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
        + Nova decisão
      </button>

      {decisoesIniciais.length === 0 && (
        <p className="text-sm text-gaiamum-text-muted">Nenhuma decisão registrada ainda.</p>
      )}

      <div className="flex flex-col gap-3">
        {decisoesIniciais.map((decisao) => {
          const meta = metasSmart.find((m) => m.id === decisao.meta_smart_id);
          return (
            <div key={decisao.id} className="rounded-2xl border border-gaiamum-border bg-gaiamum-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gaiamum-text">{decisao.titulo}</h3>
                  <p className="text-xs text-gaiamum-text-muted">
                    {new Date(decisao.data).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {meta && ` · vinculada a "${meta.specific}"`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setEmEdicao(decisao)}
                    className="text-gaiamum-text-muted hover:text-gaiamum-text"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => excluir(decisao)}
                    className="text-gaiamum-text-muted hover:text-gaiamum-danger"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              <dl className="mt-3 grid gap-2 text-sm">
                <div>
                  <dt className="text-xs font-medium text-gaiamum-text-muted">Decisão</dt>
                  <dd className="text-gaiamum-text">{decisao.decisao}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gaiamum-text-muted">Motivo</dt>
                  <dd className="text-gaiamum-text">{decisao.motivo}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gaiamum-text-muted">Impacto esperado</dt>
                  <dd className="text-gaiamum-text">{decisao.impacto_esperado}</dd>
                </div>
              </dl>

              <div className="mt-3">
                <GerarContaAPagar
                  origem="decisao"
                  origemId={decisao.id}
                  projetoId={projetoId}
                  nomeInicial={decisao.titulo}
                  valorInicial={decisao.valor_estimado}
                  jaGerada={decisoesComContaGerada.includes(decisao.id)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {dialogAberto && (
        <Dialog
          titulo={emEdicao ? "Editar decisão" : "Nova decisão"}
          aoFechar={fecharDialog}
          acoesExtras={salvando ? <span className="text-xs text-gaiamum-text-muted">Salvando…</span> : null}
        >
          <form action={salvar} className="mt-4 flex flex-col gap-3">
            {/* Mesmo princípio de fuso já usado em criarEventoAgendaManual:
                nunca resolver no servidor, sempre repassar o fuso do
                navegador. */}
            <input type="hidden" name="fuso" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />

            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              Título
              <input
                name="titulo"
                required
                defaultValue={emEdicao?.titulo}
                className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              Decisão
              <textarea
                name="decisao"
                required
                rows={2}
                defaultValue={emEdicao?.decisao}
                className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              Motivo
              <textarea
                name="motivo"
                required
                rows={2}
                defaultValue={emEdicao?.motivo}
                className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
              Impacto esperado
              <textarea
                name="impacto_esperado"
                required
                rows={2}
                defaultValue={emEdicao?.impacto_esperado}
                className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
                Data e hora
                <input
                  type="datetime-local"
                  name="data"
                  required
                  defaultValue={paraDatetimeLocal(emEdicao?.data ?? new Date().toISOString())}
                  className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
                💰 Valor estimado (opcional)
                <input
                  type="number"
                  name="valor_estimado"
                  step="0.01"
                  min="0"
                  defaultValue={emEdicao?.valor_estimado ?? ""}
                  className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-gaiamum-text-muted">
                Meta SMART (opcional)
                <select
                  name="meta_smart_id"
                  defaultValue={emEdicao?.meta_smart_id ?? ""}
                  className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2 text-sm text-gaiamum-text outline-none focus:border-gaiamum-primary"
                >
                  <option value="">Nenhuma</option>
                  {metasSmart.map((meta) => (
                    <option key={meta.id} value={meta.id}>
                      {meta.specific}
                    </option>
                  ))}
                </select>
              </label>
            </div>

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
