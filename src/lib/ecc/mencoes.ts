import { identificacaoDoMembro } from "@/lib/ecc/kanban";
import type { MembroTenant } from "@/lib/ecc/tipos";

/** Sem "use client"/"use server" de propósito — usado tanto nas Server
 * Actions (extrair quem foi @mencionado pra notificar) quanto nos
 * componentes client (autocomplete ao digitar, destaque na renderização).
 *
 * A "chave" gravada no texto (`@<chave>`) é `identificacaoDoMembro(membro)`
 * — o e-mail quando o chamador tem direito a vê-lo, senão `nome_exibicao`
 * (parte local do e-mail, revisão de privacidade 2026-10-01). Um comentário
 * antigo, salvo antes desta mudança, sempre tinha o e-mail completo
 * gravado — continua reconhecido normalmente aqui, porque o e-mail
 * completo também É `identificacaoDoMembro(membro)` sempre que o membro
 * que comenta tem acesso a ver o e-mail de quem mencionou (o caso comum).
 * Só muda, pra frente, o caso específico em que `email` é `null`. */

function escaparRegex(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Só reconhece @<chave> de gente que está em `membros` — evita falso
 * positivo com um e-mail qualquer colado no meio do texto. */
function regexMencoes(membros: MembroTenant[]): RegExp | null {
  if (membros.length === 0) return null;
  const alternativas = membros.map((m) => escaparRegex(identificacaoDoMembro(m))).join("|");
  return new RegExp(`(?:^|\\s)@(${alternativas})`, "gi");
}

export function extrairIdsMencionados(texto: string, membros: MembroTenant[]): string[] {
  const regex = regexMencoes(membros);
  if (!regex) return [];
  const encontrados = new Set(Array.from(texto.matchAll(regex)).map((m) => m[1].toLowerCase()));
  return membros.filter((m) => encontrados.has(identificacaoDoMembro(m).toLowerCase())).map((m) => m.user_id);
}

/** Fatia o texto em pedaços normais e pedaços de menção (com o membro
 * correspondente anexado), pra renderizar um chip destacado no lugar do
 * `@<chave>` cru. */
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
    const chave = match[1].toLowerCase();
    const inicioArroba = texto.indexOf("@", inicioMatch);
    const membro = membros.find((m) => identificacaoDoMembro(m).toLowerCase() === chave);

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

/** Substitui o `@token` parcial na posição do cursor por `@<chave> ` e
 * devolve onde o cursor deve ficar depois. `chave` é
 * `identificacaoDoMembro(membro)` — o caller nunca deve passar `membro.email`
 * direto (pode ser `null`). */
export function aplicarMencao(
  texto: string,
  cursor: number,
  chave: string,
): { novoTexto: string; novoCursor: number } {
  const buscaAtual = calcularBuscaMencao(texto, cursor);
  const inicioToken = cursor - (buscaAtual?.length ?? 0) - 1;
  const trecho = `@${chave} `;
  const novoTexto = texto.slice(0, inicioToken) + trecho + texto.slice(cursor);
  return { novoTexto, novoCursor: inicioToken + trecho.length };
}
