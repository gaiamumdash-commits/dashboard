import type { CategoriaReceita } from "@/lib/ecc/tipos";

/**
 * Regras puras do cadastro de receitas (migration 0054) — sem I/O, testáveis
 * isoladas. Quem grava é `receitas.ts` (Server Actions).
 *
 * Cadastro rápido de propósito (pedido do Fabio, 2026-10-05: receita é rara e
 * variável): só descrição, valor e data prevista são obrigatórios.
 */

export const TAMANHO_MAXIMO_DESCRICAO_RECEITA = 200;

export const ROTULO_CATEGORIA_RECEITA: Record<CategoriaReceita, string> = {
  servico: "Serviço",
  produto: "Produto",
  outra: "Outra",
};

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type NovaReceita = {
  descricao: string;
  valor: number;
  dataPrevista: string;
  mesReferencia: string;
  categoria: CategoriaReceita | null;
  projetoId: string | null;
};

export type ResultadoValidacaoReceita = { ok: true; receita: NovaReceita } | { ok: false; mensagem: string };

export function primeiroDiaDoMesDe(dataISO: string): string {
  return `${dataISO.slice(0, 7)}-01`;
}

/** "2026-11-01" → "novembro de 2026". */
export function rotuloDoMes(mesReferencia: string): string {
  return new Date(`${mesReferencia}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export type ReceitasAgrupadas<T> = {
  /** De meses anteriores e ainda não recebidas — dinheiro que deveria ter
   * entrado e não entrou não pode sumir da tela só porque o mês virou. */
  atrasadas: T[];
  doMes: T[];
  /** Meses futuros, em ordem, cada um com suas receitas (achado real do
   * Fabio, 2026-10-05: ele lança as parcelas do seguro-desemprego de uma
   * vez, e as de novembro/dezembro "sumiam" porque a tela só mostrava o mês
   * atual). */
  proximosMeses: { mesReferencia: string; receitas: T[] }[];
};

export function agruparReceitasPorPeriodo<T extends { mes_referencia: string; recebida: boolean }>(
  receitas: T[],
  mesAtual: string,
): ReceitasAgrupadas<T> {
  const atrasadas = receitas.filter((r) => r.mes_referencia < mesAtual && !r.recebida);
  const doMes = receitas.filter((r) => r.mes_referencia === mesAtual);
  const porMes = new Map<string, T[]>();
  for (const r of receitas) {
    if (r.mes_referencia > mesAtual) {
      const lista = porMes.get(r.mes_referencia) ?? [];
      lista.push(r);
      porMes.set(r.mes_referencia, lista);
    }
  }
  const proximosMeses = [...porMes.keys()].sort().map((mesReferencia) => ({ mesReferencia, receitas: porMes.get(mesReferencia)! }));
  return { atrasadas, doMes, proximosMeses };
}

/** Aceita "1500", "1500.5" e também "1.500,50" (jeito brasileiro de digitar),
 * porque o campo pode vir de um input de texto num celular. Devolve `NaN`
 * pra qualquer coisa que não seja número. */
export function lerValorMonetario(bruto: string): number {
  const limpo = bruto.trim().replace(/^R\$\s*/i, "");
  if (limpo === "") return Number.NaN;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  return /^\d+(\.\d+)?$/.test(normalizado) ? Number(normalizado) : Number.NaN;
}

function ehDataValida(dataISO: string): boolean {
  if (!DATA_ISO.test(dataISO)) return false;
  const data = new Date(`${dataISO}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === dataISO;
}

export function validarNovaReceita(campos: {
  descricao: string | null;
  valor: string | null;
  dataPrevista: string | null;
  categoria?: string | null;
  projetoId?: string | null;
}): ResultadoValidacaoReceita {
  const descricao = (campos.descricao ?? "").trim();
  if (!descricao) return { ok: false, mensagem: "Descreva a receita (ex.: \"Projeto do cliente X\")." };
  if (descricao.length > TAMANHO_MAXIMO_DESCRICAO_RECEITA) {
    return { ok: false, mensagem: `A descrição pode ter no máximo ${TAMANHO_MAXIMO_DESCRICAO_RECEITA} caracteres.` };
  }

  const valor = lerValorMonetario(campos.valor ?? "");
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, mensagem: "Informe um valor maior que zero." };
  if (valor >= 10_000_000_000) return { ok: false, mensagem: "Valor alto demais." };

  const dataPrevista = (campos.dataPrevista ?? "").trim();
  if (!ehDataValida(dataPrevista)) return { ok: false, mensagem: "Informe a data em que o dinheiro deve entrar." };

  const categoriaBruta = (campos.categoria ?? "").trim();
  let categoria: CategoriaReceita | null = null;
  if (categoriaBruta) {
    if (!(categoriaBruta in ROTULO_CATEGORIA_RECEITA)) return { ok: false, mensagem: "Categoria inválida." };
    categoria = categoriaBruta as CategoriaReceita;
  }

  const projetoId = (campos.projetoId ?? "").trim() || null;

  return {
    ok: true,
    receita: {
      descricao,
      valor: Math.round(valor * 100) / 100,
      dataPrevista,
      mesReferencia: primeiroDiaDoMesDe(dataPrevista),
      categoria,
      projetoId,
    },
  };
}
