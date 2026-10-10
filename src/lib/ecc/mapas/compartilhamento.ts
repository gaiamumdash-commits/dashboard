// Com quem o mapa é compartilhado (migration 0063). Os dois booleanos do
// banco viram uma escolha só na tela; o CHECK da 0063 impede "convidados"
// sem "compartilhado".

export const COMPARTILHAMENTOS = ["privado", "equipe", "todos"] as const;
export type Compartilhamento = (typeof COMPARTILHAMENTOS)[number];

export const ROTULO_COMPARTILHAMENTO: Record<Compartilhamento, { icone: string; titulo: string; descricao: string }> = {
  privado: { icone: "🔒", titulo: "Só eu", descricao: "Ninguém mais vê este mapa." },
  equipe: { icone: "👥", titulo: "Equipe", descricao: "Membros do workspace leem; convidados de um quadro só, não." },
  todos: { icone: "👥", titulo: "Equipe e convidados", descricao: "Membros e convidados de quadro leem. Ninguém edita." },
};

export function ehCompartilhamento(valor: unknown): valor is Compartilhamento {
  return typeof valor === "string" && (COMPARTILHAMENTOS as readonly string[]).includes(valor);
}

export function compartilhamentoDoMapa(mapa: { compartilhado: boolean; inclui_convidados?: boolean | null }): Compartilhamento {
  if (!mapa.compartilhado) return "privado";
  return mapa.inclui_convidados ? "todos" : "equipe";
}

/** Colunas gravadas — sempre as DUAS: sem a 0063, o update falha (coluna
 * inexistente) em vez de compartilhar com a regra antiga, que incluía
 * convidados. */
export function camposDoCompartilhamento(c: Compartilhamento): { compartilhado: boolean; inclui_convidados: boolean } {
  return { compartilhado: c !== "privado", inclui_convidados: c === "todos" };
}

/** Selo curto na lista de mapas. */
export function seloCompartilhamento(c: Compartilhamento, meu: boolean): string | null {
  if (c === "privado") return null;
  if (!meu) return "só leitura";
  return c === "todos" ? "compartilhado com equipe e convidados" : "compartilhado com a equipe";
}
