"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-cliente";
import type { Anexo, ContaAPagar, FormaPagamento } from "@/lib/ecc/tipos";
import { hojeISOBrasil } from "@/lib/ecc/kanban";
import { atualizarValorEVencimento, desmarcarComoPaga, marcarComoPaga } from "@/lib/ecc/financeiro";
import { enviarAnexoContaAPagar } from "@/lib/ecc/anexos";
import { AnexoArquivo } from "@/components/anexo-arquivo";
import { CampoAlarme } from "@/components/campo-alarme";

const ROTULO_CATEGORIA: Record<ContaAPagar["categoria"], string> = {
  consumo: "Consumo",
  investimento: "Investimento",
  despesa: "Despesa",
};

const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Débito",
  credito: "Crédito",
};

// Achado real (2026-09-29): antes chamava `new Date().toISOString().slice(0,10)`
// direto — isso é UTC, não o fuso de Brasília. Entre 21h e meia-noite de
// Brasília já é "amanhã" em UTC, então uma conta que vence hoje aparecia como
// "Vencido" nessas ~3h todo dia, e marcar como paga nesse intervalo gravava a
// data de amanhã. `hojeISOBrasil()` calcula certo em qualquer fuso do
// navegador de quem está usando.
function hojeISO(): string {
  return hojeISOBrasil();
}

function formatarData(dataISO: string): string {
  return new Date(`${dataISO}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Interruptor({
  ligado,
  onClick,
  disabled,
}: {
  ligado: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={onClick}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${
        ligado ? "bg-gaiamum-success" : "bg-gaiamum-border"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          ligado ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Linha({
  conta,
  anexos,
  antecedenciaAlarme,
  caminhoRevalidar,
  destacada,
}: {
  conta: ContaAPagar;
  anexos: Anexo[];
  antecedenciaAlarme: number | null;
  caminhoRevalidar: string;
  destacada: boolean;
}) {
  const [editandoValor, setEditandoValor] = useState(false);
  const [editandoDataPagamento, setEditandoDataPagamento] = useState(false);
  // Ao marcar como paga pela primeira vez, pede a forma de pagamento junto —
  // pedido do Fabio, 2026-09-29 ("clicar na conta e dizer como paguei"),
  // vindo da integração com o cartão de "Contas de hoje" do Kanban.
  const [escolhendoFormaPagamento, setEscolhendoFormaPagamento] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();

  // Otimista: sem isso, o interruptor só refletia o clique depois que
  // `router.refresh()` trazia o dado novo do servidor de volta — sem
  // nenhum indicador de "salvando" nesse meio tempo, parecia que o clique
  // não tinha feito nada até a tela atualizar sozinha.
  const [pagoOtimista, setPagoOtimista] = useState(conta.pago);
  const [contaAnterior, setContaAnterior] = useState(conta);
  if (conta !== contaAnterior) {
    setContaAnterior(conta);
    setPagoOtimista(conta.pago);
  }

  function confirmarPagamento(formaPagamento: FormaPagamento) {
    setEscolhendoFormaPagamento(false);
    setPagoOtimista(true);
    iniciarTransicao(async () => {
      try {
        await marcarComoPaga(conta.id, hojeISO(), formaPagamento);
        router.refresh();
      } catch (err) {
        setPagoOtimista(false);
        toast.error(mensagemDeErro(err, "Falha ao marcar como paga."));
      }
    });
  }

  function alternarPago() {
    if (!pagoOtimista) {
      setEscolhendoFormaPagamento(true);
      return;
    }

    setPagoOtimista(false);
    iniciarTransicao(async () => {
      try {
        await desmarcarComoPaga(conta.id);
        router.refresh();
      } catch (err) {
        setPagoOtimista(true);
        toast.error(mensagemDeErro(err, "Falha ao desmarcar como paga."));
      }
    });
  }

  const vencida = !pagoOtimista && conta.data_vencimento < hojeISO();
  const statusRotulo = pagoOtimista ? "Pago" : vencida ? "Vencido" : "Em aberto";
  const statusClasse = pagoOtimista
    ? "bg-gaiamum-success/15 text-gaiamum-success"
    : vencida
      ? "bg-gaiamum-danger/15 text-gaiamum-danger"
      : "bg-gaiamum-surface-raised text-gaiamum-text-muted";

  return (
    <div
      id={`conta-${conta.id}`}
      className={`rounded-2xl border bg-gaiamum-surface p-4 transition ${
        destacada ? "border-gaiamum-primary ring-2 ring-gaiamum-primary" : "border-gaiamum-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gaiamum-text">{conta.nome}</span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClasse}`}>
          {statusRotulo}
        </span>
      </div>

      {!editandoValor ? (
        <button
          type="button"
          onClick={() => setEditandoValor(true)}
          className="mt-3 grid w-full grid-cols-2 gap-3 rounded-xl bg-gaiamum-surface-raised p-3 text-left"
          title="Clique pra corrigir valor e vencimento (boleto chegou com valor diferente do esperado)"
        >
          <div>
            <p className="text-xs text-gaiamum-text-muted">Vencimento</p>
            <p className="text-sm text-gaiamum-text">{formatarData(conta.data_vencimento)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gaiamum-text-muted">Valor</p>
            <p className="text-sm font-medium text-gaiamum-text">{formatarMoeda(conta.valor)}</p>
          </div>
        </button>
      ) : (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-gaiamum-surface-raised p-3"
          action={(formData) => {
            const novoValor = Number(formData.get("valor"));
            const novoVencimento = String(formData.get("data_vencimento"));
            setEditandoValor(false);
            iniciarTransicao(async () => {
              try {
                await atualizarValorEVencimento(conta.id, novoValor, novoVencimento);
                router.refresh();
              } catch (err) {
                toast.error(mensagemDeErro(err, "Falha ao salvar valor/vencimento."));
              }
            });
          }}
        >
          <input
            type="date"
            name="data_vencimento"
            required
            autoFocus
            defaultValue={conta.data_vencimento}
            className="rounded border border-gaiamum-primary bg-gaiamum-surface px-2 py-1 text-xs text-gaiamum-text outline-none"
          />
          <input
            type="number"
            name="valor"
            step="0.01"
            min="0.01"
            required
            defaultValue={conta.valor}
            className="w-24 rounded border border-gaiamum-primary bg-gaiamum-surface px-2 py-1 text-xs text-gaiamum-text outline-none"
          />
          <button type="submit" className="text-xs font-medium text-gaiamum-primary hover:underline">
            Salvar
          </button>
        </form>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-xs text-gaiamum-text-muted">
            {ROTULO_CATEGORIA[conta.categoria]}
          </span>
          {(conta.tarefa_id || conta.decisao_id) && (
            <span className="rounded-full border border-gaiamum-border px-2 py-0.5 text-xs text-gaiamum-text-muted">
              🔗 {conta.tarefa_id ? "gerada de um cartão" : "gerada de uma decisão"}
            </span>
          )}
        </div>
        <CampoAlarme
          entidadeTipo="conta_a_pagar"
          entidadeId={conta.id}
          antecedenciaAtual={antecedenciaAlarme}
          caminhoRevalidar={caminhoRevalidar}
        />
      </div>

      <div className="mt-3">
        <AnexoArquivo
          anexos={anexos}
          enviar={(formData) => enviarAnexoContaAPagar(conta.id, formData)}
          caminhoRevalidar={caminhoRevalidar}
          rotuloAnexar="Anexar comprovante"
        />
      </div>

      {escolhendoFormaPagamento ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gaiamum-primary bg-gaiamum-surface-raised p-3"
          action={(formData) => confirmarPagamento(formData.get("forma_pagamento") as FormaPagamento)}
        >
          <span className="text-xs text-gaiamum-text-muted">Como você pagou?</span>
          <select
            name="forma_pagamento"
            autoFocus
            required
            defaultValue=""
            className="rounded border border-gaiamum-primary bg-gaiamum-surface px-2 py-1 text-xs text-gaiamum-text outline-none"
          >
            <option value="" disabled>
              Escolha...
            </option>
            {Object.entries(ROTULO_FORMA_PAGAMENTO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <button type="submit" className="text-xs font-medium text-gaiamum-primary hover:underline">
            Confirmar pagamento
          </button>
          <button
            type="button"
            onClick={() => setEscolhendoFormaPagamento(false)}
            className="text-xs text-gaiamum-text-muted hover:text-gaiamum-text"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <div className="mt-3 flex items-center justify-between border-t border-gaiamum-border pt-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-gaiamum-text">Marcar como pago</span>
            {conta.pago && conta.data_pagamento && !editandoDataPagamento && (
              <button
                type="button"
                onClick={() => setEditandoDataPagamento(true)}
                className="text-left text-xs text-gaiamum-primary hover:underline"
                title="Clique pra corrigir a data de pagamento"
              >
                Pago em {formatarData(conta.data_pagamento)}
              </button>
            )}
            {conta.pago && editandoDataPagamento && (
              <input
                type="date"
                autoFocus
                defaultValue={conta.data_pagamento ?? hojeISO()}
                onBlur={(e) => {
                  setEditandoDataPagamento(false);
                  const novaData = e.currentTarget.value;
                  if (novaData) {
                    iniciarTransicao(async () => {
                      try {
                        await marcarComoPaga(conta.id, novaData);
                        router.refresh();
                      } catch (err) {
                        toast.error(mensagemDeErro(err, "Falha ao corrigir data de pagamento."));
                      }
                    });
                  }
                }}
                className="mt-1 rounded border border-gaiamum-primary bg-gaiamum-surface px-2 py-0.5 text-xs text-gaiamum-text outline-none"
              />
            )}
            {conta.pago && (
              <select
                value={conta.forma_pagamento ?? ""}
                onChange={(e) => {
                  const forma = (e.target.value || null) as FormaPagamento | null;
                  iniciarTransicao(async () => {
                    try {
                      await marcarComoPaga(conta.id, conta.data_pagamento ?? hojeISO(), forma);
                      router.refresh();
                    } catch (err) {
                      toast.error(mensagemDeErro(err, "Falha ao salvar forma de pagamento."));
                    }
                  });
                }}
                className="w-fit rounded border border-gaiamum-border bg-transparent px-1 py-0.5 text-xs text-gaiamum-text-muted outline-none"
                title="Como foi pago"
              >
                <option value="">Forma de pagamento…</option>
                {Object.entries(ROTULO_FORMA_PAGAMENTO).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Interruptor ligado={pagoOtimista} onClick={alternarPago} disabled={pendente} />
        </div>
      )}
    </div>
  );
}

type PropsListaContas = {
  contas: ContaAPagar[];
  anexosPorConta: Record<string, Anexo[]>;
  alarmePorConta: Record<string, number>;
  caminhoRevalidar: string;
  mensagemVazio: string;
};

/** `useSearchParams` só funciona dentro de um limite de Suspense no App
 * Router (senão o build falha) — isolado aqui pra `ListaContas` não exigir
 * que toda página que a usa lembre de envolver num `<Suspense>` externo. */
function ListaContasComDestaque({ contas, anexosPorConta, alarmePorConta, caminhoRevalidar, mensagemVazio }: PropsListaContas) {
  // Chegando de um clique na coluna "Contas de hoje" do Kanban
  // (`?destacar=<id>`) — rola até o card certo e dá um destaque temporário,
  // pra quem tem várias contas no mês não precisar procurar qual é.
  const contaDestacada = useSearchParams().get("destacar");

  useEffect(() => {
    if (!contaDestacada) return;
    document.getElementById(`conta-${contaDestacada}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [contaDestacada]);

  if (contas.length === 0) {
    return <p className="text-sm text-gaiamum-text-muted">{mensagemVazio}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {contas.map((conta) => (
        <Linha
          key={conta.id}
          conta={conta}
          anexos={anexosPorConta[conta.id] ?? []}
          antecedenciaAlarme={alarmePorConta[conta.id] ?? null}
          caminhoRevalidar={caminhoRevalidar}
          destacada={conta.id === contaDestacada}
        />
      ))}
    </div>
  );
}

export function ListaContas(props: PropsListaContas) {
  return (
    <Suspense fallback={<ListaContasSemDestaque {...props} />}>
      <ListaContasComDestaque {...props} />
    </Suspense>
  );
}

/** Fallback do Suspense acima — mesma lista, sem depender de `useSearchParams`.
 * Client components resolvem search params de forma síncrona no navegador,
 * então na prática este fallback quase nunca chega a ser visto. */
function ListaContasSemDestaque({ contas, anexosPorConta, alarmePorConta, caminhoRevalidar, mensagemVazio }: PropsListaContas) {
  if (contas.length === 0) {
    return <p className="text-sm text-gaiamum-text-muted">{mensagemVazio}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {contas.map((conta) => (
        <Linha
          key={conta.id}
          conta={conta}
          anexos={anexosPorConta[conta.id] ?? []}
          antecedenciaAlarme={alarmePorConta[conta.id] ?? null}
          caminhoRevalidar={caminhoRevalidar}
          destacada={false}
        />
      ))}
    </div>
  );
}
