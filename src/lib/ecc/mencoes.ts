import type { MembroTenant } from "@/lib/ecc/tipos";

/** Sem "use client"/"use server" de propósito — usado tanto nas Server
 * Actions (extrair quem foi @mencionado pra notificar) quanto nos
 * componentes client (autocomplete ao digitar, destaque na renderização). */

function escaparRegex(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Só reconhece @email de gente que está em `membros` — evita falso
 * positivo com um e-mail qualquer colado no meio do texto. */
function regexMencoes(membros: MembroTenant[]): RegExp | null {
  if (membros.length === 0) return null;
  const alternativas = membros.map((m) => escaparRegex(m.email)).join("|");
  return new RegExp(`(?:^|\\s)@(${alternativas})`, "gi");
}

export function extrairIdsMencionados(texto: string, membros: MembroTenant[]): string[] {
  const regex = regexMencoes(membros);
  if (!regex) return [];
  const emailsEncontrados = new Set(Array.from(texto.matchAll(regex)).map((m) => m[1].toLowerCase()));
  return membros.filter((m) => emailsEncontrados.has(m.email.toLowerCase())).map((m) => m.user_id);
}

/** Fatia o texto em pedaços normais e pedaços de menção (com o membro
 * correspondente anexado), pra renderizar um chip destacado no lugar do
 * `@email` cru. */
export function dividirTextoPorMencoes(
  texto: string,
  membros: MembroTenant[],
): Array<{ texto: string; membro?: MembroTenant }> {
  const regex = regexMencoes(membros);
  if (!regex) return [{ texto }];

  const partes: Array<{ texto: string; membro?: MembroTenant }> = [];
  let ultimoIndice = 0;

  for (const match of texto.matchAll(regex)) {
    const inicioMatch = match.index ?? 0;
    const email = match[1].toLowerCase();
    const inicioArroba = texto.indexOf("@", inicioMatch);
    const membro = membros.find((m) => m.email.toLowerCase() === email);

    if (inicioArroba > ultimoIndice) {
      partes.push({ texto: texto.slice(ultimoIndice, inicioArroba) });
    }
    partes.push({ texto: `@${match[1]}`, membro });
    ultimoIndice = inicioArroba + 1 + match[1].length;
  }

  if (ultimoIndice < texto.length) {
    partes.push({ texto: texto.slice(ultimoIndice) });
  }

  return partes.length > 0 ? partes : [{ texto }];
}

/** Olha só até a posição do cursor — acha o `@token` em digitação (início
 * da string ou depois de espaço, sem espaço depois). `null` quando não há
 * menção em digitação naquele ponto. */
export function calcularBuscaMencao(texto: string, cursor: number): string | null {
  const ateOCursor = texto.slice(0, cursor);
  const match = ateOCursor.match(/(?:^|\s)@([^\s@]*)$/);
  return match ? match[1] : null;
}

/** Substitui o `@token` parcial na posição do cursor por `@email ` e
 * devolve onde o cursor deve ficar depois. */
export function aplicarMencao(
  texto: string,
  cursor: number,
  email: string,
): { novoTexto: string; novoCursor: number } {
  const buscaAtual = calcularBuscaMencao(texto, cursor);
  const inicioToken = cursor - (buscaAtual?.length ?? 0) - 1;
  const trecho = `@${email} `;
  const novoTexto = texto.slice(0, inicioToken) + trecho + texto.slice(cursor);
  return { novoTexto, novoCursor: inicioToken + trecho.length };
}
