import { FUSO_BRASIL, paraUtcDoFuso } from "@/lib/ecc/kanban";

// Sem "server-only" de propósito — usado tanto pelo Server Component
// (agenda/page.tsx, pra calcular o range da query) quanto pelos Client
// Components da grade (navegação, cabeçalho de colunas).

const CHAVE_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

/** "AAAA-MM-DD" do dia de `data` no fuso Brasil, independente de onde o
 * processo roda (o servidor da Vercel roda em UTC) — mesma técnica de
 * `primeiroDiaDoMesAtual` em kanban.ts. */
function dataISOemBrasil(data: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BRASIL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const ano = partes.find((p) => p.type === "year")!.value;
  const mes = partes.find((p) => p.type === "month")!.value;
  const dia = partes.find((p) => p.type === "day")!.value;
  return `${ano}-${mes}-${dia}`;
}

/** Dia da semana (0=domingo..6=sábado) de uma chave "AAAA-MM-DD", tratada
 * como data "flutuante" (só calendário, nunca hora) — seguro porque a
 * chave já foi resolvida no fuso certo antes de chegar aqui. */
function diaDaSemanaDe(chave: string): number {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

function somarDias(chave: string, dias: number): string {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

function segundaFeiraDaChave(chave: string): string {
  const diaSemana = diaDaSemanaDe(chave);
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
  return somarDias(chave, deslocamento);
}

/** "AAAA-MM-DD" da segunda-feira da semana que contém `data`, no fuso Brasil. */
export function segundaFeiraDe(data: Date): string {
  return segundaFeiraDaChave(dataISOemBrasil(data));
}

/** Chave da semana atual — valor default quando a URL não traz `?semana=`. */
export function chaveSemanaAtual(): string {
  return segundaFeiraDe(new Date());
}

/** Início (segunda 00:00 Brasil) e fim exclusivo (segunda seguinte 00:00)
 * da semana, como instantes UTC corretos pra filtrar as queries. Aceita
 * qualquer dia da semana em `chaveRecebida` (normaliza pra segunda); cai
 * pra semana atual se ausente ou malformada. */
export function limitesDaSemana(chaveRecebida?: string): {
  chave: string;
  inicio: Date;
  fimExclusivo: Date;
} {
  const base = chaveRecebida && CHAVE_VALIDA.test(chaveRecebida) ? chaveRecebida : chaveSemanaAtual();
  const chave = segundaFeiraDaChave(base);
  const inicio = paraUtcDoFuso(`${chave}T00:00`, FUSO_BRASIL);
  const fimExclusivo = paraUtcDoFuso(`${somarDias(chave, 7)}T00:00`, FUSO_BRASIL);
  return { chave, inicio, fimExclusivo };
}

/** 7 datas (meia-noite local) pros cabeçalhos de coluna da grade — mesma
 * convenção de `paraDataLocal` (agenda-apresentacao.ts) pra string
 * "AAAA-MM-DD" sem hora. */
export function diasDaSemana(chave: string): Date[] {
  return Array.from({ length: 7 }, (_, i) => new Date(`${somarDias(chave, i)}T00:00:00`));
}

export function semanaAnterior(chave: string): string {
  return somarDias(chave, -7);
}

export function semanaSeguinte(chave: string): string {
  return somarDias(chave, 7);
}

/** "AAAA-MM-DD" no fuso Brasil — pro filtro de `contas_a_pagar.data_vencimento`
 * (coluna `date`, sem hora). */
export function paraDataISO(data: Date): string {
  return dataISOemBrasil(data);
}
