import type { CategoriaFinanceira, RegraCategoria } from "@/lib/ecc/tipos";

/** Busca por palavra-chave (case-insensitive, substring) na descrição do
 * lançamento — primeira regra que bater vence. Sem IA nesta primeira
 * versão: determinístico, editável pelo próprio Fabio, sem custo de API. */
export function sugerirCategoria(descricao: string, regras: RegraCategoria[]): CategoriaFinanceira | null {
  const alvo = descricao.toLowerCase();
  const regra = regras.find((r) => alvo.includes(r.palavra_chave.toLowerCase()));
  return regra?.categoria ?? null;
}
