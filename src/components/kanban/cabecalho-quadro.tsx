"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { CLASSE_COR_ETIQUETA, estadoHiperfoco, minutosRestantesHiperfoco } from "@/lib/ecc/kanban";
import { fracaoDecorridaHiperfoco, type FiltroQuadro, type ResumoProgressoQuadro } from "@/lib/ecc/kanban-cabecalho";
import type { Etiqueta, Tarefa } from "@/lib/ecc/tipos";
import { ItemFaixaDoDia } from "@/components/kanban/item-faixa-do-dia";
import {
  IconeAlerta,
  IconeAlvo,
  IconeBusca,
  IconeCalendario,
  IconeChevronDireita,
  IconeFiltro,
  IconeGrade,
  IconeMais,
  IconePessoa,
  IconePrancheta,
} from "@/components/kanban/icones-kanban";

/** Linha de progresso do cabeçalho — "X de Y tarefas concluídas" + barra +
 * %, "N tarefas abertas", "N em foco". Antes ficava escondida no rodapé do
 * quadro (`BarraProgresso`); mesma fórmula (`resumirProgressoQuadro`), só
 * mudou de lugar. Vive no cliente (dentro do `QuadroKanban`) de propósito:
 * acompanha o estado otimista — arrastar um cartão pra "Concluído" atualiza
 * o número na hora, sem esperar o servidor. */
export function ProgressoDoQuadro({ resumo, emFoco }: { resumo: ResumoProgressoQuadro; emFoco: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="w-full flex-1 sm:min-w-[18rem] sm:max-w-[24rem]">
        <p className="text-sm text-gaiamum-text">
          <span className="font-semibold">{resumo.concluidas}</span> de <span className="font-semibold">{resumo.total}</span>{" "}
          tarefas concluídas
          {/* Celular: as 2 estatísticas viram texto na mesma linha (os
              blocos com ícone abaixo só aparecem a partir de `sm:`) — o
              cabeçalho não pode empurrar o quadro pra fora da tela. */}
          <span className="text-gaiamum-text-muted sm:hidden">
            {" "}
            · {resumo.abertas} {resumo.abertas === 1 ? "aberta" : "abertas"} · {emFoco} em foco
          </span>
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={resumo.percentual}
            aria-label="Progresso do quadro"
            className="h-2 flex-1 overflow-hidden rounded-full bg-gaiamum-surface-raised"
          >
            <div
              className="h-full rounded-full bg-gaiamum-primary transition-all duration-500 ease-out"
              style={{ width: `${resumo.percentual}%` }}
            />
          </div>
          <span className="w-11 shrink-0 text-right text-base font-semibold text-gaiamum-primary tabular-nums">
            {resumo.percentual}%
          </span>
        </div>
      </div>

      <div className="flex items-center divide-x divide-gaiamum-border">
        <EstatisticaCabecalho icone={<IconePrancheta className="h-5 w-5" />} numero={resumo.abertas} rotulo={resumo.abertas === 1 ? "tarefa aberta" : "tarefas abertas"} />
        <EstatisticaCabecalho icone={<IconeAlvo className="h-5 w-5" />} numero={emFoco} rotulo="em foco" />
      </div>
    </div>
  );
}

function EstatisticaCabecalho({ icone, numero, rotulo }: { icone: ReactNode; numero: number; rotulo: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 first:pl-0 last:pr-0">
      <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-lg bg-gaiamum-surface text-gaiamum-text-muted">
        {icone}
      </span>
      <div className="leading-tight">
        <p className="text-lg font-semibold text-gaiamum-text tabular-nums">{numero}</p>
        <p className="text-xs text-gaiamum-text-muted">{rotulo}</p>
      </div>
    </div>
  );
}

/** Item "Foco ativo" — só mostra o cronômetro que já existe (migration
 * 0052). Re-renderiza a cada 15s (mesmo intervalo do próprio cartão) só
 * enquanto há foco ativo. */
function ItemFocoAtivo({
  foco,
  aoIrParaFoco,
}: {
  foco: Pick<Tarefa, "titulo" | "hiperfoco_iniciado_em" | "tempo_estimado_min"> | null;
  aoIrParaFoco: () => void;
}) {
  const [, setTique] = useState(0);
  const iniciadoEm = foco?.hiperfoco_iniciado_em ?? null;
  useEffect(() => {
    if (!iniciadoEm) return;
    const id = window.setInterval(() => setTique((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, [iniciadoEm]);

  const botaoIr = (
    <button
      type="button"
      onClick={aoIrParaFoco}
      aria-label="Ir para a coluna de foco"
      title="Ir para a coluna de foco"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gaiamum-text-muted transition hover:bg-gaiamum-surface-raised hover:text-gaiamum-text"
    >
      <IconeChevronDireita />
    </button>
  );

  if (!foco || !foco.hiperfoco_iniciado_em || !foco.tempo_estimado_min) {
    return (
      <ItemFaixaDoDia icone={<span className="text-lg">🎯</span>} tomIcone="neutro" rotulo="Foco ativo:" acao={botaoIr}>
        <span className="text-gaiamum-text-muted">Nenhum foco ativo</span>
      </ItemFaixaDoDia>
    );
  }

  const estado = estadoHiperfoco(foco.hiperfoco_iniciado_em, foco.tempo_estimado_min);
  const minutos = minutosRestantesHiperfoco(foco.hiperfoco_iniciado_em, foco.tempo_estimado_min);
  const fracao = fracaoDecorridaHiperfoco(foco.hiperfoco_iniciado_em, foco.tempo_estimado_min);
  const corBarra = estado === "esgotado" ? "bg-gaiamum-danger" : estado === "metade" ? "bg-gaiamum-warning" : "bg-gaiamum-primary";

  return (
    <ItemFaixaDoDia icone={<span className="text-lg">🎯</span>} tomIcone="neutro" rotulo="Foco ativo:" acao={botaoIr}>
      <span className="flex items-baseline gap-2">
        <span className="truncate font-medium text-gaiamum-primary" title={foco.titulo}>
          {foco.titulo}
        </span>
        <span className="shrink-0 text-xs text-gaiamum-text-muted">
          · {estado === "esgotado" ? "tempo esgotado" : `${minutos} min restantes`}
        </span>
      </span>
      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-gaiamum-surface-raised">
        <span className={`block h-full rounded-full ${corBarra}`} style={{ width: `${Math.round(fracao * 100)}%` }} />
      </span>
    </ItemFaixaDoDia>
  );
}

/** Faixa contextual do dia (mockup aprovado): HOJE · data | próximo
 * compromisso | prazo importante hoje | foco ativo. Resumo de dado que o
 * quadro já tem — nenhum item inventa valor: sem dado, estado vazio. No
 * celular vira 1 linha com rolagem horizontal (não empilha 4 blocos e não
 * rouba altura do quadro). */
export function FaixaDoDia({
  rotuloHoje,
  slotCompromisso,
  prazos,
  foco,
  aoIrParaFoco,
}: {
  rotuloHoje: string;
  /** Item servidor (`FaixaProximoCompromisso`), ou null quando a pessoa não
   * tem acesso à Agenda (mesma regra da coluna "Compromissos do dia"). */
  slotCompromisso: ReactNode;
  prazos: { quantidade: number; destaque: Pick<Tarefa, "titulo"> | null };
  foco: Pick<Tarefa, "titulo" | "hiperfoco_iniciado_em" | "tempo_estimado_min"> | null;
  aoIrParaFoco: () => void;
}) {
  return (
    <div
      className={`flex snap-x overflow-x-auto rounded-xl border border-gaiamum-border bg-gaiamum-surface [scrollbar-width:none] lg:grid lg:overflow-visible ${
        slotCompromisso ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.5fr)]" : "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.5fr)]"
      } divide-x divide-gaiamum-border`}
    >
      <ItemFaixaDoDia icone={<IconeCalendario />}>
        <span className="font-semibold">HOJE</span> <span className="text-gaiamum-text-muted">·</span>{" "}
        <span className="capitalize">{rotuloHoje}</span>
      </ItemFaixaDoDia>

      {slotCompromisso}

      <ItemFaixaDoDia
        icone={<IconeAlerta />}
        tomIcone={prazos.quantidade > 0 ? "amarelo" : "neutro"}
        rotulo={
          prazos.quantidade > 0 ? (
            <span className="text-gaiamum-text">
              <span className="font-semibold">{prazos.quantidade}</span>{" "}
              {prazos.quantidade === 1 ? "prazo importante hoje" : "prazos importantes hoje"}
            </span>
          ) : undefined
        }
      >
        {prazos.destaque ? (
          <span className="text-gaiamum-text-muted" title={prazos.destaque.titulo}>
            {prazos.destaque.titulo}
          </span>
        ) : (
          <span className="text-gaiamum-text-muted">Nenhum prazo hoje</span>
        )}
      </ItemFaixaDoDia>

      <ItemFocoAtivo foco={foco} aoIrParaFoco={aoIrParaFoco} />
    </div>
  );
}

const PRIORIDADES: Tarefa["prioridade"][] = ["P1", "P2", "P3"];

/** Toolbar operacional (mockup aprovado): + Tarefa | Buscar | Filtros |
 * Minhas tarefas | Visão geral. "+ Tarefa" NÃO tem fluxo próprio: leva até o
 * campo "+ Adicionar tarefa" já existente da coluna de entrada e foca nele
 * (mesma criação otimista de sempre). Busca/Filtros/Minhas tarefas são
 * filtros só VISUAIS, no cliente (`filtrarTarefasDoQuadro`) — não existia
 * infraestrutura disso e nada vai pro banco. "Visão geral" abre o mesmo
 * modal que o celular já tinha. */
export function BarraFerramentasQuadro({
  filtro,
  aoMudarFiltro,
  etiquetasDoTenant,
  aoNovaTarefa,
  aoAbrirVisaoGeral,
  inputBuscaRef,
}: {
  filtro: FiltroQuadro;
  aoMudarFiltro: (filtro: FiltroQuadro) => void;
  etiquetasDoTenant: Etiqueta[];
  aoNovaTarefa: () => void;
  aoAbrirVisaoGeral: () => void;
  inputBuscaRef?: RefObject<HTMLInputElement | null>;
}) {
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const qtdFiltros = filtro.prioridades.length + filtro.etiquetaIds.length;

  function alternar<T>(lista: T[], valor: T): T[] {
    return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
  }

  const classeBotao =
    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gaiamum-primary";
  const classeNeutro = "border-gaiamum-border bg-gaiamum-surface text-gaiamum-text hover:border-gaiamum-border-forte";
  const classeAtivo = "border-gaiamum-primary bg-gaiamum-primary/15 text-gaiamum-primary";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={aoNovaTarefa}
        className={`${classeBotao} border-gaiamum-primary bg-gaiamum-primary px-4 text-white shadow-sm hover:bg-gaiamum-primary-dark`}
      >
        <IconeMais />
        Tarefa
      </button>

      <label className="relative order-last w-full sm:order-none sm:w-60">
        <span className="sr-only">Buscar tarefas</span>
        <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gaiamum-text-muted" />
        <input
          ref={inputBuscaRef}
          type="search"
          value={filtro.busca}
          onChange={(e) => aoMudarFiltro({ ...filtro, busca: e.target.value })}
          placeholder="Buscar tarefas..."
          className="h-9 w-full rounded-lg border border-gaiamum-border bg-gaiamum-surface pl-9 pr-3 text-sm text-gaiamum-text outline-none placeholder:text-gaiamum-text-muted focus:border-gaiamum-primary"
        />
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setFiltrosAbertos((a) => !a)}
          aria-expanded={filtrosAbertos}
          className={`${classeBotao} ${qtdFiltros > 0 ? classeAtivo : classeNeutro}`}
        >
          <IconeFiltro />
          Filtros
          {qtdFiltros > 0 && (
            <span className="rounded-full bg-gaiamum-primary px-1.5 text-[11px] font-semibold text-white">{qtdFiltros}</span>
          )}
        </button>
        {filtrosAbertos && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setFiltrosAbertos(false)} aria-hidden />
            <div className="absolute left-0 top-full z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-gaiamum-border bg-gaiamum-surface p-3 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">Prioridade</p>
              <div className="mt-2 flex gap-1.5">
                {PRIORIDADES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={filtro.prioridades.includes(p)}
                    onClick={() => aoMudarFiltro({ ...filtro, prioridades: alternar(filtro.prioridades, p) })}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                      filtro.prioridades.includes(p) ? classeAtivo : classeNeutro
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {etiquetasDoTenant.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gaiamum-text-muted">Etiquetas</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {etiquetasDoTenant.map((e) => {
                      const marcada = filtro.etiquetaIds.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          aria-pressed={marcada}
                          onClick={() => aoMudarFiltro({ ...filtro, etiquetaIds: alternar(filtro.etiquetaIds, e.id) })}
                          className={`rounded-md border px-2 py-0.5 text-xs ${CLASSE_COR_ETIQUETA[e.cor]} ${
                            marcada ? "ring-2 ring-gaiamum-primary" : "opacity-70 hover:opacity-100"
                          }`}
                        >
                          {e.nome}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {qtdFiltros > 0 && (
                <button
                  type="button"
                  onClick={() => aoMudarFiltro({ ...filtro, prioridades: [], etiquetaIds: [] })}
                  className="mt-3 text-xs text-gaiamum-text-muted underline hover:text-gaiamum-text"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        aria-pressed={filtro.somenteMinhas}
        onClick={() => aoMudarFiltro({ ...filtro, somenteMinhas: !filtro.somenteMinhas })}
        className={`${classeBotao} ${filtro.somenteMinhas ? classeAtivo : classeNeutro}`}
        title="Mostrar só os cartões em que você é membro"
      >
        <IconePessoa />
        Minhas tarefas
      </button>

      {/* No celular/toque a barra de navegação de colunas já tem o seu
          "Visão geral" (mesmo modal) — aqui só aparece quando ela não
          aparece, pra não duplicar o botão na mesma tela. */}
      <button
        type="button"
        onClick={aoAbrirVisaoGeral}
        className={`${classeBotao} ${classeNeutro} hidden lg:inline-flex [@media(pointer:coarse)]:hidden`}
      >
        <IconeGrade />
        Visão geral
      </button>
    </div>
  );
}
