"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { buscarAgendaDoDiaKanban } from "@/lib/ecc/agenda-kanban-actions";
import type { ResultadoCompromissosDoDia } from "@/lib/ecc/agenda";
import { diaSeguinte } from "@/lib/ecc/semana";
import type { ContaAPagar } from "@/lib/ecc/tipos";
import { ListaContasDoDiaKanban } from "@/components/kanban/lista-contas-do-dia-kanban";
import { IconeCalendario, IconeSetaExterna } from "@/components/kanban/icones-kanban";

/** Selo "Hoje"/"Amanhã" dos itens da coluna (mockup aprovado, 2026-10-05). */
function SeloDia({ rotuloDia }: { rotuloDia: string }) {
  return (
    <span className="shrink-0 rounded-md border border-gaiamum-primary/40 bg-gaiamum-primary/15 px-1.5 py-0.5 text-[11px] font-semibold capitalize text-gaiamum-primary">
      {rotuloDia}
    </span>
  );
}

/** Extraída à parte pra o TS estreitar `resultado` (exclui "oculto") de
 * forma confiável — dentro de um `&&` JSX aninhado o narrowing de union
 * discriminada nem sempre se propaga pros galhos internos do ternário. */
function BlocoCompromissos({
  resultado,
  rotuloDia,
}: {
  resultado: Exclude<ResultadoCompromissosDoDia, { status: "oculto" }>;
  rotuloDia: string;
}) {
  if (resultado.status === "problema") {
    return (
      <p className="px-0.5 text-sm text-gaiamum-danger">
        Não consegui ler seu Google Calendar.{" "}
        <Link href="/agenda" className="underline">
          Reconecte na Agenda
        </Link>{" "}
        pra ver os compromissos aqui.
      </p>
    );
  }

  if (resultado.compromissos.length === 0) {
    return <p className="px-0.5 text-sm text-gaiamum-text-muted">Nada marcado pra {rotuloDia}. Dia livre pros cartões.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {resultado.compromissos.map((c) => (
        <li
          key={c.id}
          className="relative overflow-hidden rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised py-2 pl-3 pr-2"
        >
          <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-gaiamum-primary" />
          <div className="flex items-start gap-2">
            <IconeCalendario className="mt-0.5 h-4 w-4 shrink-0 text-gaiamum-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gaiamum-text-muted tabular-nums">{c.horario.replace("–", " – ")}</p>
              <p className="truncate text-sm font-semibold text-gaiamum-text" title={c.titulo}>
                {c.titulo}
              </p>
              {/* Origem do item, pelo prefixo do id (`listarCompromissosDoDia`). */}
              <p className="text-[11px] text-gaiamum-primary">{c.id.startsWith("google-") ? "Google Calendar" : "Gaiamum"}</p>
            </div>
            <SeloDia rotuloDia={rotuloDia} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatarRotuloData(chave: string): string {
  // `chave` já é "AAAA-MM-DD" no fuso Brasil (ver `semana.ts`) — monta a
  // data em UTC meio-dia pra evitar o fuso do navegador "puxar" pro dia
  // anterior ao formatar (achado comum com `new Date("AAAA-MM-DD")`, que o
  // JS interpreta como meia-noite UTC).
  const data = new Date(`${chave}T12:00:00Z`);
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" });
}

function contarItens(resultado: ResultadoCompromissosDoDia, contas: ContaAPagar[]): number {
  return (resultado.status === "conectado" ? resultado.compromissos.length : 0) + contas.length;
}

/** Wrapper cliente da coluna fixa "Compromissos do dia" — recebe o dado de
 * HOJE já pronto do servidor (primeiro paint rápido, sem esperar nada) e
 * adiciona o seletor "Hoje · Amanhã" no rodapé (pedido do Fabio,
 * 2026-10-04): "se eu não clicar fica só compromisso de hoje... bota uma
 * barrinha se eu quiser ver os compromissos do outro dia" — pra planejar
 * hoje com base no que vem amanhã, sem sair do Kanban. Só 1 dia à frente de
 * propósito (ver `agenda-kanban-actions.ts`) — não é um substituto da
 * Agenda completa. Redesenho 2026-10-05: só visual (segmented control com
 * contagem, itens com origem e selo do dia); busca e regras iguais. */
export function ColunaCompromissosDoDiaCliente({
  chaveInicial,
  rotuloDataInicial,
  resultadoInicial,
  contasInicial,
}: {
  chaveInicial: string;
  rotuloDataInicial: string;
  resultadoInicial: ResultadoCompromissosDoDia;
  contasInicial: ContaAPagar[];
}) {
  const [verAmanha, setVerAmanha] = useState(false);
  const [dados, setDados] = useState({
    chave: chaveInicial,
    rotuloData: rotuloDataInicial,
    resultado: resultadoInicial,
    contas: contasInicial,
  });
  // Contagem de amanhã só é conhecida depois da 1ª espiada (não buscamos
  // amanhã sem a pessoa pedir — mesmo comportamento de antes).
  const [contagemAmanha, setContagemAmanha] = useState<number | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function alternarDia(amanha: boolean) {
    setVerAmanha(amanha);
    if (!amanha) {
      // Voltar pra hoje nunca precisa ir ao servidor de novo — o dado
      // inicial já é exatamente isso.
      setDados({ chave: chaveInicial, rotuloData: rotuloDataInicial, resultado: resultadoInicial, contas: contasInicial });
      return;
    }
    iniciarTransicao(async () => {
      try {
        const resposta = await buscarAgendaDoDiaKanban(diaSeguinte(chaveInicial));
        setDados({
          chave: resposta.chave,
          rotuloData: formatarRotuloData(resposta.chave),
          resultado: resposta.resultado,
          contas: resposta.contas,
        });
        setContagemAmanha(contarItens(resposta.resultado, resposta.contas));
      } catch {
        setVerAmanha(false);
      }
    });
  }

  const rotuloDia = verAmanha ? "amanhã" : "hoje";
  const contagemHoje = contarItens(resultadoInicial, contasInicial);

  const classeSegmento = (ativo: boolean) =>
    `rounded-md px-2 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
      ativo ? "bg-gaiamum-primary text-white shadow-sm" : "text-gaiamum-text-muted hover:text-gaiamum-text"
    }`;

  return (
    <>
      <div className="sticky top-0 z-10 -mx-2.5 -mt-2.5 bg-gaiamum-surface px-3 pb-1.5 pt-3">
        <div className="flex items-center gap-2">
          <IconeCalendario className="h-[18px] w-[18px] shrink-0 text-gaiamum-warning" />
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-gaiamum-text">
            Compromissos do dia <span className="font-medium text-gaiamum-text-muted">({contarItens(dados.resultado, dados.contas)})</span>
          </h2>
          <Link
            href="/agenda?visao=dia"
            aria-label="Abrir a Agenda"
            title="Abrir a Agenda"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gaiamum-text-muted transition hover:bg-gaiamum-surface-raised hover:text-gaiamum-text"
          >
            <IconeSetaExterna className="h-3.5 w-3.5" />
          </Link>
        </div>
        <p className="mt-0.5 pl-[26px] text-[11px] capitalize text-gaiamum-text-muted">{dados.rotuloData}</p>
      </div>

      {dados.resultado.status !== "oculto" && <BlocoCompromissos resultado={dados.resultado} rotuloDia={rotuloDia} />}

      <ListaContasDoDiaKanban contas={dados.contas} rotuloDia={rotuloDia} />

      <div className="mt-auto pt-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-gaiamum-border bg-gaiamum-bg/40 p-0.5" role="group" aria-label="Dia">
          <button type="button" onClick={() => alternarDia(false)} disabled={pendente} aria-pressed={!verAmanha} className={classeSegmento(!verAmanha)}>
            Hoje ({contagemHoje})
          </button>
          <button
            type="button"
            onClick={() => alternarDia(true)}
            disabled={pendente}
            aria-pressed={verAmanha}
            className={classeSegmento(verAmanha)}
            title="Espiar os compromissos e contas de amanhã, pra planejar hoje"
          >
            {pendente && verAmanha ? "…" : contagemAmanha === null ? "Amanhã" : `Amanhã (${contagemAmanha})`}
          </button>
        </div>
      </div>
    </>
  );
}
