"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { buscarAgendaDoDiaKanban } from "@/lib/ecc/agenda-kanban-actions";
import type { ResultadoCompromissosDoDia } from "@/lib/ecc/agenda";
import { diaSeguinte } from "@/lib/ecc/semana";
import type { ContaAPagar } from "@/lib/ecc/tipos";
import { ListaContasDoDiaKanban } from "@/components/kanban/lista-contas-do-dia-kanban";

/** Extraída à parte pra o TS estreitar `resultado` (exclui "oculto") de
 * forma confiável — dentro de um `&&` JSX aninhado o narrowing de union
 * discriminada nem sempre se propaga pros galhos internos do ternário. */
function BlocoCompromissos({
  resultado,
  rotuloData,
  rotuloDia,
}: {
  resultado: Exclude<ResultadoCompromissosDoDia, { status: "oculto" }>;
  rotuloData: string;
  rotuloDia: string;
}) {
  return (
    <>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gaiamum-text-muted">
          📅 Compromissos de {rotuloDia}
          {resultado.status === "conectado" && (
            <span className="text-gaiamum-text"> ({resultado.compromissos.length})</span>
          )}
        </h2>
        <p className="mt-0.5 text-xs capitalize text-gaiamum-text-muted">{rotuloData}</p>
      </div>

      {resultado.status === "problema" ? (
        <p className="text-sm text-gaiamum-danger">
          Não consegui ler seu Google Calendar.{" "}
          <Link href="/agenda" className="underline">
            Reconecte na Agenda
          </Link>{" "}
          pra ver os compromissos aqui.
        </p>
      ) : resultado.compromissos.length === 0 ? (
        <p className="text-sm text-gaiamum-text-muted">Nada marcado pra {rotuloDia}. Dia livre pros cartões.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {resultado.compromissos.map((c) => (
            <li key={c.id} className="rounded-lg border border-gaiamum-border bg-gaiamum-surface-raised px-3 py-2">
              <p className="text-xs font-semibold text-gaiamum-primary">{c.horario}</p>
              <p className="text-sm text-gaiamum-text">{c.titulo}</p>
            </li>
          ))}
        </ul>
      )}
    </>
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

/** Wrapper cliente da coluna fixa "Compromissos do dia" — recebe o dado de
 * HOJE já pronto do servidor (primeiro paint rápido, sem esperar nada) e
 * adiciona a barrinha "‹ Hoje · Amanhã ›" no rodapé (pedido do Fabio,
 * 2026-10-04): "se eu não clicar fica só compromisso de hoje... bota uma
 * barrinha se eu quiser ver os compromissos do outro dia" — pra planejar
 * hoje com base no que vem amanhã, sem sair do Kanban. Só 1 dia à frente de
 * propósito (ver `agenda-kanban-actions.ts`) — não é um substituto da
 * Agenda completa. */
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
      } catch {
        setVerAmanha(false);
      }
    });
  }

  const rotuloDia = verAmanha ? "amanhã" : "hoje";

  return (
    <>
      {dados.resultado.status !== "oculto" && (
        <BlocoCompromissos resultado={dados.resultado} rotuloData={dados.rotuloData} rotuloDia={rotuloDia} />
      )}

      <ListaContasDoDiaKanban contas={dados.contas} rotuloDia={rotuloDia} />

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-gaiamum-border pt-2">
        <div className="flex gap-1 rounded-lg bg-gaiamum-surface-raised p-0.5 text-xs">
          <button
            type="button"
            onClick={() => alternarDia(false)}
            disabled={pendente}
            className={`rounded-md px-2 py-1 font-medium transition ${
              !verAmanha ? "bg-gaiamum-primary text-white" : "text-gaiamum-text-muted hover:text-gaiamum-text"
            }`}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => alternarDia(true)}
            disabled={pendente}
            className={`rounded-md px-2 py-1 font-medium transition ${
              verAmanha ? "bg-gaiamum-primary text-white" : "text-gaiamum-text-muted hover:text-gaiamum-text"
            }`}
            title="Espiar os compromissos e contas de amanhã, pra planejar hoje"
          >
            {pendente && verAmanha ? "…" : "Amanhã"}
          </button>
        </div>
        <Link href="/agenda?visao=dia" className="shrink-0 text-xs text-gaiamum-text-muted underline hover:text-gaiamum-text">
          Abrir a Agenda
        </Link>
      </div>
    </>
  );
}
